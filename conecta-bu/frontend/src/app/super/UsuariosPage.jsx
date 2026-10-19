import { useEffect, useState } from "react";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";

const campo = "border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900";

// RF-012: el administrador consulta los usuarios registrados, cambia su rol y
// los habilita o deshabilita. El backend impide modificarse a si mismo y
// dejar el sistema sin administradores habilitados.
export function UsuariosPage() {
  const { usuario: yo } = useAuth();
  const [usuarios, setUsuarios] = useState(null);
  const [roles, setRoles] = useState([]);
  const [filtros, setFiltros] = useState({ busqueda: "", rol: "", habilitado: "" });
  const [error, setError] = useState("");
  const [accionando, setAccionando] = useState(null);

  function cargar(f = filtros) {
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    return http
      .get("/admin/usuarios", { params })
      .then((res) => {
        setUsuarios(res.data.usuarios);
        setRoles(res.data.roles);
      })
      .catch(() => setError("No fue posible cargar los usuarios."));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar(e) {
    e.preventDefault();
    setError("");
    cargar();
  }

  async function ejecutar(id, peticion) {
    setError("");
    setAccionando(id);
    try {
      await peticion();
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible guardar el cambio.");
    } finally {
      setAccionando(null);
    }
  }

  function cambiarRol(usuario, rol) {
    if (!window.confirm(`¿Cambiar el rol de ${usuario.nombre} a ${rol}?`)) return;
    ejecutar(usuario.id, () => http.patch(`/admin/usuarios/${usuario.id}/rol`, { rol }));
  }

  function alternarEstado(usuario) {
    const accion = usuario.habilitado ? "deshabilitar" : "habilitar";
    if (!window.confirm(`¿Seguro que quieres ${accion} a ${usuario.nombre}?`)) return;
    ejecutar(usuario.id, () =>
      http.patch(`/admin/usuarios/${usuario.id}/estado`, { habilitado: !usuario.habilitado })
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-3xl font-extrabold text-primary mb-1">Usuarios</h1>
      <p className="text-gray-500 mb-6">
        Consulta los usuarios de Conecta BU, habilítalos o deshabilítalos y define quién es superadministrador. El personal de cada
        módulo se asigna por correo en <a href="/super/accesos" className="font-semibold text-primary-soft">Accesos por módulo</a>.
      </p>

      <form onSubmit={buscar} className="flex items-end gap-3 mb-6 flex-wrap">
        <label className="flex flex-col gap-1 text-sm text-gray-600 grow sm:grow-0 sm:w-72">
          Buscar
          <input
            type="search"
            placeholder="Nombre o correo"
            value={filtros.busqueda}
            onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Rol
          <select value={filtros.rol} onChange={(e) => setFiltros({ ...filtros, rol: e.target.value })} className={campo}>
            <option value="">Todos</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Estado
          <select
            value={filtros.habilitado}
            onChange={(e) => setFiltros({ ...filtros, habilitado: e.target.value })}
            className={campo}
          >
            <option value="">Todos</option>
            <option value="true">Habilitados</option>
            <option value="false">Deshabilitados</option>
          </select>
        </label>
        <button
          type="submit"
          className="text-sm font-semibold boton-liquido rounded-full px-4 py-2"
        >
          Filtrar
        </button>
      </form>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 mb-6">{error}</p>}
      {!usuarios && !error && <p className="text-gray-500">Cargando usuarios...</p>}
      {usuarios && usuarios.length === 0 && <p className="text-gray-500">No hay usuarios para este filtro.</p>}

      {usuarios && usuarios.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="font-medium px-5 py-3">Usuario</th>
                <th className="font-medium px-5 py-3">Rol</th>
                <th className="font-medium px-5 py-3">Estado</th>
                <th className="font-medium px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => {
                const esYo = usuario.id === yo?.id;
                return (
                  <tr key={usuario.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-900">
                        {usuario.nombre} {esYo && <span className="text-xs text-gray-400">(tú)</span>}
                      </p>
                      <p className="text-xs text-gray-500">{usuario.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={usuario.rol}
                        disabled={esYo || accionando === usuario.id}
                        onChange={(e) => cambiarRol(usuario, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-ink-900 disabled:opacity-60"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {{ Administrador: "Personal (según accesos)", SuperAdministrador: "Superadministrador" }[r] || r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-medium rounded-full px-3 py-1 ${
                          usuario.habilitado ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {usuario.habilitado ? "Habilitado" : "Deshabilitado"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => alternarEstado(usuario)}
                        disabled={esYo || accionando === usuario.id}
                        className="text-sm border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {usuario.habilitado ? "Deshabilitar" : "Habilitar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
