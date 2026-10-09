// Base de datos "en memoria" que imita el subconjunto de la API de Prisma que
// usa la aplicacion (Sprint 1: roles/usuarios; Sprint 2: servicios/horarios/
// citas; Sprint 3: gestion de horarios y asistencia). Permite correr las
// pruebas sin necesitar PostgreSQL instalado.

let roles = [];
let usuarios = [];
let servicios = [];
let horarios = [];
let citas = [];
let asistencias = [];
let contador = 0;

function seedRoles() {
  roles = [
    { id: "rol-estudiante", nombre: "Estudiante" },
    { id: "rol-administrador", nombre: "Administrador" },
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
  contador = 0;
}
reset();

function clone(obj) {
  return obj ? { ...obj } : obj;
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

const prisma = {
  rol: {
    findUnique: async ({ where }) => roles.find((r) => r.id === where.id || r.nombre === where.nombre) || null,
  },
  usuario: {
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
      if (where?.fecha?.gte) resultado = resultado.filter((h) => h.fecha >= where.fecha.gte);
      if (where?.fecha && !where.fecha.gte) resultado = resultado.filter((h) => mismaFecha(h.fecha, where.fecha));
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
          if (where.horario.fecha && !mismaFecha(horario.fecha, where.horario.fecha)) return false;
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
  // El mock no necesita aislamiento transaccional real para las pruebas:
  // basta con ejecutar el callback pasandole el propio objeto prisma.
  $transaction: async (fn) => fn(prisma),
  __reset: reset,
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
