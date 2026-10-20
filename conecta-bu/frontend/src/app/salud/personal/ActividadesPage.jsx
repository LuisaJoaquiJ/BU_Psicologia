import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { fechaCorta, mensajeError, refrescarCatalogos, useCatalogos } from "../comunes/lib/salud";
import { claseCampoCorto, Aviso, Campo, Encabezado, Insignia, Tarjeta, Vacio, botonDorado, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";

const SEMAFORO = (c) => (c === null || c === undefined ? null : c >= 90 ? "verde" : c >= 60 ? "dorado" : "rojo");

export function FormularioActividad({ inicial = {}, catalogos, periodo, onGuardada, onCancelar }) {
  const [form, setForm] = useState({
    nombre: "",
    categoria: "PromocionPrevencion",
    permanente: false,
    clinica: false,
    meta: 1,
    tipoSnies: 1,
    fechaInicio: "",
    fechaFin: "",
    responsableDocumento: "",
    horasDedicacion: "",
    presupuesto: "",
    avances: "",
    dificultades: "",
    aprendizajes: "",
    observaciones: "",
    publicada: false,
    lugar: "",
    horaInicio: "",
    horaFin: "",
    cupos: "",
    descripcion: "",
    ...Object.fromEntries(Object.entries(inicial).map(([k, v]) => [k, v ?? ""])),
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    const datos = { ...form };
    for (const k of ["fechaInicio", "fechaFin"]) datos[k] = datos[k] ? String(datos[k]).slice(0, 10) : undefined;
    try {
      const { data } = inicial.id
        ? await http.patch(`/salud/actividades/${inicial.id}`, datos)
        : await http.post("/salud/actividades", { ...datos, periodo });
      onGuardada(data.actividad);
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar la actividad."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre *" className="sm:col-span-2">
          <input required value={form.nombre} onChange={cambiar("nombre")} className={claseCampo} placeholder="Ej. Tamizaje visual" />
        </Campo>
        <Campo etiqueta="Línea de acción">
          <select value={form.categoria} onChange={cambiar("categoria")} className={claseCampo}>
            {Object.entries(catalogos?.categorias || {}).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Meta (jornadas en el periodo)">
          <input type="number" min="0" value={form.meta} onChange={cambiar("meta")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Fecha de inicio" ayuda="En jornadas se ajusta sola con los registros.">
          <input type="date" value={String(form.fechaInicio).slice(0, 10)} onChange={cambiar("fechaInicio")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Fecha final">
          <input type="date" value={String(form.fechaFin).slice(0, 10)} onChange={cambiar("fechaFin")} className={claseCampo} />
        </Campo>
        <label className="flex gap-2.5 items-center text-sm font-semibold text-ink-600">
          <input type="checkbox" checked={form.permanente} onChange={cambiar("permanente")} className="w-4 h-4 accent-primary" />
          Servicio permanente (todo el periodo)
        </label>
        <label className="flex gap-2.5 items-center text-sm font-semibold text-ink-600">
          <input type="checkbox" checked={form.clinica} onChange={cambiar("clinica")} className="w-4 h-4 accent-primary" />
          Pide signos vitales (enfermería)
        </label>
      </div>

      <fieldset className="rounded-2xl border border-gray-200 p-4 m-0">
        <label className="flex gap-2.5 items-center text-sm font-bold text-ink-900 cursor-pointer">
          <input type="checkbox" checked={form.publicada} onChange={cambiar("publicada")} className="w-4 h-4 accent-primary" />
          Publicar para que los estudiantes se inscriban
        </label>
        <p className="m-0 mt-1 ml-[26px] text-xs text-ink-500">Aparece en Mi Salud → Jornadas y campañas hasta la fecha final.</p>
        {form.publicada && (
          <div className="grid gap-3 sm:grid-cols-2 mt-4">
            <Campo etiqueta="Lugar" className="sm:col-span-2">
              <input value={form.lugar} onChange={cambiar("lugar")} className={claseCampo} placeholder="Ej. Bloque A, primer piso" />
            </Campo>
            <Campo etiqueta="Hora de inicio">
              <input type="time" value={form.horaInicio} onChange={cambiar("horaInicio")} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Hora final">
              <input type="time" value={form.horaFin} onChange={cambiar("horaFin")} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Cupos" ayuda="Vacío = sin límite.">
              <input type="number" min="1" value={form.cupos} onChange={cambiar("cupos")} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Descripción para los estudiantes" className="sm:col-span-2">
              <textarea value={form.descripcion} onChange={cambiar("descripcion")} rows={2} className={`${claseCampo} py-2.5`} placeholder="Qué se hará y qué deben llevar." />
            </Campo>
          </div>
        )}
      </fieldset>

      <details className="rounded-2xl border border-gray-200 p-4">
        <summary className="cursor-pointer font-bold text-primary text-sm">Datos para SNIES e informe de gestión</summary>
        <div className="grid gap-3 sm:grid-cols-2 mt-4">
          <Campo etiqueta="Documento del responsable" ayuda="Recurso humano en el reporte SNIES.">
            <input value={form.responsableDocumento} onChange={cambiar("responsableDocumento")} inputMode="numeric" className={claseCampo} />
          </Campo>
          <Campo etiqueta="Horas de dedicación">
            <input type="number" min="0" value={form.horasDedicacion} onChange={cambiar("horasDedicacion")} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Tipo de actividad SNIES" ayuda="1 = salud; 5 = deporte/recreación (según el reporte).">
            <input type="number" min="1" value={form.tipoSnies} onChange={cambiar("tipoSnies")} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Presupuesto ejecutado ($)">
            <input type="number" min="0" value={form.presupuesto} onChange={cambiar("presupuesto")} className={claseCampo} />
          </Campo>
          {["avances", "dificultades", "aprendizajes", "observaciones"].map((campo) => (
            <Campo key={campo} etiqueta={campo.charAt(0).toUpperCase() + campo.slice(1)} className="sm:col-span-2">
              <textarea value={form[campo]} onChange={cambiar(campo)} rows={2} className={`${claseCampo} py-2.5`} />
            </Campo>
          ))}
        </div>
      </details>

      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2.5 flex-wrap">
        <button type="submit" disabled={guardando} className={botonPrimario}>
          {guardando ? "Guardando..." : inicial.id ? "Guardar cambios" : "Crear actividad"}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className={botonSecundario}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

// Actividades del periodo con su seguimiento: asistentes, jornadas frente a
// la meta (semaforo del informe de gestion) y evidencias.
export function ActividadesPage() {
  const catalogos = useCatalogos();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [actividades, setActividades] = useState(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const [copiando, setCopiando] = useState(false);

  useEffect(() => {
    if (catalogos && !periodo) setPeriodo(catalogos.periodoActual);
  }, [catalogos, periodo]);

  function cargar() {
    if (!periodo) return;
    setActividades(null);
    http
      .get("/salud/actividades", { params: { periodo, incluirInactivas: true } })
      .then((res) => setActividades(res.data.actividades))
      .catch((err) => setError(mensajeError(err, "No fue posible cargar las actividades.")));
  }
  useEffect(cargar, [periodo]);

  const anterior = catalogos?.periodos?.find((p) => p < periodo);
  async function copiarCatalogo() {
    setCopiando(true);
    setError("");
    try {
      await http.post("/salud/actividades/copiar-periodo", { origen: anterior, destino: periodo });
      refrescarCatalogos();
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible copiar el catálogo."));
    } finally {
      setCopiando(false);
    }
  }

  const visibles = (actividades || []).filter((a) => !categoria || a.categoria === categoria);
  const categoriasConDatos = [...new Set((actividades || []).map((a) => a.categoria))];

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <Encabezado
        kicker="Salud integral"
        titulo="Actividades"
        descripcion="Servicios permanentes y jornadas del periodo, con su código SNIES, meta, asistentes y evidencias."
        acciones={
          <>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={`${claseCampoCorto} min-h-[46px] font-semibold`} aria-label="Periodo">
              {[...new Set([...(catalogos?.periodos || []), periodo].filter(Boolean))].sort().reverse().map((p) => (
                <option key={p} value={p}>
                  Periodo {p}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setCreando(true)} className={botonDorado}>
              <Icono nombre="mas" size={18} strokeWidth={2.4} />
              Nueva actividad
            </button>
          </>
        }
      />

      {error && <div className="mb-5"><Aviso>{error}</Aviso></div>}

      {creando && (
        <Tarjeta titulo={`Nueva actividad · ${periodo}`} className="mb-6">
          <FormularioActividad
            catalogos={catalogos}
            periodo={periodo}
            onCancelar={() => setCreando(false)}
            onGuardada={(a) => {
              setCreando(false);
              navigate(`/salud/actividades/${a.id}`);
            }}
          />
        </Tarjeta>
      )}

      {actividades && actividades.length === 0 && (
        <Tarjeta>
          <Vacio>No hay actividades en {periodo}.</Vacio>
          {anterior && (
            <button type="button" disabled={copiando} onClick={copiarCatalogo} className={`${botonPrimario} mt-4`}>
              {copiando ? "Copiando..." : `Copiar el catálogo de ${anterior}`}
            </button>
          )}
        </Tarjeta>
      )}

      {categoriasConDatos.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-5">
          {["", ...categoriasConDatos].map((c) => (
            <button
              key={c || "todas"}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={`text-sm font-semibold rounded-full px-4 min-h-[38px] border ${
                categoria === c ? "boton-liquido border-transparent" : "burbuja text-ink-600 hover:bg-white"
              }`}
            >
              {c ? catalogos?.categorias?.[c] : "Todas"}
            </button>
          ))}
        </div>
      )}

      {!actividades && <div className="h-40 bg-white/60 border border-gray-200 rounded-xl animate-pulse" />}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {visibles.map((a) => {
          const ind = a.indicadores;
          const tono = SEMAFORO(ind.cumplimiento);
          return (
            <Link
              key={a.id}
              to={`/salud/actividades/${a.id}`}
              className={`group bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(11,42,91,0.1)] transition-all ${
                a.activa ? "" : "opacity-60"
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <span className="text-xs font-bold text-ink-500 tabular-nums">Cód. {a.codigo}</span>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {a.permanente ? <Insignia tono="gris">Permanente</Insignia> : <Insignia tono="azul">Jornada</Insignia>}
                  {a.clinica && <Insignia tono="verde">Enfermería</Insignia>}
                  {!a.activa && <Insignia tono="rojo">Inactiva</Insignia>}
                </div>
              </div>
              <div>
                <h2 className="m-0 font-sans text-lg font-bold text-primary-dark leading-snug group-hover:text-primary-soft">{a.nombre}</h2>
                <p className="m-0 mt-0.5 text-xs text-ink-500">{catalogos?.categorias?.[a.categoria]}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mt-auto">
                <div className="bg-gray-50 rounded-xl py-2">
                  <p className="m-0 font-display text-2xl font-semibold text-primary tabular-nums">{ind.asistentes}</p>
                  <p className="m-0 text-[11px] text-ink-500">asistentes</p>
                </div>
                <div className={`rounded-xl py-2 ${tono === "verde" ? "bg-[#E3F4F1]" : tono === "dorado" ? "bg-gold-light" : tono === "rojo" ? "bg-red-50" : "bg-gray-50"}`}>
                  <p className="m-0 font-display text-2xl font-semibold text-primary tabular-nums">
                    {ind.jornadas}
                    {ind.meta ? <span className="text-sm text-ink-500">/{ind.meta}</span> : null}
                  </p>
                  <p className="m-0 text-[11px] text-ink-500">{a.permanente ? "en servicio" : "jornadas"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl py-2">
                  <p className="m-0 font-display text-2xl font-semibold text-primary tabular-nums flex items-center justify-center gap-1">
                    {ind.evidencias}
                  </p>
                  <p className="m-0 text-[11px] text-ink-500">evidencias</p>
                </div>
              </div>
              <p className="m-0 text-xs text-ink-500">
                {a.permanente
                  ? `${fechaCorta(a.fechaInicio)} – ${fechaCorta(a.fechaFin)}`
                  : ind.ultimaFecha
                    ? `Última jornada: ${fechaCorta(ind.ultimaFecha)}`
                    : "Sin jornadas registradas"}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
