import { useEffect, useState } from "react";
import { Aviso, Campo, Encabezado, Tarjeta, botonPrimario, botonSecundario, claseCampo } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { Icono } from "../../comunes/componentes/Iconos";
import { SelectorFoto, fotoInicial, guardarFoto } from "../../comunes/componentes/SelectorFoto";
import { BotonFlotante, Ventana } from "../../comunes/componentes/Ventana";
import { http } from "../../../../lib/api/http";
import { mensajeError } from "../../comunes/lib/salud";
import { SelectorCategorias } from "../../comunes/Pastillas";
import { IconoDisciplina } from "../../comunes/Progreso";
import { useCatalogosDeporte } from "../../comunes/useCatalogosDeporte";

// Disciplinas (con foto y categorías) y requisito de horas.

export function DisciplinasPage() {
  const { cat, recargar } = useCatalogosDeporte();
  const [nueva, setNueva] = useState({ nombre: "", tipo: "Individual", descripcion: "" });
  const [creandoDisciplina, setCreandoDisciplina] = useState(false);
  const [fotoNueva, setFotoNueva] = useState(() => fotoInicial(null));
  // Disciplina a la que se le cambia la foto: { d, foto }.
  const [cambiandoFoto, setCambiandoFoto] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    if (cat && !config) setConfig(cat.config);
  }, [cat, config]);

  const { confirmar, avisar } = useConfirmar();
  async function accion(pregunta, hacer, mensaje) {
    if (pregunta && !(await confirmar(pregunta))) return false;
    setError("");
    setAviso("");
    try {
      await hacer();
      await recargar();
      setAviso(mensaje);
      avisar(mensaje);
      return true;
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar."));
      return false;
    }
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-28">
      <Encabezado kicker="Deporte" titulo="Disciplinas y requisito" descripcion="Las disciplinas que oferta la Universidad, qué categorías pueden inscribirse en cada una (toca para activar o quitar) y las horas que cada estudiante debe completar." />
      {error && (
        <div className="mb-5">
          <Aviso>{error}</Aviso>
        </div>
      )}
      {aviso && (
        <div className="mb-5">
          <Aviso tono="verde">{aviso}</Aviso>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] items-start">
        <Tarjeta titulo="Disciplinas">
          <ul className="list-none m-0 p-0">
            {cat?.disciplinas.map((d) => (
              <li key={d.id} className={`flex items-center gap-3 py-3 border-t border-gray-100 first:border-t-0 ${d.activa ? "" : "opacity-60"}`}>
                <button
                  type="button"
                  onClick={() => setCambiandoFoto({ d, foto: fotoInicial(d.imagenUrl) })}
                  className="relative group shrink-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`${d.imagenUrl ? "Cambiar" : "Agregar"} la foto de ${d.nombre}`}
                  title={d.imagenUrl ? "Cambiar foto" : "Agregar foto"}
                >
                  <IconoDisciplina nombre={d.nombre} tamano={56} imagen={d.imagenUrl} />
                  <span className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-white border border-gray-200 text-primary grid place-items-center shadow-sm group-hover:bg-primary group-hover:text-white">
                    <Icono nombre="imagen" size={13} />
                  </span>
                </button>
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block font-bold text-ink-900">{d.nombre}</span>
                  <span className="block text-xs text-ink-500 truncate">
                    {d.tipo}
                    {d.descripcion ? ` · ${d.descripcion}` : ""}
                  </span>
                  <span className="block mt-2">
                    <SelectorCategorias
                      categorias={cat.categorias}
                      valor={d.categorias || []}
                      onCambio={(c) =>
                        accion(
                          { titulo: `¿Cambiar quién puede inscribirse en ${d.nombre}?`, mensaje: "Aplica a nuevas inscripciones; quienes ya están inscritos se mantienen.", detalle: [["Antes", d.categorias?.length ? d.categorias.join(", ") : "Todas"], ["Ahora", c.length ? c.join(", ") : "Todas"]], boton: "Sí, cambiar" },
                          () => http.patch(`/deporte/admin/disciplinas/${d.id}`, { categorias: c }),
                          c.length ? `${d.nombre}: solo ${c.join(" y ").toLowerCase()}.` : `${d.nombre}: abierta a todas las categorías.`
                        )
                      }
                    />
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    accion(
                      d.activa
                        ? { titulo: `¿Desactivar ${d.nombre}?`, mensaje: "Deja de aparecer en la oferta y no se podrán crear grupos nuevos. Los grupos actuales y las horas se conservan.", boton: "Sí, desactivar", peligro: true }
                        : { titulo: `¿Activar ${d.nombre}?`, mensaje: "Vuelve a aparecer en la oferta.", boton: "Sí, activar" },
                      () => http.patch(`/deporte/admin/disciplinas/${d.id}`, { activa: !d.activa }),
                      d.activa ? `${d.nombre} quedó oculta para nuevos grupos.` : `${d.nombre} está activa.`
                    )
                  }
                  className={`${botonSecundario} min-h-[36px] text-[13px]`}
                >
                  {d.activa ? "Desactivar" : "Activar"}
                </button>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-3 pt-3 border-t border-gray-100 text-xs text-ink-500">Toca la foto o el icono de una disciplina para cambiar su foto. Los estudiantes la ven en la oferta de grupos.</p>
        </Tarjeta>
        {!creandoDisciplina && <BotonFlotante onClick={() => setCreandoDisciplina(true)}>Nueva disciplina</BotonFlotante>}
        {cambiandoFoto && (
          <Ventana titulo={`Foto de ${cambiandoFoto.d.nombre}`} alCerrar={() => setCambiandoFoto(null)} ancho="sm:max-w-[640px]">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const { d, foto } = cambiandoFoto;
                const quitando = foto.quitar && !foto.archivo;
                if (!foto.archivo && !quitando) return setCambiandoFoto(null);
                const ok = await accion(
                  quitando
                    ? { titulo: `¿Quitar la foto de ${d.nombre}?`, mensaje: "Se volverá a mostrar el icono de la disciplina.", boton: "Sí, quitar", peligro: true }
                    : { titulo: `¿Guardar la nueva foto de ${d.nombre}?`, mensaje: "Los estudiantes la verán en la oferta de grupos.", detalle: [["Archivo", foto.archivo.name]], boton: "Sí, guardar" },
                  async () => {
                    const fallo = await guardarFoto(`/deporte/admin/disciplinas/${d.id}/imagen`, foto, d.imagenUrl);
                    if (fallo) throw new Error(fallo);
                  },
                  quitando ? `Se quitó la foto de ${d.nombre}.` : `Foto de ${d.nombre} actualizada.`
                );
                if (ok) setCambiandoFoto(null);
              }}
              className="flex flex-col gap-4"
            >
              <SelectorFoto foto={cambiandoFoto.foto} onCambio={(foto) => setCambiandoFoto((c) => ({ ...c, foto }))} etiqueta="Foto de portada" alto="h-[200px]" />
              <div className="flex gap-2">
                <button type="submit" className={botonPrimario}>
                  Guardar foto
                </button>
                <button type="button" onClick={() => setCambiandoFoto(null)} className={botonSecundario}>
                  Cancelar
                </button>
              </div>
            </form>
          </Ventana>
        )}
        {creandoDisciplina && (
          <Ventana titulo="Nueva disciplina" alCerrar={() => setCreandoDisciplina(false)} ancho="sm:max-w-[760px]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                accion(
                  { titulo: `¿Agregar la disciplina ${nueva.nombre}?`, detalle: [["Tipo", nueva.tipo], ["Descripción", nueva.descripcion], ["Foto", fotoNueva.archivo ? fotoNueva.archivo.name : "Sin foto (se usa el icono)"]], boton: "Sí, agregar" },
                  async () => {
                    const r = await http.post("/deporte/admin/disciplinas", nueva);
                    const fallo = await guardarFoto(`/deporte/admin/disciplinas/${r.data.disciplina.id}/imagen`, fotoNueva, null);
                    if (fallo) avisar(`${nueva.nombre} quedó agregada. ${fallo}`, "error");
                  },
                  `${nueva.nombre} agregada.`
                ).then((ok) => {
                  if (ok) {
                    setNueva({ nombre: "", tipo: "Individual", descripcion: "" });
                    setFotoNueva(fotoInicial(null));
                    setCreandoDisciplina(false);
                  }
                });
              }}
              className="grid gap-3 sm:grid-cols-[1.2fr_1fr]"
            >
            <Campo etiqueta="Nombre">
              <input required maxLength={80} value={nueva.nombre} onChange={(e) => setNueva((n) => ({ ...n, nombre: e.target.value }))} placeholder="Taekwondo" className={claseCampo} />
            </Campo>
            <Campo etiqueta="Tipo">
              <select value={nueva.tipo} onChange={(e) => setNueva((n) => ({ ...n, tipo: e.target.value }))} className={claseCampo}>
                {(cat?.tipos || []).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Descripción (opcional)" className="sm:col-span-2">
              <input maxLength={600} value={nueva.descripcion} onChange={(e) => setNueva((n) => ({ ...n, descripcion: e.target.value }))} className={claseCampo} />
            </Campo>
            <div className="sm:col-span-2">
              <SelectorFoto foto={fotoNueva} onCambio={setFotoNueva} etiqueta="Foto de portada (opcional)" ayuda="JPG, PNG o WEBP, hasta 5 MB. Los estudiantes la ven en la oferta." />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={botonPrimario}>
                <Icono nombre="mas" size={16} strokeWidth={2.4} /> Agregar
              </button>
              <button type="button" onClick={() => setCreandoDisciplina(false)} className={`${botonSecundario} ml-2`}>
                Cancelar
              </button>
            </div>
            </form>
          </Ventana>
        )}
        <Tarjeta titulo="Requisito de horas">
          {config && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                accion(
                  { titulo: "¿Cambiar el requisito de horas?", mensaje: "Cambia el avance que ve cada estudiante y quiénes cumplen.", detalle: [["Horas requeridas", `${cat.config.horasRequeridas} → ${config.horasRequeridas}`], ["Máx. grupos por periodo", `${cat.config.maxGruposPorPeriodo} → ${config.maxGruposPorPeriodo}`]], boton: "Sí, cambiar" },
                  () => http.put("/deporte/admin/config", { horasRequeridas: Number(config.horasRequeridas), maxGruposPorPeriodo: Number(config.maxGruposPorPeriodo) }),
                  "Requisito actualizado."
                );
              }}
              className="flex flex-col gap-3"
            >
              <Campo etiqueta="Horas que debe completar cada estudiante">
                <input type="number" min="1" max="500" required value={config.horasRequeridas} onChange={(e) => setConfig((c) => ({ ...c, horasRequeridas: e.target.value }))} className={claseCampo} />
              </Campo>
              <Campo etiqueta="Máximo de grupos por estudiante en un periodo">
                <input type="number" min="1" max="10" required value={config.maxGruposPorPeriodo} onChange={(e) => setConfig((c) => ({ ...c, maxGruposPorPeriodo: e.target.value }))} className={claseCampo} />
              </Campo>
              <button type="submit" className={botonPrimario}>
                Guardar
              </button>
            </form>
          )}
        </Tarjeta>
      </div>
    </main>
  );
}
