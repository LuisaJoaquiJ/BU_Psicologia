// Base de datos "en memoria" que imita el subconjunto de la API de Prisma que
// usa la aplicacion (Sprint 1: roles/usuarios; Sprint 2: servicios/horarios/
// citas; Sprint 3: gestion de horarios y asistencia; Sprint 4: eventos,
// inscripciones y asistencia a eventos; Sprint 5: usuarios y estadisticas).
// Permite correr las pruebas sin necesitar PostgreSQL instalado.

let roles = [];
let usuarios = [];
let servicios = [];
let horarios = [];
let citas = [];
let asistencias = [];
let eventos = [];
let inscripciones = [];
let asistenciasEvento = [];
let historial = [];
let contador = 0;
const { crearModelosSalud } = require("./salud.mock");
const salud = crearModelosSalud({ obtenerUsuarios: () => usuarios, siguienteId: () => ++contador });

function seedRoles() {
  roles = [
    { id: "rol-estudiante", nombre: "Estudiante" },
    { id: "rol-administrador", nombre: "Administrador" },
    { id: "rol-salud", nombre: "Salud" },
  ];
}

function seedServicios() {
  servicios = [
    {
      id: "servicio-1",
      nombre: "Orientación psicológica individual",
      descripcion: "Acompañamiento personalizado.",
      activo: true,
    },
  ];
}

function reset() {
  seedRoles();
  seedServicios();
  usuarios = [];
  horarios = [];
  citas = [];
  asistencias = [];
  eventos = [];
  inscripciones = [];
  asistenciasEvento = [];
  historial = [];
  salud.reset();
  contador = 0;
}
reset();

function clone(obj) {
  return obj ? { ...obj } : obj;
}

// Soporta tanto igualdad exacta como rangos { gte, lte } sobre fechas.
function cumpleFiltroFecha(valor, filtro) {
  if (filtro === undefined) return true;
  if (filtro instanceof Date || typeof filtro === "string") return mismaFecha(valor, filtro);
  if (filtro.gte && !(new Date(valor) >= new Date(filtro.gte))) return false;
  if (filtro.lte && !(new Date(valor) <= new Date(filtro.lte))) return false;
  return true;
}

function nombreRol(usuario) {
  return roles.find((r) => r.id === usuario.rolId)?.nombre;
}

function cumpleWhereUsuario(u, where = {}) {
  if (where.habilitado !== undefined && u.habilitado !== where.habilitado) return false;
  if (where.rol?.nombre && nombreRol(u) !== where.rol.nombre) return false;
  if (where.OR) {
    const coincide = where.OR.some((condicion) =>
      Object.entries(condicion).some(([campo, filtro]) =>
        String(u[campo] || "").toLowerCase().includes(String(filtro.contains).toLowerCase())
      )
    );
    if (!coincide) return false;
  }
  return true;
}

function conRol(usuario, include) {
  if (!usuario) return usuario;
  return include?.rol ? { ...usuario, rol: roles.find((r) => r.id === usuario.rolId) } : { ...usuario };
}

function mismaFecha(a, b) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function attachServicio(horario) {
  if (!horario) return horario;
  return { ...horario, servicio: clone(servicios.find((s) => s.id === horario.servicioId)) || null };
}

function attachRelacionesCita(cita) {
  if (!cita) return cita;
  const horario = horarios.find((h) => h.id === cita.horarioId);
  const usuario = usuarios.find((u) => u.id === cita.usuarioId);
  return {
    ...cita,
    horario: horario ? attachServicio(horario) : null,
    usuario: usuario ? clone(usuario) : null,
  };
}

function attachRelacionesInscripcion(inscripcion, include) {
  if (!inscripcion) return inscripcion;
  const resultado = { ...inscripcion };
  if (include?.usuario) resultado.usuario = clone(usuarios.find((u) => u.id === inscripcion.usuarioId)) || null;
  if (include?.evento) resultado.evento = clone(eventos.find((e) => e.id === inscripcion.eventoId)) || null;
  if (include?.asistencia) {
    resultado.asistencia = clone(asistenciasEvento.find((a) => a.inscripcionId === inscripcion.id)) || null;
  }
  return resultado;
}

