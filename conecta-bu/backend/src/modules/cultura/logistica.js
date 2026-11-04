// Inventario (instrumentos, vestuario y equipos con prestamos) y pendientes de
// logistica del area de Arte y Cultura. Lo pidio el tablero de la coordinacion:
// "Inventario" como entrega propia y tareas como "gestionar bus" para Timbio.
const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { hoyBogota } = require("../../common/utils/fechas");
const { iso } = require("./periodo");
const { texto, fechaDia, entero, grupoONull } = require("./ampliacion");

const CATEGORIAS_ARTICULO = ["instrumento", "vestuario", "equipo", "otro"];
const CATEGORIAS_TAREA = ["logistica", "informe", "inventario", "otro"];

const opcional = (valor, max, etiqueta) => (valor === undefined || valor === null || String(valor).trim() === "" ? null : texto(valor, max, etiqueta));

function categoria(valor, lista, etiqueta) {
  const c = String(valor || "").toLowerCase();
  if (!lista.includes(c)) throw new AppError(400, `${etiqueta} debe ser ${lista.join(", ")}.`);
  return c;
}

function positivo(valor, etiqueta) {
  const n = entero(valor, etiqueta);
  if (n < 1) throw new AppError(400, `${etiqueta} debe ser al menos 1.`);
  return n;
}

// ---------- Inventario ----------

async function listarInventario() {
  const [articulos, prestamos, grupos] = await Promise.all([
    prisma.articuloCultural.findMany({ orderBy: { nombre: "asc" } }),
    prisma.prestamoCultural.findMany({ orderBy: { fechaPrestamo: "desc" } }),
    prisma.grupoCultural.findMany(),
  ]);
  const grupoDe = new Map(grupos.map((g) => [g.id, g.nombre]));
  const hoy = iso(hoyBogota());
  return articulos
    .filter((a) => a.activo)
    .map((a) => {
      const activos = prestamos.filter((p) => p.articuloId === a.id && !p.fechaDevolucion);
      const prestados = activos.reduce((t, p) => t + p.cantidad, 0);
      return {
        ...a,
        grupo: grupoDe.get(a.grupoId) || "",
        prestados,
        disponibles: Math.max(0, a.cantidadTotal - a.cantidadDanada - prestados),
        prestamos: activos.map((p) => ({
          ...p,
          fechaDevolucionEsperada: iso(p.fechaDevolucionEsperada),
          grupo: grupoDe.get(p.grupoId) || "",
          vencido: iso(p.fechaDevolucionEsperada) < hoy,
        })),
      };
    });
}

async function crearArticulo(body) {
  const total = positivo(body.cantidadTotal ?? 1, "La cantidad");
  return prisma.articuloCultural.create({
    data: {
      nombre: texto(body.nombre, 120, "el nombre del artículo"),
      categoria: categoria(body.categoria, CATEGORIAS_ARTICULO, "La categoría"),
      descripcion: opcional(body.descripcion, 1000, "la descripción"),
      ubicacion: opcional(body.ubicacion, 120, "la ubicación"),
      grupoId: await grupoONull(body.grupoId),
      cantidadTotal: total,
      cantidadDanada: 0,
    },
  });
}

async function actualizarArticulo(id, body) {
  const previo = await prisma.articuloCultural.findUnique({ where: { id } });
  if (!previo || !previo.activo) throw new AppError(404, "No se encontró el artículo.");
  const data = {};
  if (body.nombre !== undefined) data.nombre = texto(body.nombre, 120, "el nombre del artículo");
  if (body.categoria !== undefined) data.categoria = categoria(body.categoria, CATEGORIAS_ARTICULO, "La categoría");
  if (body.ubicacion !== undefined) data.ubicacion = opcional(body.ubicacion, 120, "la ubicación");
  if (body.grupoId !== undefined) data.grupoId = await grupoONull(body.grupoId);
  if (body.cantidadTotal !== undefined) data.cantidadTotal = positivo(body.cantidadTotal, "La cantidad");
  if (body.cantidadDanada !== undefined) data.cantidadDanada = entero(body.cantidadDanada, "La cantidad dañada");
  if (body.activo === false) data.activo = false;
  const total = data.cantidadTotal ?? previo.cantidadTotal;
  if ((data.cantidadDanada ?? previo.cantidadDanada) > total) throw new AppError(400, "Los dañados no pueden superar la cantidad total.");
  await prisma.articuloCultural.update({ where: { id }, data });
  return (await listarInventario()).find((a) => a.id === id) || { id, activo: false };
}

async function prestar(articuloId, body, email) {
  const articulo = (await listarInventario()).find((a) => a.id === articuloId);
  if (!articulo) throw new AppError(404, "No se encontró el artículo.");
  const cantidad = positivo(body.cantidad ?? 1, "La cantidad");
  if (cantidad > articulo.disponibles) throw new AppError(409, `Solo hay ${articulo.disponibles} disponibles de ${articulo.nombre}.`);
  const devolucion = fechaDia(body.fechaDevolucionEsperada, "La fecha de devolución");
  if (iso(devolucion) < iso(hoyBogota())) throw new AppError(400, "La fecha de devolución no puede ser anterior a hoy.");
  const correo = opcional(body.responsableEmail, 120, "el correo del responsable");
  if (correo && !/^\S+@\S+\.\S+$/.test(correo)) throw new AppError(400, "El correo del responsable no es válido.");
  return prisma.prestamoCultural.create({
    data: {
      articuloId,
      cantidad,
      responsable: texto(body.responsable, 150, "quién recibe el préstamo"),
      responsableEmail: correo ? correo.toLowerCase() : null,
      grupoId: await grupoONull(body.grupoId),
      motivo: opcional(body.motivo, 150, "el motivo"),
      fechaDevolucionEsperada: devolucion,
      registradoPor: email,
    },
  });
}

