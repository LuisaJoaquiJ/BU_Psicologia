import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { POBLACION_TEXTO, descargar, fechaCorta, mensajeError, nombreCompleto, useCatalogos } from "../comunes/lib/salud";
import { claseCampoCorto, Aviso, Campo, Encabezado, Insignia, Kpi, Tarjeta, Vacio, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";

// Personas registradas en la Unidad de Salud (busqueda y paginacion).
// Lista de estudiantes activos del periodo (la de Registro academico): se
// descarga, se edita en Excel y se vuelve a subir con vista previa.
function EstudiantesActivos({ alCargar }) {
  const [activos, setActivos] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const input = useRef(null);
  const RUTA = "/salud/personas/estudiantes-activos";

  const contar = () =>
    http
      .get(RUTA)
      .then((r) => setActivos(r.data.activos))
      .catch(() => setActivos(null));
  useEffect(() => {
    contar();
  }, []);

  async function bajar(ruta, nombre) {
    setError("");
    try {
      await descargar(ruta, undefined, nombre);
    } catch {
      setError("No fue posible descargar el archivo. Intenta de nuevo.");
    }
  }

  async function enviar(confirmar) {
    if (!archivo) return;
    setOcupado(true);
    setError("");
    setAviso("");
    const datos = new FormData();
    datos.append("archivo", archivo);
    try {
      const { data } = await http.post(`${RUTA}/importar${confirmar ? "?confirmar=true" : ""}`, datos);
      if (confirmar) {
        setPrevia(null);
        setArchivo(null);
        setAviso(`Lista cargada: ${data.estudiantes.toLocaleString("es-CO")} estudiantes activos.`);
        contar();
        alCargar?.();
      } else setPrevia(data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible leer el archivo."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Tarjeta
      className="mb-6"
      titulo="Estudiantes activos"
      subtitulo={
        activos === null
          ? "Sube la lista de matriculados del periodo para buscarlos por documento y llenar sus datos al inscribirse a salidas."
          : activos
            ? `${activos.toLocaleString("es-CO")} estudiantes en la lista vigente. Al subir una nueva, quienes no estén en ella dejan de figurar como activos.`
            : "Aún no hay lista. Descarga la plantilla, pega los matriculados del periodo y súbela."
      }
      acciones={
        <div className="flex gap-2 flex-wrap">
          {activos > 0 && (
            <button type="button" onClick={() => bajar(`${RUTA}/exportar`, "estudiantes-activos.xlsx")} className={botonSecundario}>
              <Icono nombre="descarga" size={17} strokeWidth={2.2} /> Descargar lista
            </button>
          )}
          <button type="button" onClick={() => bajar(`${RUTA}/plantilla`, "plantilla-estudiantes-activos.xlsx")} className={botonSecundario}>
            <Icono nombre="archivo" size={17} strokeWidth={2.2} /> Plantilla
          </button>
        </div>
      }
    >
      <div className="flex gap-3 flex-wrap items-center">
        <button type="button" onClick={() => input.current?.click()} className={botonSecundario}>
          <Icono nombre="subir" size={17} strokeWidth={2.2} />
          {archivo ? "Cambiar archivo" : "Subir lista .xlsx"}
        </button>
        {archivo && <span className="text-sm font-semibold text-ink-900">{archivo.name}</span>}
        <input
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            setArchivo(e.target.files[0] || null);
            setPrevia(null);
            setAviso("");
            e.target.value = "";
          }}
        />
        {archivo && !previa && (
          <button type="button" onClick={() => enviar(false)} disabled={ocupado} className={botonPrimario}>
            {ocupado ? "Leyendo…" : "Revisar antes de cargar"}
          </button>
        )}
      </div>

      {error && <div className="mt-4"><Aviso>{error}</Aviso></div>}
      {aviso && <div className="mt-4"><Aviso tono="verde">{aviso}</Aviso></div>}

      {previa && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            {[
              ["Estudiantes en la lista", previa.estudiantes],
              ["Nuevos", previa.nuevos],
              ["Ya estaban registrados", previa.actualizados],
              ["Dejan de estar activos", previa.dejanDeEstarActivos],
            ].map(([t, v]) => (
              <div key={t} className="burbuja rounded-2xl p-4">
                <p className="m-0 text-xs text-ink-500">{t}</p>
                <p className="m-0 mt-1 font-display text-3xl font-semibold text-primary tabular-nums">{v.toLocaleString("es-CO")}</p>
              </div>
            ))}
          </div>
          {previa.repetidas > 0 && <Aviso tono="azul">{previa.repetidas} documentos estaban repetidos; se toma la última fila de cada uno.</Aviso>}
          {previa.filasConError > 0 && (
            <Aviso tono="dorado">
              <p className="m-0 mb-1.5">
                <strong>{previa.filasConError} filas no se cargarán</strong>; revísalas en el Excel:
              </p>
              <ul className="m-0 pl-5">
                {previa.errores.map((e) => (
                  <li key={e.fila}>
                    Fila {e.fila}: {e.motivo}
                  </li>
                ))}
              </ul>
            </Aviso>
          )}
          <div className="flex gap-2.5 flex-wrap">
            <button type="button" onClick={() => enviar(true)} disabled={ocupado} className={botonPrimario}>
              {ocupado ? "Cargando…" : `Cargar ${previa.estudiantes.toLocaleString("es-CO")} estudiantes`}
            </button>
            <button type="button" onClick={() => setPrevia(null)} className={botonSecundario}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

export function PersonasPage() {
  const catalogos = useCatalogos();
  const [q, setQ] = useState("");
  const [poblacion, setPoblacion] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      http
        .get("/salud/personas", { params: { q, poblacion: poblacion || undefined, pagina } })
        .then((res) => setDatos(res.data))
        .catch((err) => setError(mensajeError(err, "No fue posible cargar las personas.")));
    }, 250);
    return () => clearTimeout(t);
  }, [q, poblacion, pagina, recarga]);

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.porPagina)) : 1;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <Encabezado
        kicker="Salud integral"
        titulo="Personas"
        descripcion="Estudiantes, docentes, administrativos, egresados y visitantes atendidos. Cada persona se registra una sola vez."
      />
      <EstudiantesActivos alCargar={() => setRecarga((n) => n + 1)} />
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
                    <td className="px-2 py-2.5">
                      {POBLACION_TEXTO[p.poblacion]}
                      {p.estudianteActivo && <Insignia tono="azul" className="ml-2">Activo</Insignia>}
                    </td>
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