function cumpleWhereInscripcion(i, where = {}) {
  if (where.id && i.id !== where.id) return false;
  if (where.usuarioId && i.usuarioId !== where.usuarioId) return false;
  if (where.eventoId && i.eventoId !== where.eventoId) return false;
  if (where.estado && i.estado !== where.estado) return false;
  return true;
}

function cumpleWhereEvento(e, where = {}) {
  if (where.id && e.id !== where.id) return false;
  if (where.estado && typeof where.estado === "string" && e.estado !== where.estado) return false;
  if (where.estado?.in && !where.estado.in.includes(e.estado)) return false;
  if (where.fecha && !cumpleFiltroFecha(e.fecha, where.fecha)) return false;
  return true;
}

function contarInscripcionesConfirmadas(eventoId) {
  return inscripciones.filter((i) => i.eventoId === eventoId && i.estado === "Confirmada").length;
}

function attachRelacionesEvento(evento, include) {
  if (!evento) return evento;
  const resultado = { ...evento };
  if (include?._count) {
    resultado._count = { inscripciones: contarInscripcionesConfirmadas(evento.id) };
  }
  if (include?.inscripciones) {
    const opciones = include.inscripciones === true ? {} : include.inscripciones;
    resultado.inscripciones = inscripciones
      .filter((i) => i.eventoId === evento.id && cumpleWhereInscripcion(i, opciones.where))
      .map((i) => attachRelacionesInscripcion(i, opciones.include));
  }
  return resultado;
}

