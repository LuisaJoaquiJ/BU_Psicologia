import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { fechaCorta, mensajeError } from "../../lib/salud";
import { Aviso, Campo, Encabezado, Insignia, Tarjeta, Vacio, botonPrimario, claseCampo } from "../salud/ui";

const COLOR = { "desarrollo-humano": "dorado", salud: "verde" };

// Accesos por modulo: el superadministrador asigna por correo quien del
// personal entra a cada modulo. Se puede asignar a alguien que todavia no ha
// iniciado sesion; al entrar por primera vez ya tendra su acceso.
export function AccesosPage() {
  const [params] = useSearchParams();
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState({ email: "", modulo: params.get("modulo") || "desarrollo-humano" });
  const [filtro, setFiltro] = useState(params.get("modulo") || "");
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [ocupado, setOcupado] = useState(false);

  function cargar() {
    return http
      .get("/super/accesos")
      .then((res) => setDatos(res.data))
      .catch((err) => setError(mensajeError(err, "No fue posible cargar los accesos.")));
  }
  useEffect(() => {
    cargar();
  }, []);

  async function asignar(e) {
    e.preventDefault();
    setError("");
    setExito("");
    setOcupado(true);
    try {
      const { data } = await http.post("/super/accesos", form);
      setExito(`${data.acceso.email} ahora puede entrar a ${datos.modulos[form.modulo]}.`);
      setForm({ ...form, email: "" });
      await cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible asignar el acceso."));
    } finally {
      setOcupado(false);
    }
  }

  async function quitar(acceso) {
    if (!window.confirm(`¿Quitar a ${acceso.email} del módulo ${datos.modulos[acceso.modulo]}?`)) return;
    setError("");
    setExito("");
    try {
      await http.delete(`/super/accesos/${acceso.id}`);
      await cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible quitar el acceso."));
    }
  }

  const modulos = datos?.modulos || {};
  const visibles = (datos?.accesos || []).filter((a) => !filtro || a.modulo === filtro);

  return (
    <main className="max-w-[1160px] mx-auto px-5 sm:px-8 pt-9 pb-16 flex flex-col gap-6">
      <Encabezado
        kicker="Superadministrador"
        titulo="Accesos por módulo"
        descripcion="Solo los correos asignados a un módulo pueden entrar a su panel. Quitar todos los accesos de una persona la devuelve a estudiante."
      />

      <Tarjeta titulo="Asignar personal a un módulo">
        <form onSubmit={asignar} className="grid gap-3 md:grid-cols-[1fr_280px_auto] items-end">
          <Campo etiqueta="Correo institucional">
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="nombre.apellido@uniautonoma.edu.co"
              className={claseCampo}
            />
          </Campo>
          <Campo etiqueta="Módulo">
            <select value={form.modulo} onChange={(e) => setForm({ ...form, modulo: e.target.value })} className={claseCampo}>
              {Object.entries(modulos).map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          </Campo>
          <button type="submit" disabled={ocupado || !datos} className={botonPrimario}>
            <Icono nombre="mas" size={18} strokeWidth={2.4} />
            {ocupado ? "Asignando..." : "Asignar acceso"}
          </button>
        </form>
        <div className="mt-4 flex flex-col gap-2">
          {error && <Aviso>{error}</Aviso>}
          {exito && <Aviso tono="verde">{exito}</Aviso>}
        </div>
      </Tarjeta>

      <Tarjeta
        titulo={`Personal con acceso (${visibles.length})`}
        acciones={
          <div className="flex gap-1.5 flex-wrap">
            {[["", "Todos"], ...Object.entries(modulos)].map(([id, nombre]) => (
              <button
                key={id || "todos"}
                type="button"
                onClick={() => setFiltro(id)}
                aria-pressed={filtro === id}
                className={`text-sm font-semibold rounded-full px-3.5 min-h-[36px] border ${
                  filtro === id ? "bg-primary text-white border-primary" : "bg-white text-ink-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {nombre}
              </button>
            ))}
          </div>
        }
      >
        {datos && visibles.length === 0 && <Vacio>No hay personal asignado{filtro ? " a este módulo" : ""}.</Vacio>}
        {visibles.length > 0 && (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-2 py-2 font-semibold">Correo</th>
                  <th className="px-2 py-2 font-semibold">Persona</th>
                  <th className="px-2 py-2 font-semibold">Módulo</th>
                  <th className="px-2 py-2 font-semibold">Asignado</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibles.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-2 py-3 font-semibold text-ink-900">{a.email}</td>
                    <td className="px-2 py-3 text-ink-600">
                      {a.usuario ? (
                        <>
                          {a.usuario.nombre}
                          {!a.usuario.habilitado && <Insignia tono="rojo" className="ml-2">Deshabilitado</Insignia>}
                        </>
                      ) : (
                        <span className="text-ink-500">Aún no ha iniciado sesión</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <Insignia tono={COLOR[a.modulo] || "azul"}>{modulos[a.modulo] || a.modulo}</Insignia>
                    </td>
                    <td className="px-2 py-3 text-ink-500 whitespace-nowrap">{fechaCorta(a.fechaAsignacion)}</td>
                    <td className="px-2 py-3 text-right">
                      <button type="button" onClick={() => quitar(a)} className="text-xs font-semibold text-ink-500 hover:text-red-700">
                        Quitar acceso
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </main>
  );
}
