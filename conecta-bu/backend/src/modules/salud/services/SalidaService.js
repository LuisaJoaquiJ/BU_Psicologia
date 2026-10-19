const path = require("path");
const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { ESTADOS_SALIDA, texto, datosSalida, serializar, publicaInscripcion } = require("../utils/salidas");
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
