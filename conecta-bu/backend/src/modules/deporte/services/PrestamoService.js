const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const inventario = require("./InventarioService");
const u = require("../utils");

// Prestamos de implementos (a estudiantes, docentes, grupos u otros) y su devolucion.
class PrestamoService {
  async prestar(id, cuerpo, registradoPor) {
    const implemento = await repos.implementos.buscarPorId(id);
    if (!implemento || !implemento.activo) throw new AppError(404, "El implemento no existe o está inactivo.");
    const cantidad = u.entero(cuerpo.cantidad, "La cantidad", 1, 10000);
    const { tipoResponsable, responsable, grupoId } = await this.responsable(cuerpo);
    const email = u.texto(cuerpo.responsableEmail, 120)?.toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, "El correo del responsable no es válido.");
    const devolucion = aFechaUTC(String(cuerpo.fechaDevolucionEsperada || "").slice(0, 10), "fecha de devolución");
    if (devolucion < hoyBogota()) throw new AppError(400, "La fecha de devolución no puede ser pasada.");
    const disponibles = await inventario.disponiblesDe(implemento);
    if (cantidad > disponibles) throw new AppError(409, `Solo hay ${disponibles} ${implemento.nombre.toLowerCase()} disponible(s).`, "SIN_EXISTENCIAS");
    await repos.prestamos.crear({
      implementoId: id,
      cantidad,
      tipoResponsable,
      responsable,
      responsableEmail: email,
      grupoId,
      fechaDevolucionEsperada: devolucion,
      observacion: u.texto(cuerpo.observacion, 300),
      registradoPor: registradoPor || null,
    });
    await inventario.registrarMovimiento(id, "Prestamo", cantidad, `A ${responsable}`, registradoPor);
    return inventario.detalle(id);
  }

  // A quien se presta: para un grupo, el nombre del grupo si no se escribe otro.
  async responsable(cuerpo) {
    const tipoResponsable = cuerpo.tipoResponsable || "Estudiante";
    if (!u.TIPOS_RESPONSABLE.includes(tipoResponsable)) throw new AppError(400, "El préstamo es a un Estudiante, Docente, Grupo u Otro.");
    let responsable = u.texto(cuerpo.responsable, 150);
    let grupoId = null;
    if (tipoResponsable === "Grupo") {
      const grupo = cuerpo.grupoId ? await repos.grupos.buscarPorId(cuerpo.grupoId) : null;
      if (!grupo) throw new AppError(400, "Elige el grupo.");
      grupoId = grupo.id;
      responsable = responsable || grupo.nombre;
    }
    if (!responsable) throw new AppError(400, "Escribe a quién se le presta.");
    return { tipoResponsable, responsable, grupoId };
  }

  // Cuantos vuelven bien, cuantos danados y cuantos se perdieron. Los perdidos
  // salen del inventario; los danados pasan a danados.
  async devolver(prestamoId, cuerpo, registradoPor) {
    const p = await repos.prestamos.buscarPorId(prestamoId);
    if (!p) throw new AppError(404, "El préstamo no existe.");
    if (p.fechaDevolucion) throw new AppError(409, "Este préstamo ya se devolvió.");
    const danados = u.entero(cuerpo.devueltosDanados ?? 0, "Los dañados", 0, p.cantidad);
    const perdidos = u.entero(cuerpo.perdidos ?? 0, "Los perdidos", 0, p.cantidad);
    const bien = cuerpo.devueltosBien === undefined ? p.cantidad - danados - perdidos : u.entero(cuerpo.devueltosBien, "Los devueltos en buen estado", 0, p.cantidad);
    if (bien + danados + perdidos !== p.cantidad) throw new AppError(400, `La suma debe ser ${p.cantidad}: buen estado + dañados + perdidos.`);
    const observacion = u.texto(cuerpo.observacion, 300);
    if ((danados || perdidos) && !observacion) throw new AppError(400, "Cuenta qué pasó con los dañados o perdidos.");

    const implemento = await repos.implementos.buscarPorId(p.implementoId);
    await repos.prestamos.actualizar(prestamoId, { fechaDevolucion: new Date(), devueltosBien: bien, devueltosDanados: danados, perdidos, observacion: observacion || p.observacion });
    await repos.implementos.actualizar(p.implementoId, { cantidadDanada: implemento.cantidadDanada + danados, cantidadTotal: implemento.cantidadTotal - perdidos });
    const detalle = `De ${p.responsable}: ${bien} bien${danados ? `, ${danados} dañado(s)` : ""}${perdidos ? `, ${perdidos} perdido(s)` : ""}${observacion ? `. ${observacion}` : ""}`;
    await inventario.registrarMovimiento(p.implementoId, "Devolucion", p.cantidad, detalle, registradoPor);
    return inventario.detalle(p.implementoId);
  }

  async activos() {
    const hoy = hoyBogota();
    const [{ activos }, implementos] = await Promise.all([inventario.prestados(), repos.implementos.listar()]);
    return activos
      .map((p) => ({
        ...p,
        fechaDevolucionEsperada: u.fechaISO(p.fechaDevolucionEsperada),
        implemento: implementos.find((i) => i.id === p.implementoId)?.nombre,
        vencido: new Date(p.fechaDevolucionEsperada) < hoy,
        diasRestantes: Math.round((new Date(p.fechaDevolucionEsperada) - hoy) / 864e5),
      }))
      .sort((a, b) => a.fechaDevolucionEsperada.localeCompare(b.fechaDevolucionEsperada));
  }

  // Datos del Excel del inventario: implementos, prestamos activos y movimientos.
  async datosExcel() {
    const [{ implementos }, prestamos, movimientos] = await Promise.all([inventario.listar(), this.activos(), repos.movimientos.listar({}, { fecha: "desc" })]);
    const nombre = new Map(implementos.map((i) => [i.id, i.nombre]));
    return { implementos, prestamos, movimientos: movimientos.map((m) => ({ ...m, implemento: nombre.get(m.implementoId) })) };
  }
}

module.exports = new PrestamoService();
