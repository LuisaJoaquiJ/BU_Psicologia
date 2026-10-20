// Agenda de citas "en memoria" (servicios, horarios, citas, asistencias y
// tiempo no disponible). Cada modulo tiene la suya: se crea una para
// Desarrollo Humano (servicioDesarrollo, horarioDesarrollo...) y otra para
// Salud integral (servicioSalud, horarioSalud...), igual que en la base de datos.
const { cumpleWhere } = require("./salud.mock");

const clone = (obj) => (obj ? { ...obj } : obj);

function mismaFecha(a, b) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

// Igualdad exacta o rangos { gte, lte } sobre fechas.
function cumpleFiltroFecha(valor, filtro) {
  if (filtro === undefined) return true;
  if (filtro instanceof Date || typeof filtro === "string") return mismaFecha(valor, filtro);
  if (filtro.gte && !(new Date(valor) >= new Date(filtro.gte))) return false;
  if (filtro.lte && !(new Date(valor) <= new Date(filtro.lte))) return false;
  return true;
}

function crearAgenda({ sufijo, obtenerUsuarios, siguienteId }) {
  let servicios = [];
  let horarios = [];
  let citas = [];
  let asistencias = [];
  let bloqueos = [];

  const attachServicio = (h) => (h ? { ...h, servicio: clone(servicios.find((s) => s.id === h.servicioId)) || null } : h);
  const attachCita = (c) => {
    if (!c) return c;
    const horario = horarios.find((h) => h.id === c.horarioId);
    const usuario = obtenerUsuarios().find((u) => u.id === c.usuarioId);
    return { ...c, horario: horario ? attachServicio(horario) : null, usuario: usuario ? clone(usuario) : null };
  };
  const reemplazar = (lista, id, data) => {
    let actualizado = null;
    const nueva = lista.map((x) => (x.id === id ? (actualizado = { ...x, ...data }) : x));
    return [nueva, actualizado];
  };

  const modelos = {
    [`servicio${sufijo}`]: {
      findMany: async ({ where } = {}) => servicios.filter((s) => where?.activo === undefined || s.activo === where.activo).map(clone),
      findUnique: async ({ where }) => clone(servicios.find((s) => s.id === where.id)) || null,
      count: async () => servicios.length,
    },
    [`horario${sufijo}`]: {
      findMany: async ({ where } = {}) =>
        horarios
          .filter((h) => where?.ocupado === undefined || h.ocupado === where.ocupado)
          .filter((h) => !where?.fecha || cumpleFiltroFecha(h.fecha, where.fecha))
          .filter((h) => !where?.servicioId || h.servicioId === where.servicioId)
          .map(attachServicio),
      findUnique: async ({ where }) => attachServicio(horarios.find((h) => h.id === where.id)) || null,
      updateMany: async ({ where, data }) => {
        let count = 0;
        horarios = horarios.map((h) => {
          if (h.id !== where.id || (where.ocupado !== undefined && h.ocupado !== where.ocupado)) return h;
          count += 1;
          return { ...h, ...data };
        });
        return { count };
      },
      update: async ({ where, data }) => {
        const [lista, actualizado] = reemplazar(horarios, where.id, data);
        horarios = lista;
        return attachServicio(actualizado);
      },
      create: async ({ data }) => {
        const horario = { id: `horario-${siguienteId()}`, cupo: 1, ocupado: false, sinCita: false, fechaCreacion: new Date(), ...data };
        horarios.push(horario);
        return attachServicio(horario);
      },
    },
    [`cita${sufijo}`]: {
      findFirst: async ({ where }) =>
        attachCita(
          citas.find(
            (c) => (!where.usuarioId || c.usuarioId === where.usuarioId) && (!where.estado || c.estado === where.estado) && (!where.horarioId || c.horarioId === where.horarioId),
          ),
        ) || null,
      findUnique: async ({ where }) => attachCita(citas.find((c) => c.id === where.id)) || null,
      findMany: async ({ where } = {}) =>
        citas
          .filter((c) => !where?.usuarioId || c.usuarioId === where.usuarioId)
          .filter((c) => !where?.estado || c.estado === where.estado)
          .filter((c) => {
            if (!where?.horario) return true;
            const h = horarios.find((x) => x.id === c.horarioId);
            if (!h) return false;
            if (where.horario.fecha && !cumpleFiltroFecha(h.fecha, where.horario.fecha)) return false;
            return !where.horario.servicioId || h.servicioId === where.horario.servicioId;
          })
          .map(attachCita),
      create: async ({ data }) => {
        const cita = { id: `cita-${siguienteId()}`, fechaAgendamiento: new Date(), fechaActualizacion: new Date(), observaciones: null, ...data };
        citas.push(cita);
        return attachCita(cita);
      },
      update: async ({ where, data }) => {
        const [lista, actualizada] = reemplazar(citas, where.id, { ...data, fechaActualizacion: new Date() });
        citas = lista;
        return attachCita(actualizada);
      },
    },
    [`asistenciaCita${sufijo}`]: {
      findUnique: async ({ where }) => clone(asistencias.find((a) => a.citaId === where.citaId)) || null,
      create: async ({ data }) => {
        const asistencia = { id: `asistencia-${siguienteId()}`, fechaRegistro: new Date(), ...data };
        asistencias.push(asistencia);
        return clone(asistencia);
      },
    },
    [`bloqueo${sufijo}`]: {
      findMany: async ({ where } = {}) => bloqueos.filter((b) => cumpleWhere(b, where)).map(clone),
      findUnique: async ({ where }) => clone(bloqueos.find((b) => b.id === where.id)) || null,
      create: async ({ data }) => {
        const bloqueo = { id: `bloqueo-${siguienteId()}`, todoElDia: true, horaInicio: null, horaFin: null, detalle: null, creadoPor: null, fechaCreacion: new Date(), ...data };
        bloqueos.push(bloqueo);
        return clone(bloqueo);
      },
      delete: async ({ where }) => {
        const bloqueo = bloqueos.find((b) => b.id === where.id);
        bloqueos = bloqueos.filter((b) => b.id !== where.id);
        return clone(bloqueo);
      },
    },
  };

  return {
    modelos,
    reset(serviciosIniciales = []) {
      servicios = serviciosIniciales;
      horarios = [];
      citas = [];
      asistencias = [];
      bloqueos = [];
    },
    tieneServicio: (id) => servicios.some((s) => s.id === id),
    primerServicio: () => servicios[0]?.id,
    seedServicio(data) {
      const servicio = { id: `servicio-${siguienteId()}`, activo: true, descripcion: null, ...data };
      servicios.push(servicio);
      return servicio;
    },
    seedHorario(data) {
      const horario = { id: `horario-${siguienteId()}`, cupo: 1, ocupado: false, sinCita: false, fechaCreacion: new Date(), ...data };
      horarios.push(horario);
      return horario;
    },
    citas: () => citas,
    asistencias: () => asistencias,
  };
}

module.exports = { crearAgenda, cumpleFiltroFecha, mismaFecha };