const prisma = {
  rol: {
    findUnique: async ({ where }) => roles.find((r) => r.id === where.id || r.nombre === where.nombre) || null,
    findMany: async () => roles.map(clone),
  },
  usuario: {
    findMany: async ({ where, include } = {}) =>
      usuarios.filter((u) => cumpleWhereUsuario(u, where)).map((u) => conRol(u, include)),
    count: async ({ where } = {}) => usuarios.filter((u) => cumpleWhereUsuario(u, where)).length,
    update: async ({ where, data, include }) => {
      let actualizado = null;
      usuarios = usuarios.map((u) => {
        if (u.id === where.id) {
          actualizado = { ...u, ...data, fechaActualizacion: new Date() };
          return actualizado;
        }
        return u;
      });
      return conRol(actualizado, include);
    },
    findUnique: async ({ where, include }) => {
      const usuario = usuarios.find(
        (u) => u.id === where.id || u.emailInstitucional === where.emailInstitucional
      );
      if (!usuario) return null;
      return include?.rol ? { ...usuario, rol: roles.find((r) => r.id === usuario.rolId) } : usuario;
    },
    create: async ({ data, include }) => {
      contador += 1;
      const usuario = {
        id: `u-${contador}`,
        habilitado: true,
        fechaCreacion: new Date(),
        fechaActualizacion: new Date(),
        ...data,
      };
      usuarios.push(usuario);
      return include?.rol ? { ...usuario, rol: roles.find((r) => r.id === usuario.rolId) } : usuario;
    },
  },
  servicio: {
    findMany: async ({ where } = {}) => {
      let resultado = servicios;
      if (where?.activo !== undefined) resultado = resultado.filter((s) => s.activo === where.activo);
      return resultado.map(clone);
    },
    findUnique: async ({ where }) => clone(servicios.find((s) => s.id === where.id)) || null,
  },
  horario: {
    findMany: async ({ where } = {}) => {
      let resultado = horarios;
      if (where?.ocupado !== undefined) resultado = resultado.filter((h) => h.ocupado === where.ocupado);
      if (where?.fecha) resultado = resultado.filter((h) => cumpleFiltroFecha(h.fecha, where.fecha));
      if (where?.servicioId) resultado = resultado.filter((h) => h.servicioId === where.servicioId);
      return resultado.map(attachServicio);
    },
    findUnique: async ({ where }) => attachServicio(horarios.find((h) => h.id === where.id)) || null,
    updateMany: async ({ where, data }) => {
      let count = 0;
      horarios = horarios.map((h) => {
        if (h.id === where.id && (where.ocupado === undefined || h.ocupado === where.ocupado)) {
          count += 1;
          return { ...h, ...data };
        }
        return h;
      });
      return { count };
    },
    update: async ({ where, data }) => {
      let actualizado = null;
      horarios = horarios.map((h) => {
        if (h.id === where.id) {
          actualizado = { ...h, ...data };
          return actualizado;
        }
        return h;
      });
      return attachServicio(actualizado);
    },
    create: async ({ data }) => {
      contador += 1;
      const horario = { id: `horario-${contador}`, cupo: 1, ocupado: false, fechaCreacion: new Date(), ...data };
      horarios.push(horario);
      return attachServicio(horario);
    },
  },
  cita: {
    findFirst: async ({ where }) => {
      const encontrada = citas.find(
        (c) =>
          (!where.usuarioId || c.usuarioId === where.usuarioId) &&
          (!where.estado || c.estado === where.estado) &&
          (!where.horarioId || c.horarioId === where.horarioId)
      );
      return attachRelacionesCita(encontrada) || null;
    },
    findUnique: async ({ where }) => attachRelacionesCita(citas.find((c) => c.id === where.id)) || null,
    findMany: async ({ where } = {}) => {
      let resultado = citas;
      if (where?.usuarioId) resultado = resultado.filter((c) => c.usuarioId === where.usuarioId);
      if (where?.estado) resultado = resultado.filter((c) => c.estado === where.estado);
      if (where?.horario) {
        resultado = resultado.filter((c) => {
          const horario = horarios.find((h) => h.id === c.horarioId);
          if (!horario) return false;
          if (where.horario.fecha && !cumpleFiltroFecha(horario.fecha, where.horario.fecha)) return false;
          if (where.horario.servicioId && horario.servicioId !== where.horario.servicioId) return false;
          return true;
        });
      }
      return resultado.map(attachRelacionesCita);
    },
    create: async ({ data }) => {
      contador += 1;
      const cita = {
        id: `cita-${contador}`,
        fechaAgendamiento: new Date(),
        fechaActualizacion: new Date(),
        ...data,
      };
      citas.push(cita);
      return attachRelacionesCita(cita);
    },
    update: async ({ where, data }) => {
      let actualizada = null;
      citas = citas.map((c) => {
        if (c.id === where.id) {
          actualizada = { ...c, ...data };
          return actualizada;
        }
        return c;
      });
      return attachRelacionesCita(actualizada);
    },
  },
  asistenciaCita: {
    findUnique: async ({ where }) => clone(asistencias.find((a) => a.citaId === where.citaId)) || null,
    create: async ({ data }) => {
      contador += 1;
      const asistencia = { id: `asistencia-${contador}`, fechaRegistro: new Date(), ...data };
      asistencias.push(asistencia);
      return clone(asistencia);
    },
  },
  evento: {
    findMany: async ({ where, include } = {}) =>
      eventos.filter((e) => cumpleWhereEvento(e, where)).map((e) => attachRelacionesEvento(e, include)),
    findUnique: async ({ where, include }) =>
      attachRelacionesEvento(eventos.find((e) => e.id === where.id), include) || null,
    create: async ({ data, include }) => {
      contador += 1;
      const evento = { id: `evento-${contador}`, estado: "Borrador", fechaCreacion: new Date(), ...data };
      eventos.push(evento);
      return attachRelacionesEvento(evento, include);
    },
    update: async ({ where, data, include }) => {
      let actualizado = null;
      eventos = eventos.map((e) => {
        if (e.id === where.id) {
          actualizado = { ...e, ...data };
          return actualizado;
        }
        return e;
      });
      return attachRelacionesEvento(actualizado, include);
    },
    delete: async ({ where }) => {
      const evento = eventos.find((e) => e.id === where.id);
      eventos = eventos.filter((e) => e.id !== where.id);
      return clone(evento);
    },
  },
  inscripcion: {
    findUnique: async ({ where, include }) => {
      const clave = where.usuarioId_eventoId;
      const encontrada = clave
        ? inscripciones.find((i) => i.usuarioId === clave.usuarioId && i.eventoId === clave.eventoId)
        : inscripciones.find((i) => i.id === where.id);
      return attachRelacionesInscripcion(encontrada, include) || null;
    },
    findMany: async ({ where, include } = {}) =>
      inscripciones.filter((i) => cumpleWhereInscripcion(i, where)).map((i) => attachRelacionesInscripcion(i, include)),
    count: async ({ where } = {}) => inscripciones.filter((i) => cumpleWhereInscripcion(i, where)).length,
    create: async ({ data, include }) => {
      contador += 1;
      const inscripcion = { id: `inscripcion-${contador}`, estado: "Confirmada", fechaInscripcion: new Date(), ...data };
      inscripciones.push(inscripcion);
      return attachRelacionesInscripcion(inscripcion, include);
    },
    update: async ({ where, data, include }) => {
      let actualizada = null;
      inscripciones = inscripciones.map((i) => {
        if (i.id === where.id) {
          actualizada = { ...i, ...data };
          return actualizada;
        }
        return i;
      });
      return attachRelacionesInscripcion(actualizada, include);
    },
    deleteMany: async ({ where }) => {
      const antes = inscripciones.length;
      inscripciones = inscripciones.filter((i) => !cumpleWhereInscripcion(i, where));
      return { count: antes - inscripciones.length };
    },
  },
  asistenciaEvento: {
    findUnique: async ({ where }) =>
      clone(asistenciasEvento.find((a) => a.inscripcionId === where.inscripcionId)) || null,
    upsert: async ({ where, create, update }) => {
      const existente = asistenciasEvento.find((a) => a.inscripcionId === where.inscripcionId);
      if (existente) {
        Object.assign(existente, update);
        return clone(existente);
      }
      contador += 1;
      const asistencia = { id: `asistencia-evento-${contador}`, fechaRegistro: new Date(), ...create };
      asistenciasEvento.push(asistencia);
      return clone(asistencia);
    },
    deleteMany: async ({ where }) => {
      const ids = where?.inscripcion?.eventoId
        ? inscripciones.filter((i) => i.eventoId === where.inscripcion.eventoId).map((i) => i.id)
        : null;
      const antes = asistenciasEvento.length;
      asistenciasEvento = asistenciasEvento.filter((a) => !(ids ? ids.includes(a.inscripcionId) : true));
      return { count: antes - asistenciasEvento.length };
    },
  },
  historialEstado: {
    create: async ({ data }) => {
      contador += 1;
      const registro = { id: `historial-${contador}`, fecha: new Date(), ...data };
      historial.push(registro);
      return clone(registro);
    },
    findMany: async ({ where } = {}) =>
      historial.filter((h) => !where?.eventoId || h.eventoId === where.eventoId).map(clone),
    deleteMany: async ({ where } = {}) => {
      const antes = historial.length;
      historial = historial.filter((h) => where?.eventoId && h.eventoId !== where.eventoId);
      return { count: antes - historial.length };
    },
  },
  ...salud.modelos,
  // El mock no necesita aislamiento transaccional real para las pruebas:
  // basta con ejecutar el callback pasandole el propio objeto prisma.
  $transaction: async (fn) => fn(prisma),
  __seedEvento: (data) => {
    contador += 1;
    const evento = {
      id: `evento-${contador}`,
      nombre: "Evento de prueba",
      descripcion: null,
      lugar: "Auditorio",
      cupos: 10,
      estado: "Publicado",
      fechaCreacion: new Date(),
      horaInicio: new Date(Date.UTC(1970, 0, 1, 14, 0, 0)),
      horaFin: new Date(Date.UTC(1970, 0, 1, 16, 0, 0)),
      ...data,
    };
    eventos.push(evento);
    return evento;
  },
  __reset: reset,
  __saludTablas: salud.tablas,
  __seedServicio: (data) => {
    contador += 1;
    const servicio = { id: `servicio-${contador}`, activo: true, descripcion: null, ...data };
    servicios.push(servicio);
    return servicio;
  },
  __seedUsuario: (data) => {
    contador += 1;
    const usuario = {
      id: `u-${contador}`,
      habilitado: true,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
      ...data,
    };
    usuarios.push(usuario);
    return usuario;
  },
  __seedHorario: (data) => {
    contador += 1;
    const horario = {
      id: `horario-${contador}`,
      servicioId: servicios[0]?.id,
      cupo: 1,
      ocupado: false,
      fechaCreacion: new Date(),
      ...data,
    };
    horarios.push(horario);
    return horario;
  },
};

module.exports = { prisma };