async function devolver(prestamoId, body) {
  const prestamo = await prisma.prestamoCultural.findUnique({ where: { id: prestamoId } });
  if (!prestamo) throw new AppError(404, "No se encontró el préstamo.");
  if (prestamo.fechaDevolucion) throw new AppError(409, "Este préstamo ya fue devuelto.");
  const danados = body.devueltosDanados === undefined || body.devueltosDanados === "" ? 0 : entero(body.devueltosDanados, "Los dañados");
  if (danados > prestamo.cantidad) throw new AppError(400, "Los dañados no pueden superar lo prestado.");
  await prisma.prestamoCultural.update({ where: { id: prestamoId }, data: { fechaDevolucion: new Date(), devueltosDanados: danados } });
  if (danados) {
    const articulo = await prisma.articuloCultural.findUnique({ where: { id: prestamo.articuloId } });
    await prisma.articuloCultural.update({ where: { id: articulo.id }, data: { cantidadDanada: Math.min(articulo.cantidadTotal, articulo.cantidadDanada + danados) } });
  }
  return (await listarInventario()).find((a) => a.id === prestamo.articuloId);
}

// ---------- Pendientes ----------

async function listarPendientes() {
  const [tareas, eventos, representaciones] = await Promise.all([
    prisma.tareaCultural.findMany({ orderBy: { fechaLimite: "asc" } }),
    prisma.eventoCultural.findMany(),
    prisma.representacionRed.findMany(),
  ]);
  const eventoDe = new Map(eventos.map((e) => [e.id, e.nombre]));
  const representacionDe = new Map(representaciones.map((r) => [r.id, r.nombre]));
  const hoy = iso(hoyBogota());
  return tareas.map((t) => {
    const limite = iso(t.fechaLimite);
    const dias = Math.round((new Date(`${limite}T00:00:00Z`) - new Date(`${hoy}T00:00:00Z`)) / 86400000);
    return {
      ...t,
      fechaLimite: limite,
      evento: eventoDe.get(t.eventoId) || "",
      representacion: representacionDe.get(t.representacionId) || "",
      vencida: !t.hecha && dias < 0,
      diasRestantes: dias,
    };
  });
}

async function vinculos(body, previo = {}) {
  const eventoId = body.eventoId !== undefined ? body.eventoId || null : previo.eventoId || null;
  const representacionId = body.representacionId !== undefined ? body.representacionId || null : previo.representacionId || null;
  if (eventoId && !(await prisma.eventoCultural.findUnique({ where: { id: eventoId } }))) throw new AppError(404, "No se encontró el evento.");
  if (representacionId && !(await prisma.representacionRed.findUnique({ where: { id: representacionId } }))) throw new AppError(404, "No se encontró la representación.");
  return { eventoId, representacionId };
}

async function crearPendiente(body, email) {
  const creada = await prisma.tareaCultural.create({
    data: {
      titulo: texto(body.titulo, 150, "qué hay que hacer"),
      detalle: opcional(body.detalle, 2000, "el detalle"),
      categoria: categoria(body.categoria || "logistica", CATEGORIAS_TAREA, "La categoría"),
      fechaLimite: fechaDia(body.fechaLimite, "La fecha límite"),
      responsable: opcional(body.responsable, 150, "el responsable"),
      ...(await vinculos(body)),
      creadaPor: email,
    },
  });
  return (await listarPendientes()).find((t) => t.id === creada.id);
}

async function actualizarPendiente(id, body) {
  const previa = await prisma.tareaCultural.findUnique({ where: { id } });
  if (!previa) throw new AppError(404, "No se encontró el pendiente.");
  const data = { ...(await vinculos(body, previa)) };
  if (body.titulo !== undefined) data.titulo = texto(body.titulo, 150, "qué hay que hacer");
  if (body.detalle !== undefined) data.detalle = opcional(body.detalle, 2000, "el detalle");
  if (body.categoria !== undefined) data.categoria = categoria(body.categoria, CATEGORIAS_TAREA, "La categoría");
  if (body.fechaLimite !== undefined) data.fechaLimite = fechaDia(body.fechaLimite, "La fecha límite");
  if (body.responsable !== undefined) data.responsable = opcional(body.responsable, 150, "el responsable");
  if (body.hecha !== undefined) {
    data.hecha = Boolean(body.hecha);
    data.fechaHecha = data.hecha ? new Date() : null;
  }
  await prisma.tareaCultural.update({ where: { id }, data });
  return (await listarPendientes()).find((t) => t.id === id);
}

async function borrarPendiente(id) {
  if (!(await prisma.tareaCultural.findUnique({ where: { id } }))) throw new AppError(404, "No se encontró el pendiente.");
  await prisma.tareaCultural.delete({ where: { id } });
  return { id };
}

module.exports = {
  CATEGORIAS_ARTICULO,
  CATEGORIAS_TAREA,
  listarInventario,
  crearArticulo,
  actualizarArticulo,
  prestar,
  devolver,
  listarPendientes,
  crearPendiente,
  actualizarPendiente,
  borrarPendiente,
};
