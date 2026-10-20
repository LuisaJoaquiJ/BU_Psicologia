const path = require("path");
const { AppError } = require("../../../common/utils/AppError");
const { hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const { PROGRAMAS } = require("../utils/catalogos");
const { OCUPAN_CUPO, TIPOS_DOCUMENTO, iso, texto, serializar, publicaInscripcion } = require("../utils/salidas");
const { comprobanteService } = require("./ComprobanteService");
const { salidaService } = require("./SalidaService");

// Salidas para el estudiante: las ve, se inscribe y cancela.
class InscripcionSalidaService {
  constructor(r = repos, comprobantes = comprobanteService, salidas = salidaService) {
    this.repos = r;
    this.comprobantes = comprobantes;
    this.salidas = salidas;
  }

  async paraEstudiante(usuario) {
    await this.salidas.publicarVerificadas();
    const hoy = hoyBogota();
    const vigentes = (await this.repos.salidas.porFecha({ estado: { in: ["Publicada", "Cerrada"] } })).filter((s) => s.fechaRegreso >= hoy);
    const mapa = await this.salidas.conteos(vigentes.map((s) => s.id));
    const mias = await this.repos.inscripcionesSalida.deUsuario(usuario.id);
    const miaDe = (id) => mias.find((m) => m.salidaId === id);
    const todas = await this.repos.salidas.listarPorIds(mias.map((m) => m.salidaId));
    const resumen = (s) => (s ? { id: s.id, nombre: s.nombre, destino: s.destino, fechaSalida: iso(s.fechaSalida), estado: s.estado } : null);
    return {
      programas: PROGRAMAS.map((p) => p.nombre),
      salidas: vigentes.map((s) => ({ ...serializar(s, mapa.get(s.id)), miInscripcion: miaDe(s.id) ? publicaInscripcion(miaDe(s.id)) : null })),
      misInscripciones: mias
        .map((m) => ({ ...publicaInscripcion(m), salida: resumen(todas.find((x) => x.id === m.salidaId)) }))
        .sort((a, b) => String(b.salida?.fechaSalida).localeCompare(String(a.salida?.fechaSalida))),
    };
  }

  // Datos del formulario de inscripcion, validados.
  datos(cuerpo) {
    const datos = {
      tipoDocumento: TIPOS_DOCUMENTO.includes(cuerpo.tipoDocumento) ? cuerpo.tipoDocumento : "CC",
      documento: texto(cuerpo.documento, 30),
      programa: texto(cuerpo.programa, 150),
      celular: texto(cuerpo.celular, 30),
      eps: texto(cuerpo.eps, 120),
      contactoEmergencia: texto(cuerpo.contactoEmergencia, 200),
      telefonoEmergencia: texto(cuerpo.telefonoEmergencia, 30),
    };
    const requeridos = [["documento", "tu número de identificación"], ["programa", "tu programa"], ["celular", "tu número de celular"], ["eps", "tu EPS"]];
    const faltan = requeridos.filter(([k]) => !datos[k]);
    if (faltan.length) throw new AppError(400, `Falta ${faltan.map(([, t]) => t).join(", ")}.`);
    if (!/^[0-9A-Za-z-]{5,20}$/.test(datos.documento)) throw new AppError(400, "Revisa el número de identificación.");
    if (!(cuerpo.consentimiento === true || cuerpo.consentimiento === "true")) throw new AppError(400, "Debes autorizar el tratamiento de tus datos para inscribirte.");
    return datos;
  }

  async inscribirse(usuario, salidaId, cuerpo = {}, archivo) {
    try {
      const salida = await this.salidas.obtenerOFallar(salidaId);
      if (salida.estado !== "Publicada") throw new AppError(409, "Esta salida no tiene inscripciones abiertas.");
      if (salida.fechaLimiteInscripcion < hoyBogota()) throw new AppError(409, "Las inscripciones para esta salida ya cerraron.");
      const datos = this.datos(cuerpo);
      if (salida.pideComprobante && !archivo) throw new AppError(400, "Esta salida pide subir el comprobante de pago.");
      const existente = await this.repos.inscripcionesSalida.deUsuarioEnSalida(salidaId, usuario.id);
      if (existente && OCUPAN_CUPO.includes(existente.estado)) throw new AppError(409, "Ya estás inscrito en esta salida.");
      if ((await this.repos.inscripcionesSalida.contar({ salidaId, estado: { in: OCUPAN_CUPO } })) >= salida.cupos) throw new AppError(409, "Ya no quedan cupos para esta salida.");

      const comun = {
        ...datos,
        nombre: usuario.nombre,
        correo: usuario.emailInstitucional,
        consentimiento: true,
        estado: "Pendiente",
        observacion: null,
        revisadoPor: null,
        fechaRevision: null,
        ...(archivo ? { comprobante: path.basename(archivo.path), comprobanteNombre: texto(archivo.originalname, 200) } : {}),
      };
      if (!existente) return publicaInscripcion(await this.repos.inscripcionesSalida.crear({ ...comun, salidaId, usuarioId: usuario.id }));
      // Se vuelve a inscribir despues de cancelar o de un rechazo.
      if (archivo && existente.comprobante) await this.comprobantes.borrar(existente.comprobante);
      return publicaInscripcion(await this.repos.inscripcionesSalida.actualizar(existente.id, { ...comun, fechaInscripcion: new Date() }));
    } catch (err) {
      if (archivo) await this.comprobantes.borrar(path.basename(archivo.path));
      throw err;
    }
  }

  async cancelar(usuario, salidaId) {
    const salida = await this.salidas.obtenerOFallar(salidaId);
    const ins = await this.repos.inscripcionesSalida.deUsuarioEnSalida(salidaId, usuario.id);
    if (!ins || ins.estado === "Cancelada") throw new AppError(404, "No tienes una inscripción activa en esta salida.");
    if (salida.fechaSalida <= hoyBogota()) throw new AppError(409, "La salida ya empezó: comunícate con la Unidad de Salud.");
    return publicaInscripcion(await this.repos.inscripcionesSalida.actualizar(ins.id, { estado: "Cancelada" }));
  }
}

module.exports = { InscripcionSalidaService, inscripcionSalidaService: new InscripcionSalidaService() };
