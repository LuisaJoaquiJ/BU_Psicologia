const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { ACCESO_DOCENTE, DIAS, texto, redondear, cruceEntre, textoHorario, horasSemana, periodoActual, instanteBogota, exigirQueNoTermine } = require("../utils");
const { leerCsvDocentes } = require("../utils/csvDocentes");

// Docentes / entrenadores (F-02 PISU: RF-004, RF-007, RF-013 a RF-016, RN-004).
// La coordinacion los registra con su correo (institucional o externo); ese
// correo recibe el acceso "deporte-docente" y entra a su panel, donde solo ve
// los grupos que tiene asignados.
class DocenteService {
  async listar() {
    const [docentes, grupos, usuarios] = await Promise.all([
      repos.docentes.listar({}, { nombre: "asc" }),
      repos.grupos.listar({ periodo: periodoActual() }),
      repos.usuarios.listar(),
    ]);
    const ingresaron = new Set(usuarios.map((x) => x.emailInstitucional.toLowerCase()));
    return docentes.map((d) => {
      const propios = grupos.filter((g) => g.docenteId === d.id);
      return {
        ...d,
        externo: this.esExterno(d.email),
        haIngresado: ingresaron.has(d.email),
        grupos: propios.map((g) => ({ id: g.id, nombre: g.nombre, horarioTexto: textoHorario(g.horario) })),
        horasSemana: redondear(propios.reduce((s, g) => s + horasSemana(g.horario), 0)),
      };
    });
  }

  async crear(cuerpo, asignadoPor) {
    const data = this.datos(cuerpo);
    if (await repos.docentes.porEmail(data.email)) throw new AppError(409, `${data.email} ya está registrado como docente.`, "DOCENTE_REPETIDO");
    const docente = await repos.docentes.crear(data);
    await this.sincronizarAcceso(docente, asignadoPor);
    return docente;
  }

  async actualizar(id, cuerpo, asignadoPor) {
    if (!(await repos.docentes.buscarPorId(id))) throw new AppError(404, "El docente no existe.");
    const docente = await repos.docentes.actualizar(id, this.datos(cuerpo, true));
    await this.sincronizarAcceso(docente, asignadoPor);
    return docente;
  }

  // Carga masiva: crea los correos nuevos y actualiza los existentes.
  async cargarCsv(contenido, asignadoPor) {
    const resultado = { creados: 0, actualizados: 0, errores: [] };
    for (const fila of leerCsvDocentes(contenido)) {
      try {
        const data = this.datos({ ...fila, activo: true });
        const existente = await repos.docentes.porEmail(data.email);
        if (existente) {
          const { email, ...cambios } = data;
          await this.actualizar(existente.id, cambios, asignadoPor);
          resultado.actualizados += 1;
        } else {
          await this.crear(data, asignadoPor);
          resultado.creados += 1;
        }
      } catch (err) {
        resultado.errores.push({ linea: fila.linea, mensaje: err.message });
      }
    }
    return resultado;
  }

  // RF-007: un docente no puede tener dos grupos del mismo periodo a la misma hora.
  async validarAsignacion(docenteId, grupo) {
    if (!docenteId) return null;
    const docente = await repos.docentes.buscarPorId(docenteId);
    if (!docente) throw new AppError(400, "El docente no existe.");
    if (!docente.activo) throw new AppError(409, `${docente.nombre} está inactivo; actívalo antes de asignarle grupos.`);
    const otros = (await repos.grupos.listar({ docenteId, periodo: grupo.periodo })).filter((g) => g.id !== grupo.id && g.activo !== false);
    const cruce = otros.find((g) => cruceEntre(g.horario, grupo.horario));
    if (cruce) {
      const franja = cruceEntre(cruce.horario, grupo.horario);
      throw new AppError(409, `${docente.nombre} ya dicta ${cruce.nombre} el ${DIAS[franja.dia].toLowerCase()} de ${franja.inicio} a ${franja.fin}.`, "CRUCE_DOCENTE");
    }
    return docente;
  }

