// Base de datos "en memoria" que imita el subconjunto de la API de Prisma que
// usa el modulo de autenticacion. Permite correr las pruebas del Sprint 1 sin
// necesitar PostgreSQL instalado. En sprints siguientes conviene sumar una
// base de datos de pruebas real (por ejemplo con Docker) ademas de este mock.

let roles = [];
let usuarios = [];
let contador = 0;

function seedRoles() {
  roles = [
    { id: "rol-estudiante", nombre: "Estudiante" },
    { id: "rol-administrador", nombre: "Administrador" },
  ];
}

function reset() {
  seedRoles();
  usuarios = [];
  contador = 0;
}
reset();

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
};

module.exports = { prisma };
