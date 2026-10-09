import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { POBLACION_TEXTO, fechaCorta, mensajeError, nombreCompleto, useCatalogos } from "../../lib/salud";
import { claseCampoCorto, Aviso, Campo, Encabezado, Insignia, Kpi, Tarjeta, Vacio, botonPrimario, botonSecundario, claseCampo } from "./ui";

// Personas registradas en la Unidad de Salud (busqueda y paginacion).
export function PersonasPage() {
  const catalogos = useCatalogos();
  const [q, setQ] = useState("");
  const [poblacion, setPoblacion] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      http
        .get("/salud/personas", { params: { q, poblacion: poblacion || undefined, pagina } })
        .then((res) => setDatos(res.data))
        .catch((err) => setError(mensajeError(err, "No fue posible cargar las personas.")));
    }, 250);
    return () => clearTimeout(t);
  }, [q, poblacion, pagina]);

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.porPagina)) : 1;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <Encabezado
        kicker="Salud integral"
        titulo="Personas"
        descripcion="Estudiantes, docentes, administrativos, egresados y visitantes atendidos. Cada persona se registra una sola vez."
      />
      <div className="flex gap-3 flex-wrap mb-5">
        <div className="relative flex-[1_1_320px]">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500">
            <Icono nombre="buscar" size={20} />
          </span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por nombre, documento o código"
            className={`${claseCampo} pl-12`}
            aria-label="Buscar personas"
          />
        </div>
        <select
          value={poblacion}
          onChange={(e) => {
            setPoblacion(e.target.value);
            setPagina(1);
          }}
          className={`${claseCampoCorto}`}
          aria-label="Población"
        >
          <option value="">Toda la población</option>
          {(catalogos?.poblaciones || []).map((p) => (
            <option key={p} value={p}>
              {POBLACION_TEXTO[p]}
            </option>
          ))}
        </select>
      </div>
      {error && <Aviso>{error}</Aviso>}
      <Tarjeta>
        {datos && datos.personas.length === 0 && <Vacio>No hay personas que coincidan.</Vacio>}
        {datos && datos.personas.length > 0 && (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-2 py-2 font-semibold">Persona</th>
                  <th className="px-2 py-2 font-semibold">Documento</th>
                  <th className="px-2 py-2 font-semibold">Población</th>
                  <th className="px-2 py-2 font-semibold">Programa</th>
                  <th className="px-2 py-2 font-semibold">Datos</th>
                </tr>
              </thead>
              <tbody>
                {datos.personas.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-2.5">
                      <Link to={`/salud/personas/${p.id}`} className="font-semibold text-ink-900 hover:text-primary-soft">
                        {nombreCompleto(p)}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">
                      {p.tipoDocumento} {p.numeroDocumento}
                    </td>
                    <td className="px-2 py-2.5">{POBLACION_TEXTO[p.poblacion]}</td>
                    <td className="px-2 py-2.5 text-ink-600">{p.programa || "—"}</td>
                    <td className="px-2 py-2.5">
                      {p.consentimientoDatos ? <Insignia tono="verde">Autorizados</Insignia> : <Insignia tono="dorado">Sin autorización</Insignia>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!datos && <div className="h-40 bg-gray-50 rounded-xl animate-pulse" />}
        {datos && datos.total > datos.porPagina && (
          <div className="flex justify-between items-center mt-4 text-sm">
            <span className="text-ink-500">
              {datos.total.toLocaleString("es-CO")} personas · página {pagina} de {paginas}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)} className={botonSecundario}>
                Anterior
              </button>
              <button type="button" disabled={pagina >= paginas} onClick={() => setPagina((n) => n + 1)} className={botonSecundario}>
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Tarjeta>
    </main>
  );
}

const SIGNOS = [
  ["tensionArterial", "TA"],
  ["frecuenciaCardiaca", "FC"],
  ["frecuenciaRespiratoria", "FR"],
  ["pesoKg", "Peso"],
  ["tallaCm", "Talla"],
  ["glucometria", "Glucometría"],
];

// Ficha de una persona: datos (editables) e historial de atenciones.
export function PersonaDetallePage() {
  const { id } = useParams();
  const catalogos = useCatalogos();
  const [persona, setPersona] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  function cargar() {
    http
      .get(`/salud/personas/${id}`)
      .then((res) => {
        setPersona(res.data.persona);
        const p = res.data.persona;
        setForm({
          tipoDocumento: p.tipoDocumento,
          numeroDocumento: p.numeroDocumento,
          codigoEstudiantil: p.codigoEstudiantil || "",
          nombres: p.nombres,
          apellidos: p.apellidos,
          poblacion: p.poblacion,
          programa: p.programa || "",
          telefono: p.telefono || "",
          correo: p.correo || "",
          consentimientoDatos: p.consentimientoDatos,
        });
      })
      .catch((err) => setError(mensajeError(err, "No fue posible cargar a la persona.")));
  }
  useEffect(cargar, [id]);

  const cambiar = (campo) => (e) => {
    setGuardado(false);
    setForm({ ...form, [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  };

  async function guardar(e) {
    e.preventDefault();
    setError("");
    try {
      const datos = { ...form };
      if (persona.consentimientoDatos && datos.consentimientoDatos) delete datos.consentimientoDatos;
      await http.patch(`/salud/personas/${id}`, datos);
      setGuardado(true);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar los cambios."));
    }
  }

  if (!persona) return <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 text-ink-500">{error ? <Aviso>{error}</Aviso> : "Cargando..."}</main>;

  const actividades = new Set(persona.atenciones.map((a) => a.actividadId)).size;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      <div>
        <Link to="/salud/personas" className="text-sm font-bold text-primary-soft">
          ← Personas
        </Link>
        <div className="flex justify-between items-end gap-4 flex-wrap mt-3">
          <div className="flex items-center gap-4 min-w-0">
            <span className="w-16 h-16 rounded-full bg-primary text-gold font-display text-2xl font-semibold flex items-center justify-center shrink-0">
              {persona.nombres[0]}
              {persona.apellidos[0]}
            </span>
            <div className="min-w-0">
              <h1 className="m-0 text-3xl font-extrabold">{nombreCompleto(persona)}</h1>
              <p className="m-0 mt-1 text-ink-500">
                {persona.tipoDocumento} {persona.numeroDocumento} · {POBLACION_TEXTO[persona.poblacion]}
                {persona.programa ? ` · ${persona.programa}` : ""}
              </p>
            </div>
          </div>
          <Link to={`/salud/registrar?doc=${persona.numeroDocumento}`} className={botonPrimario}>
            Registrar atención
          </Link>
        </div>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <Kpi destacado titulo="Atenciones registradas" valor={persona.atenciones.length} />
        <Kpi titulo="Actividades distintas" valor={actividades} />
        <Kpi titulo="Última atención" valor={persona.atenciones[0] ? fechaCorta(persona.atenciones[0].fecha).split(" ").slice(0, 2).join(" ") : "—"} detalle={persona.atenciones[0]?.actividad?.nombre} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr] items-start">
        <Tarjeta titulo="Datos de la persona">
          {form && (
            <form onSubmit={guardar} className="flex flex-col gap-3">
              <div className="grid gap-3 grid-cols-2">
                <Campo etiqueta="Nombres">
                  <input value={form.nombres} onChange={cambiar("nombres")} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Apellidos">
                  <input value={form.apellidos} onChange={cambiar("apellidos")} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Documento">
                  <input value={form.numeroDocumento} onChange={cambiar("numeroDocumento")} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Código estudiantil">
                  <input value={form.codigoEstudiantil} onChange={cambiar("codigoEstudiantil")} className={claseCampo} />
                </Campo>
              </div>
              <Campo etiqueta="Población">
                <select value={form.poblacion} onChange={cambiar("poblacion")} className={claseCampo}>
                  {(catalogos?.poblaciones || []).map((p) => (
                    <option key={p} value={p}>
                      {POBLACION_TEXTO[p]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Programa">
                <select value={form.programa} onChange={cambiar("programa")} className={claseCampo}>
                  <option value="">Sin programa / no aplica</option>
                  {(catalogos?.programas || []).map((p) => (
                    <option key={p.nombre} value={p.nombre}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="grid gap-3 grid-cols-2">
                <Campo etiqueta="Teléfono">
                  <input value={form.telefono} onChange={cambiar("telefono")} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Correo">
                  <input value={form.correo} onChange={cambiar("correo")} className={claseCampo} />
                </Campo>
              </div>
              <label className="flex gap-2.5 items-start text-sm text-ink-600">
                <input type="checkbox" checked={form.consentimientoDatos} disabled={persona.consentimientoDatos} onChange={cambiar("consentimientoDatos")} className="mt-0.5 w-4 h-4 accent-primary" />
                <span>
                  Autoriza el tratamiento de datos (Ley 1581)
                  {persona.fechaConsentimiento && <span className="block text-xs text-ink-500">Desde el {fechaCorta(persona.fechaConsentimiento)}</span>}
                </span>
              </label>
              {error && <Aviso>{error}</Aviso>}
              {guardado && <Aviso tono="verde">Cambios guardados.</Aviso>}
              <button type="submit" className={`${botonSecundario} self-start`}>
                Guardar cambios
              </button>
            </form>
          )}
        </Tarjeta>

        <Tarjeta titulo="Historial de atenciones" subtitulo="Información confidencial de la Unidad de Salud.">
          {persona.atenciones.length === 0 && <Vacio>Sin atenciones registradas.</Vacio>}
          <ol className="list-none m-0 p-0 flex flex-col">
            {persona.atenciones.map((a) => {
              const signos = SIGNOS.filter(([k]) => a[k] !== null && a[k] !== undefined && a[k] !== "");
              return (
                <li key={a.id} className="relative pl-6 pb-5 border-l-2 border-gray-100 last:pb-0 ml-2">
                  <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ${a.actividad?.clinica ? "bg-[#0d9488]" : "bg-primary-soft"}`} />
                  <div className="flex justify-between gap-3 flex-wrap">
                    <strong className="text-ink-900">{a.actividad?.nombre}</strong>
                    <span className="text-sm text-ink-500">{fechaCorta(a.fecha)}</span>
                  </div>
                  {signos.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                      {signos.map(([k, t]) => (
                        <Insignia key={k} tono="gris">
                          {t}: {a[k]}
                          {k === "pesoKg" ? " kg" : k === "tallaCm" ? " cm" : ""}
                        </Insignia>
                      ))}
                    </div>
                  )}
                  {(a.insumo || a.examenLaboral || a.remitido) && (
                    <p className="m-0 mt-1.5 text-sm text-ink-600">
                      {[a.insumo && `Insumo: ${a.insumo}`, a.examenLaboral && `Medicina laboral: ${catalogos?.examenesLaborales?.[a.examenLaboral] || a.examenLaboral}`, a.remitido && "Remitido(a)"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {a.descripcion && <p className="m-0 mt-1.5 text-sm text-ink-600 whitespace-pre-line">{a.descripcion}</p>}
                  <p className="m-0 mt-1 text-xs text-ink-500">
                    {a.registradoPor?.nombre ? `Registró: ${a.registradoPor.nombre}` : a.origen === "importado" ? "Importado de Excel" : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        </Tarjeta>
      </div>
    </main>
  );
}
