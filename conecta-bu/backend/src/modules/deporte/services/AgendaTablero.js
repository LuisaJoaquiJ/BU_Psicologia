const { mesActual, aDia, iso, hoyUTC } = require("../utils/periodosTablero");
const u = require("../utils");

// Partes del tablero que no dependen del periodo elegido: calendario del mes,
// proximos eventos, estado del inventario y actividad reciente.
const primerNombre = (n) => String(n || "Alguien").split(" ")[0];

class AgendaTablero {
  constructor(datos) {
    this.d = datos;
    this.hoy = hoyUTC();
  }

  // Clases dictadas y eventos por dia del mes en curso.
  calendario() {
    const mes = mesActual();
    const dias = {};
    const marcar = (fecha, campo) => {
      const dia = aDia(fecha);
      if (!dia || dia < mes.desde || dia > mes.hasta) return;
      const k = iso(dia);
      dias[k] = dias[k] || { clases: 0, eventos: 0 };
      dias[k][campo] += 1;
    };
    for (const s of this.d.sesiones) marcar(s.fecha, "clases");
    for (const e of this.d.eventos) if (e.estado !== "Cancelado" && e.estado !== "Borrador") marcar(e.fecha, "eventos");
    return { mes: mes.clave, hoy: mes.hoy, dias };
  }

  proximosEventos() {
    const inscritos = u.contarPor(this.d.inscEventos.filter((i) => i.estado === "Activa"), "eventoId");
    return this.d.eventos
      .filter((e) => e.estado === "Publicado" && aDia(e.fecha) >= this.hoy)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .slice(0, 5)
      .map((e) => ({ id: e.id, nombre: e.nombre, fecha: iso(aDia(e.fecha)), cupo: e.cupo, inscritos: inscritos.get(e.id) || 0 }));
  }

  // Lo que necesita atencion: prestamos, vencidos, bajo stock y danados.
  inventario() {
    const { implementos, prestamos } = this.d;
    const activos = prestamos.filter((x) => !x.fechaDevolucion);
    const enPrestamo = u.contarPor(activos, "implementoId", (x) => x.cantidad);
    const bajoStock = implementos.filter((i) => i.activo && i.stockMinimo > 0 && i.cantidadTotal - i.cantidadDanada - (enPrestamo.get(i.id) || 0) <= i.stockMinimo);
    return {
      unidades: implementos.filter((i) => i.activo).reduce((s, i) => s + i.cantidadTotal, 0),
      enPrestamo: activos.reduce((s, x) => s + x.cantidad, 0),
      prestamosActivos: activos.length,
      vencidos: activos.filter((x) => aDia(x.fechaDevolucionEsperada) < this.hoy).length,
      bajoStock: bajoStock.map((i) => ({ id: i.id, nombre: i.nombre })),
      danados: implementos.reduce((s, i) => s + i.cantidadDanada, 0),
    };
  }

  // Ultimos 8 movimientos del modulo.
  actividad() {
    const { sesiones, inscripciones, inscEventos, manuales, prestamos, implementos } = this.d;
    const grupo = u.porId(this.d.grupos);
    const evento = u.porId(this.d.eventos);
    const nombre = new Map(this.d.usuarios.map((x) => [x.id, x.nombre]));
    const quien = (id) => primerNombre(nombre.get(id));
    return [
      ...sesiones.map((s) => ({ tipo: "sesion", fecha: s.fechaRegistro, texto: `Asistencia registrada en ${grupo.get(s.grupoId)?.nombre || "un grupo"}`, detalle: s.tema || `${s.inicio} a ${s.fin}` })),
      ...inscripciones.map((i) => {
        const activa = i.estado === "Activa";
        return {
          tipo: activa ? "inscripcion" : "cancelada",
          fecha: activa ? i.fechaInscripcion : i.fechaRetiro || i.fechaInscripcion,
          texto: `${quien(i.usuarioId)} ${activa ? "se inscribió en" : "se retiró de"} ${grupo.get(i.grupoId)?.nombre || "un grupo"}`,
        };
      }),
      ...inscEventos.map((i) => ({ tipo: "inscripcion", fecha: i.fechaInscripcion, texto: `${quien(i.usuarioId)} se inscribió a un evento`, detalle: evento.get(i.eventoId)?.nombre })),
      ...manuales.map((m) => ({ tipo: "horas", fecha: m.fechaRegistro, texto: `${u.redondear(m.horas)} h reconocidas a ${quien(m.usuarioId)}`, detalle: m.motivo })),
      ...prestamos.map((x) => ({
        tipo: "prestamo",
        fecha: x.fechaDevolucion || x.fechaPrestamo,
        texto: `${x.fechaDevolucion ? "Devolución" : "Préstamo"} de ${x.cantidad} ${implementos.find((i) => i.id === x.implementoId)?.nombre || "implemento"}`,
        detalle: x.responsable,
      })),
    ]
      .filter((a) => a.fecha)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 8)
      .map((a) => ({ ...a, fecha: new Date(a.fecha).toISOString() }));
  }
}

module.exports = { AgendaTablero };
