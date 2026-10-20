const path = require("path");
const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { ESTADOS_SALIDA, texto, iso, datosSalida, serializar, publicaInscripcion } = require("../utils/salidas");
const { TIPOS } = require("../utils/sst");
const { hoyBogota } = require("../../../common/utils/fechas");

const DIA_MS = 24 * 60 * 60 * 1000;
const { comprobanteService } = require("./ComprobanteService");
const { generarListado } = require("../archivos/ListadoSalidaExcel");

// Salidas con inscripcion: gestion del personal de Salud.
class SalidaService {
  constructor(r = repos, comprobantes = comprobanteService) {
    this.repos = r;
    this.comprobantes = comprobantes;
  }

  async obtenerOFallar(id) {
    const salida = await this.repos.salidas.buscarPorId(id);
    if (!salida) throw new AppError(404, "La salida no existe.");
    return salida;
  }

  // Inscripciones por estado de cada salida.
  async conteos(ids) {
    const mapa = new Map();
    for (const i of await this.repos.inscripcionesSalida.deSalidas(ids)) {
      const c = mapa.get(i.salidaId) || { Pendiente: 0, Aprobada: 0, Rechazada: 0, Cancelada: 0 };
      c[i.estado] = (c[i.estado] || 0) + 1;
      mapa.set(i.salidaId, c);
    }
    return mapa;
  }

  async listar() {
    const salidas = await this.repos.salidas.porFecha();
    const mapa = await this.conteos(salidas.map((s) => s.id));
    return salidas.map((s) => serializar(s, mapa.get(s.id)));
  }

  async obtener(id) {
    const salida = await this.obtenerOFallar(id);
    return serializar(salida, (await this.conteos([id])).get(id));
  }

  async crear(cuerpo, usuario) {
    const estado = cuerpo.estado === "Publicada" ? "Publicada" : "Borrador";
    return serializar(await this.repos.salidas.crear({ ...datosSalida(cuerpo), estado, creadaPor: usuario?.emailInstitucional || null }));
  }

  // Abre la inscripcion de estudiantes de una salida reportada en SST: crea
  // la convocatoria con los datos del reporte, en borrador o ya publicada
  // (al verificar el reporte). Si ya existe, la devuelve (y la publica si se pide).
  async desdeReporte(reporteId, usuario, { publicar = false } = {}) {
    const reporte = await this.repos.reportesSst.completo(reporteId);
    if (!reporte) throw new AppError(404, "El reporte no existe.");
    if (reporte.convocatoria) {
      if (publicar && reporte.convocatoria.estado === "Borrador") await this.repos.salidas.actualizar(reporte.convocatoria.id, { estado: "Publicada" });
      return { salida: await this.obtener(reporte.convocatoria.id), creada: false };
    }
    if (TIPOS[reporte.tipo]?.grupo !== "estudiantes") throw new AppError(409, "Solo las salidas con estudiantes abren inscripción.");
    if (reporte.estado === "Cerrado") throw new AppError(409, "El reporte está cerrado.");
    const hoy = hoyBogota();
    const salida = new Date(reporte.fechaSalida);
    if (salida < hoy) throw new AppError(409, "La salida ya pasó: no se puede abrir inscripción.");
    // Las inscripciones cierran un dia antes de la salida (o hoy, si es manana).
    const limite = new Date(Math.max(hoy.getTime(), salida.getTime() - DIA_MS));
    const datos = datosSalida({
      nombre: reporte.evento || `Salida a ${reporte.destino}`,
      destino: reporte.destino,
      descripcion: reporte.motivo,
      responsable: reporte.responsableNombre,
      fechaSalida: iso(reporte.fechaSalida),
      fechaRegreso: iso(reporte.fechaRegreso || reporte.fechaSalida),
      horaSalida: reporte.horaSalida,
      horaRegreso: reporte.horaRegreso,
      cupos: Math.max(1, Number(reporte.numeroEstudiantes) || 1),
      fechaLimiteInscripcion: iso(limite),
    });
    const creada = await this.repos.salidas.crear({ ...datos, estado: publicar ? "Publicada" : "Borrador", reporteSstId: reporte.id, creadaPor: usuario?.emailInstitucional || null });
    return { salida: serializar(creada), creada: true };
  }

