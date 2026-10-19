const r = require("./SuperRepositories");

// Repositorios del superadministrador con el cliente normal de Prisma.
module.exports = {
  usuarios: new r.UsuarioRepository(),
  roles: new r.RolRepository(),
  accesos: new r.AccesoRepository(),
};
