const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { periodoDeFecha, rangoDePeriodo } = require("../utils/catalogos");
const { enteroOpcional } = require("../utils/texto");
const { validarPeriodo, validarActividad, indicadores } = require("../utils/registro");

// Actividades de la Unidad de Salud: servicios permanentes (atencion basica,
// telemedicina...) y jornadas puntuales (feria de la salud, tamizajes,
// capacitaciones). Cada una tiene codigo SNIES, meta y seguimiento.
class ActividadService {
  constructor(r = repos) {
    this.repos = r;
  }

  async listar({ periodo, categoria, incluirInactivas } = {}) {
    const where = { periodo: validarPeriodo(periodo || periodoDeFecha(new Date())) };
    if (categoria) where.categoria = categoria;
    if (!incluirInactivas) where.activa = true;
    const actividades = await this.repos.actividades.ordenadas(where);
    const ids = actividades.map((a) => a.id);
    const [atenciones, evidencias] = await Promise.all([this.repos.atenciones.resumenDeActividades(ids), this.repos.evidencias.deActividades(ids)]);
    return actividades.map((a) => ({
      ...a,
      indicadores: indicadores(
        a,
        atenciones.filter((x) => x.actividadId === a.id),
        evidencias.filter((x) => x.actividadId === a.id).length,
      ),
    }));
  }

  async obtenerOFallar(id) {
    const actividad = await this.repos.actividades.buscarPorId(id);
    if (!actividad) throw new AppError(404, "La actividad no existe.");
    return actividad;
  }

  async obtener(id) {
    const actividad = await this.obtenerOFallar(id);
    const [atenciones, evidencias] = await Promise.all([this.repos.atenciones.deActividad(id), this.repos.evidencias.deActividad(id)]);
    return { ...actividad, indicadores: indicadores(actividad, atenciones, evidencias.length), atenciones, evidencias };
  }

  async siguienteCodigo(periodo) {
    return ((await this.repos.actividades.ultimaDelPeriodo(periodo))?.codigo || 0) + 1;
  }

  async crear(datos) {
    const limpio = validarActividad(datos);
    const rango = rangoDePeriodo(limpio.periodo);
    limpio.fechaInicio = limpio.fechaInicio || rango.desde;
    limpio.fechaFin = limpio.fechaFin || (limpio.permanente ? rango.hasta : limpio.fechaInicio);
    if (limpio.fechaInicio > limpio.fechaFin) throw new AppError(400, "La fecha de inicio no puede ser posterior a la fecha final.");
    const conCodigo = datos.codigo !== undefined && datos.codigo !== "";
    limpio.codigo = conCodigo ? enteroOpcional(datos.codigo, "código", { min: 1 }) : await this.siguienteCodigo(limpio.periodo);
    try {
      return await this.repos.actividades.crear(limpio);
    } catch (err) {
      if (err?.code === "P2002") throw new AppError(409, `Ya existe una actividad con el código ${limpio.codigo} en ${limpio.periodo}.`);
      throw err;
    }
  }

  async actualizar(id, datos) {
    const actual = await this.obtenerOFallar(id);
    const limpio = validarActividad(datos, { parcial: true });
    if (datos.codigo !== undefined) limpio.codigo = enteroOpcional(datos.codigo, "código", { min: 1 });
    const inicio = limpio.fechaInicio || actual.fechaInicio;
    const fin = limpio.fechaFin || actual.fechaFin;
    if (new Date(inicio) > new Date(fin)) throw new AppError(400, "La fecha de inicio no puede ser posterior a la fecha final.");
    try {
      return await this.repos.actividades.actualizar(id, limpio);
    } catch (err) {
      if (err?.code === "P2002") throw new AppError(409, "Ya existe otra actividad con ese código en el periodo.");
      throw err;
    }
  }

  // Inicio de semestre: copia el catalogo de un periodo al siguiente (mismos
  // nombres, categorias y codigos; fechas del nuevo periodo; sin atenciones).
  async copiarCatalogo(origen, destino) {
    validarPeriodo(origen);
    validarPeriodo(destino);
    if (origen === destino) throw new AppError(400, "Elige un periodo de destino distinto.");
    if ((await this.repos.actividades.contar({ periodo: destino })) > 0) throw new AppError(409, `El periodo ${destino} ya tiene actividades.`);
    const actividades = await this.repos.actividades.ordenadas({ periodo: origen });
    if (!actividades.length) throw new AppError(404, `No hay actividades en ${origen} para copiar.`);
    const rango = rangoDePeriodo(destino);
    await this.repos.actividades.crearVarias(
      actividades.map((a) => ({
        codigo: a.codigo,
        periodo: destino,
        nombre: a.nombre,
        categoria: a.categoria,
        tipoSnies: a.tipoSnies,
        permanente: a.permanente,
        clinica: a.clinica,
        meta: a.meta,
        horasDedicacion: a.horasDedicacion,
        responsableDocumento: a.responsableDocumento,
        fechaInicio: rango.desde,
        fechaFin: a.permanente ? rango.hasta : rango.desde,
        activa: a.activa,
      })),
    );
    return { copiadas: actividades.length, periodo: destino };
  }

  async periodos() {
    const periodos = new Set((await this.repos.actividades.periodos()).map((a) => a.periodo));
    periodos.add(periodoDeFecha(new Date()));
    return [...periodos].sort().reverse();
  }
}

module.exports = { ActividadService, actividadService: new ActividadService() };