  // Salidas con estudiantes ya verificadas en SST que aun no tienen
  // convocatoria (p. ej. verificadas antes de existir este enlace): se publican.
  async publicarVerificadas() {
    const tipos = Object.keys(TIPOS).filter((t) => TIPOS[t].grupo === "estudiantes");
    const pendientes = await this.repos.reportesSst.buscar({ estado: "Verificado", tipo: { in: tipos }, fechaSalida: { gte: hoyBogota() }, convocatoria: { is: null } });
    for (const r of pendientes) await this.desdeReporte(r.id, null, { publicar: true }).catch(() => {});
  }

  // Cierre automatico: las salidas publicadas cuya fecha limite ya paso
  // pasan a "Cerrada" (los estudiantes ya no se pueden inscribir).
  async cerrarVencidas() {
    const vencidas = await this.repos.salidas.porFecha({ estado: "Publicada", fechaLimiteInscripcion: { lt: hoyBogota() } });
    for (const s of vencidas) await this.repos.salidas.actualizar(s.id, { estado: "Cerrada" });
    return vencidas.length;
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerOFallar(id);
    if (actual.estado === "Cancelada") throw new AppError(409, "La salida está cancelada y ya no se puede editar.");
    const datos = datosSalida(cuerpo, actual);
    const c = (await this.conteos([id])).get(id) || {};
    const ocupados = (c.Pendiente || 0) + (c.Aprobada || 0);
    if (datos.cupos < ocupados) throw new AppError(409, `Ya hay ${ocupados} estudiantes inscritos: los cupos no pueden ser menos.`);
    return serializar(await this.repos.salidas.actualizar(id, datos), c);
  }

  async cambiarEstado(id, estado) {
    if (!ESTADOS_SALIDA.includes(estado)) throw new AppError(400, `Estado no válido. Usa uno de: ${ESTADOS_SALIDA.join(", ")}.`);
    const actual = await this.obtenerOFallar(id);
    if (actual.estado === "Cancelada") throw new AppError(409, "La salida está cancelada.");
    return serializar(await this.repos.salidas.actualizar(id, { estado }), (await this.conteos([id])).get(id));
  }

  async eliminar(id) {
    await this.obtenerOFallar(id);
    if (await this.repos.inscripcionesSalida.contar({ salidaId: id })) throw new AppError(409, "La salida ya tiene inscripciones: cancélala en lugar de eliminarla.");
    await this.repos.salidas.eliminar(id);
    return { id, eliminada: true };
  }

  async inscripciones(salidaId) {
    await this.obtenerOFallar(salidaId);
    return (await this.repos.inscripcionesSalida.deSalida(salidaId, [{ fechaInscripcion: "asc" }])).map(publicaInscripcion);
  }

  async inscripcionDe(salidaId, inscripcionId) {
    const ins = await this.repos.inscripcionesSalida.buscarPorId(inscripcionId);
    if (!ins || ins.salidaId !== salidaId) throw new AppError(404, "La inscripción no existe.");
    return ins;
  }

  async revisarInscripcion(salidaId, inscripcionId, { estado, observacion } = {}, usuario) {
    if (!["Aprobada", "Rechazada", "Pendiente"].includes(estado)) throw new AppError(400, "Elige si apruebas o rechazas la inscripción.");
    const ins = await this.inscripcionDe(salidaId, inscripcionId);
    if (ins.estado === "Cancelada") throw new AppError(409, "El estudiante canceló esta inscripción.");
    const obs = texto(observacion, 1000);
    if (estado === "Rechazada" && !obs) throw new AppError(400, "Escribe el motivo del rechazo para que el estudiante sepa qué corregir.");
    const datos = { estado, observacion: obs, revisadoPor: usuario?.emailInstitucional || null, fechaRevision: new Date() };
    return publicaInscripcion(await this.repos.inscripcionesSalida.actualizar(inscripcionId, datos));
  }

  async comprobanteDe(salidaId, inscripcionId) {
    const ins = await this.inscripcionDe(salidaId, inscripcionId);
    const ruta = this.comprobantes.ruta(ins.comprobante);
    if (!this.comprobantes.existe(ruta)) throw new AppError(404, "La inscripción no tiene comprobante.");
    return { ruta, nombre: ins.comprobanteNombre || path.basename(ruta) };
  }

  // Listado en Excel para la ARL o el seguro (por defecto, solo aprobados).
  async listado(salidaId, { todos } = {}) {
    const salida = await this.obtenerOFallar(salidaId);
    const lista = (await this.repos.inscripcionesSalida.deSalida(salidaId, [{ nombre: "asc" }])).filter((i) => (todos ? i.estado !== "Cancelada" : i.estado === "Aprobada"));
    return generarListado(salida, lista, todos);
  }
}

module.exports = { SalidaService, salidaService: new SalidaService() };
