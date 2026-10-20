import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Icono } from "./comunes/componentes/Iconos";
import { useConfirmar } from "./comunes/componentes/Confirmar";
import { fechaCorta, mensajeError } from "./comunes/lib/salud";
import { Aviso, Campo, Encabezado, Insignia, Tarjeta, Vacio, botonPrimario, claseCampo } from "./comunes/componentes/ui";

const COLOR = { "desarrollo-humano": "dorado", salud: "verde", deporte: "azul" };
// El acceso de los docentes de Deporte depende de su ficha: se cambia desde
// Deporte > Docentes, no desde aqui.
const ACCESO_DOCENTE = "deporte-docente";

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
  // Fila que se esta editando: { id, modulo } con el modulo elegido.
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const { confirmar, avisar } = useConfirmar();

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

  async function cambiarModulo(acceso) {
    const nuevo = editando?.modulo;
    if (!nuevo || nuevo === acceso.modulo) return setEditando(null);
    const ok = await confirmar({
      titulo: "¿Cambiar el módulo de este acceso?",
      mensaje: "La persona dejará de entrar al módulo anterior y entrará al nuevo. No hace falta quitarle el acceso.",
      detalle: [
        ["Correo", acceso.email],
        ["Antes", modulos[acceso.modulo] || acceso.modulo],
        ["Ahora", modulos[nuevo]],
      ],
      boton: "Sí, cambiar módulo",
    });
    if (!ok) return;
    setError("");
    setExito("");
    setGuardando(true);
    try {
      await http.patch(`/super/accesos/${acceso.id}`, { modulo: nuevo });
      setEditando(null);
      await cargar();
      avisar(`${acceso.email} ahora entra a ${modulos[nuevo]}.`);
    } catch (err) {
      setError(mensajeError(err, "No fue posible cambiar el módulo."));
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(acceso) {
    const ok = await confirmar({
      titulo: "¿Quitar este acceso?",
      mensaje: "La persona ya no podrá entrar a este módulo. Si no le queda ningún otro, vuelve a ser estudiante.",
      detalle: [
        ["Correo", acceso.email],
        ["Módulo", modulos[acceso.modulo] || acceso.modulo],
      ],
      boton: "Sí, quitar acceso",
      peligro: true,
    });
    if (!ok) return;
    setError("");
    setExito("");
    try {
      await http.delete(`/super/accesos/${acceso.id}`);
      await cargar();
      avisar(`Se quitó el acceso de ${acceso.email}.`);
    } catch (err) {
      setError(mensajeError(err, "No fue posible quitar el acceso."));
    }
  }

  const modulos = datos?.modulos || {};
  // Modulos a los que se puede pasar un acceso (sin el de docentes).
  const destinos = Object.entries(modulos).filter(([id]) => id !== ACCESO_DOCENTE);
  const tieneModulo = (email, modulo) => (datos?.accesos || []).some((x) => x.email === email && x.modulo === modulo);
  const visibles = (datos?.accesos || []).filter((a) => !filtro || a.modulo === filtro);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      <Encabezado
        kicker="Superadministrador"
        titulo="Accesos por módulo"
        descripcion="Solo los correos asignados a un módulo pueden entrar a su panel. Con «Cambiar módulo» pasas a una persona de un módulo a otro sin quitarle el acceso. Quitar todos los accesos de una persona la devuelve a estudiante."
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
                  filtro === id ? "boton-liquido border-transparent" : "burbuja text-ink-600 hover:bg-white"
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
                      {editando?.id === a.id ? (
                        <select
                          autoFocus
                          aria-label={`Nuevo módulo para ${a.email}`}
                          value={editando.modulo}
                          onChange={(e) => setEditando({ id: a.id, modulo: e.target.value })}
                          onKeyDown={(e) => e.key === "Escape" && setEditando(null)}
                          className={`${claseCampo} !min-h-[40px] !py-1.5 min-w-[200px]`}
                        >
                          {destinos.map(([id, nombre]) => (
                            <option key={id} value={id} disabled={id !== a.modulo && tieneModulo(a.email, id)}>
                              {nombre}
                              {id === a.modulo ? " (actual)" : tieneModulo(a.email, id) ? " (ya lo tiene)" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Insignia tono={COLOR[a.modulo] || "azul"}>{modulos[a.modulo] || a.modulo}</Insignia>
                      )}
                    </td>
                    <td className="px-2 py-3 text-ink-500 whitespace-nowrap">{fechaCorta(a.fechaAsignacion)}</td>
                    <td className="px-2 py-3 text-right whitespace-nowrap">
                      {editando?.id === a.id ? (
                        <div className="inline-flex gap-2 items-center">
                          <button
                            type="button"
                            onClick={() => cambiarModulo(a)}
                            disabled={guardando || editando.modulo === a.modulo}
                            className="min-h-[36px] px-4 rounded-full boton-liquido text-xs font-bold disabled:opacity-50"
                          >
                            {guardando ? "Guardando..." : "Guardar"}
                          </button>
                          <button type="button" onClick={() => setEditando(null)} className="min-h-[36px] px-3 text-xs font-semibold text-ink-500 hover:text-ink-900">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex gap-4 items-center">
                          {a.modulo === ACCESO_DOCENTE ? (
                            <span className="text-xs text-ink-500" title="El acceso de los docentes se cambia desde Deporte › Docentes">
                              Se gestiona en Deporte
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditando({ id: a.id, modulo: a.modulo })}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <Icono nombre="editar" size={14} />
                              Cambiar módulo
                            </button>
                          )}
                          <button type="button" onClick={() => quitar(a)} className="text-xs font-semibold text-ink-500 hover:text-red-700">
                            Quitar acceso
                          </button>
                        </div>
                      )}
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