  // ---- Panel del docente (RN-004: se identifica por su correo) ----
  async docenteDe(usuario) {
    const docente = await repos.docentes.porEmail(usuario.emailInstitucional.toLowerCase());
    if (!docente || !docente.activo) throw new AppError(403, "Tu correo no está registrado como docente activo de Deporte.", "NO_ES_DOCENTE");
    return docente;
  }

  async exigirGrupoPropio(usuario, grupoId) {
    const docente = await this.docenteDe(usuario);
    const grupo = await repos.grupos.buscarPorId(grupoId);
    if (!grupo) throw new AppError(404, "El grupo no existe.");
    if (grupo.docenteId !== docente.id) throw new AppError(403, "Este grupo no está asignado a ti.", "GRUPO_AJENO");
    return { docente, grupo };
  }

  // Solo los comunicados de sus grupos (para ponerles o quitarles foto).
  async exigirAlertaPropia(usuario, alertaId) {
    const alerta = await repos.alertas.buscarPorId(alertaId);
    if (!alerta) throw new AppError(404, "El comunicado no existe.");
    if (alerta.alcance !== "Grupo") throw new AppError(403, "Solo puedes cambiar los comunicados de tus grupos.", "GRUPO_AJENO");
    await this.exigirGrupoPropio(usuario, alerta.grupoId);
  }

  // La asistencia se corrige solo mientras dura la clase.
  editableHasta(sesion) {
    return instanteBogota(sesion.fecha, sesion.fin);
  }

  exigirVentanaEdicion(sesion) {
    exigirQueNoTermine(sesion.fecha, sesion.fin);
  }

  // ---- Apoyo ----
  // Se acepta cualquier correo valido: los docentes pueden ser externos.
  validarCorreo(email) {
    const correo = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new AppError(400, "Escribe un correo válido.");
    return correo;
  }

  esExterno(email) {
    return email.split("@")[1] !== config.allowedGoogleDomain;
  }

  datos(cuerpo = {}, parcial = false) {
    const data = {};
    if (!parcial) data.email = this.validarCorreo(cuerpo.email);
    if (!parcial || cuerpo.nombre !== undefined) {
      data.nombre = texto(cuerpo.nombre, 150);
      if (!data.nombre) throw new AppError(400, "Escribe el nombre del docente.");
    }
    if (cuerpo.telefono !== undefined) {
      data.telefono = texto(cuerpo.telefono, 30);
      if (data.telefono && !/^[0-9+()\s-]{7,30}$/.test(data.telefono)) throw new AppError(400, "El teléfono solo puede tener números, espacios y los signos + ( ) -.");
    }
    if (cuerpo.especialidad !== undefined) data.especialidad = texto(cuerpo.especialidad, 120);
    if (cuerpo.activo !== undefined) data.activo = cuerpo.activo === true || cuerpo.activo === "true";
    return data;
  }

  // Da o quita el acceso al panel docente segun el estado del docente.
  async sincronizarAcceso(docente, asignadoPor) {
    const acceso = await repos.accesos.buscarUno({ email: docente.email, modulo: ACCESO_DOCENTE });
    if (docente.activo && !acceso) {
      await repos.accesos.crear({ email: docente.email, modulo: ACCESO_DOCENTE, asignadoPor: asignadoPor || null });
      await this.cambiarRol(docente.email, "Administrador");
    }
    if (!docente.activo && acceso) {
      await repos.accesos.eliminar(acceso.id);
      // Sin otros accesos vuelve a ser estudiante.
      if ((await repos.accesos.contar({ email: docente.email })) === 0) await this.cambiarRol(docente.email, "Estudiante");
    }
  }

  async cambiarRol(email, nombreRol) {
    const [usuario, rol] = await Promise.all([repos.usuarios.porEmail(email, { rol: true }), repos.roles.porNombre(nombreRol)]);
    if (usuario && rol && usuario.rolId !== rol.id && usuario.rol?.nombre !== "SuperAdministrador") {
      await repos.usuarios.actualizar(usuario.id, { rolId: rol.id });
    }
  }
}

module.exports = new DocenteService();
