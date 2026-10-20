import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import {
  POBLACION_TEXTO,
  fechaCorta,
  guardarPreferencia,
  hoyISO,
  leerPreferencia,
  mensajeError,
  nombreCompleto,
  useCatalogos,
} from "../comunes/lib/salud";
import { Aviso, Campo, Encabezado, Insignia, Tarjeta, Vacio, botonDorado, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";

const CLINICO_VACIO = {
  tensionArterial: "",
  frecuenciaCardiaca: "",
  frecuenciaRespiratoria: "",
  pesoKg: "",
  tallaCm: "",
  glucometria: "",
  insumo: "",
  descripcion: "",
  remitido: false,
  examenLaboral: "",
};

function PersonaResumen({ persona, onCambiar }) {
  return (
    <div className="flex items-center gap-4 bg-primary-light rounded-2xl p-4">
      <span className="w-12 h-12 rounded-full bg-primary text-gold font-bold flex items-center justify-center shrink-0">
        {persona.nombres?.[0]}
        {persona.apellidos?.[0]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="m-0 font-bold text-primary text-lg leading-tight">{nombreCompleto(persona)}</p>
        <p className="m-0 mt-0.5 text-sm text-ink-600">
          {persona.tipoDocumento} {persona.numeroDocumento}
          {persona.codigoEstudiantil ? ` · Código ${persona.codigoEstudiantil}` : ""}
        </p>
        <div className="flex gap-1.5 flex-wrap mt-1.5">
          <Insignia>{POBLACION_TEXTO[persona.poblacion]}</Insignia>
          {persona.programa && <Insignia tono="gris">{persona.programa}</Insignia>}
          {!persona.consentimientoDatos && <Insignia tono="dorado">Falta autorización de datos</Insignia>}
        </div>
      </div>
      <div className="flex flex-col gap-1 items-end shrink-0">
        <Link to={`/salud/personas/${persona.id}`} className="text-sm font-bold text-primary-soft">
          Historial
        </Link>
        {onCambiar && (
          <button type="button" onClick={onCambiar} className="text-sm text-ink-500 hover:text-primary">
            Cambiar
          </button>
        )}
      </div>
    </div>
  );
}

function FormularioPersona({ inicial, catalogos, onGuardada, onCancelar }) {
  const [form, setForm] = useState({
    tipoDocumento: "CC",
    numeroDocumento: "",
    codigoEstudiantil: "",
    nombres: "",
    apellidos: "",
    poblacion: "Estudiante",
    programa: "",
    telefono: "",
    correo: "",
    consentimientoDatos: false,
    ...inicial,
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const { data } = await http.post("/salud/personas", form);
      onGuardada(data.persona);
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar a la persona."));
    } finally {
      setGuardando(false);
    }
  }

  const usaPrograma = ["Estudiante", "Docente", "Egresado"].includes(form.poblacion);

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 border-2 border-dashed border-gold rounded-2xl p-5 bg-gold-light/40">
      <div>
        <p className="m-0 font-bold text-primary">Primera vez: registra a la persona</p>
        <p className="m-0 text-sm text-ink-500">Solo se hace una vez. Después basta con su documento o código.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Tipo de documento">
          <select value={form.tipoDocumento} onChange={cambiar("tipoDocumento")} className={claseCampo}>
            {Object.entries(catalogos?.tiposDocumento || { CC: "Cédula de ciudadanía" }).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Número de documento *">
          <input required value={form.numeroDocumento} onChange={cambiar("numeroDocumento")} inputMode="numeric" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Nombres *">
          <input required value={form.nombres} onChange={cambiar("nombres")} className={claseCampo} autoFocus />
        </Campo>
        <Campo etiqueta="Apellidos *">
          <input required value={form.apellidos} onChange={cambiar("apellidos")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Población *">
          <select value={form.poblacion} onChange={cambiar("poblacion")} className={claseCampo}>
            {(catalogos?.poblaciones || ["Estudiante"]).map((p) => (
              <option key={p} value={p}>
                {POBLACION_TEXTO[p]}
              </option>
            ))}
          </select>
        </Campo>
        {usaPrograma && (
          <Campo etiqueta="Programa">
            <select value={form.programa} onChange={cambiar("programa")} className={claseCampo}>
              <option value="">Sin programa / no aplica</option>
              {["Pregrado", "Posgrado"].map((nivel) => (
                <optgroup key={nivel} label={nivel}>
                  {(catalogos?.programas || [])
                    .filter((p) => p.nivel === nivel)
                    .map((p) => (
                      <option key={p.nombre} value={p.nombre}>
                        {p.nombre}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Campo>
        )}
        {form.poblacion === "Estudiante" && (
          <Campo etiqueta="Código estudiantil" ayuda="Opcional: permite registrarlo con el carné.">
            <input value={form.codigoEstudiantil} onChange={cambiar("codigoEstudiantil")} inputMode="numeric" className={claseCampo} />
          </Campo>
        )}
        <Campo etiqueta="Teléfono">
          <input value={form.telefono} onChange={cambiar("telefono")} inputMode="tel" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Correo" ayuda="Con el correo institucional, el estudiante ve sus participaciones.">
          <input type="email" value={form.correo} onChange={cambiar("correo")} className={claseCampo} />
        </Campo>
      </div>
      <label className="flex gap-3 items-start text-sm text-ink-600 bg-white rounded-xl p-3.5 border border-gray-200">
        <input type="checkbox" checked={form.consentimientoDatos} onChange={cambiar("consentimientoDatos")} className="mt-1 w-4 h-4 accent-primary" required />
        <span>
          <strong className="text-ink-900">La persona autoriza el tratamiento de sus datos personales</strong> por parte de la Unidad de Salud
          Integral, en cumplimiento de la Ley 1581 de 2012.
        </span>
      </label>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2.5 flex-wrap">
        <button type="submit" disabled={guardando} className={botonPrimario}>
          {guardando ? "Guardando..." : "Guardar y continuar"}
        </button>
        <button type="button" onClick={onCancelar} className={botonSecundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormularioClinico({ clinico, setClinico, actividad, catalogos }) {
  const cambiar = (campo) => (e) => setClinico({ ...clinico, [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const laboral = actividad?.categoria === "MedicinaLaboral" || /m[eé]dica|laboral/i.test(actividad?.nombre || "");
  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-sm font-bold text-primary flex items-center gap-2">
        <Icono nombre="estetoscopio" size={18} strokeWidth={2} />
        Datos de la atención (opcionales)
      </p>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Campo etiqueta="Tensión arterial" ayuda="Ej. 120/80">
          <input value={clinico.tensionArterial} onChange={cambiar("tensionArterial")} placeholder="120/80" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Frec. cardiaca">
          <input value={clinico.frecuenciaCardiaca} onChange={cambiar("frecuenciaCardiaca")} inputMode="numeric" placeholder="lpm" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Frec. respiratoria">
          <input value={clinico.frecuenciaRespiratoria} onChange={cambiar("frecuenciaRespiratoria")} inputMode="numeric" placeholder="rpm" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Peso (kg)">
          <input value={clinico.pesoKg} onChange={cambiar("pesoKg")} inputMode="decimal" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Talla (cm)">
          <input value={clinico.tallaCm} onChange={cambiar("tallaCm")} inputMode="numeric" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Glucometría" ayuda="Solo si es necesaria">
          <input value={clinico.glucometria} onChange={cambiar("glucometria")} className={claseCampo} />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Insumo entregado">
          <input value={clinico.insumo} onChange={cambiar("insumo")} placeholder="Gasas, toalla higiénica..." className={claseCampo} />
        </Campo>
        {laboral && (
          <Campo etiqueta="Medicina laboral">
            <select value={clinico.examenLaboral} onChange={cambiar("examenLaboral")} className={claseCampo}>
              <option value="">No aplica</option>
              {Object.entries(catalogos?.examenesLaborales || {}).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>
      <Campo etiqueta="Descripción breve del evento">
        <textarea value={clinico.descripcion} onChange={cambiar("descripcion")} rows={3} className={`${claseCampo} py-2.5`} />
      </Campo>
      <label className="flex gap-2.5 items-center text-sm font-semibold text-ink-600">
        <input type="checkbox" checked={clinico.remitido} onChange={cambiar("remitido")} className="w-4 h-4 accent-primary" />
        Se remitió a la EPS u otra institución
      </label>
    </div>
  );
}

// Registro rapido de atenciones: cedula o codigo ->
// Enter -> queda registrado. Funciona con lector de codigo de barras.
export function RegistrarPage() {
  const catalogos = useCatalogos();
  const [params] = useSearchParams();
  const [actividades, setActividades] = useState(null);
  const [actividadId, setActividadId] = useState(params.get("actividad") || leerPreferencia("actividad", ""));
  const [fecha, setFecha] = useState(hoyISO());
  const [modo, setModo] = useState("una");
  const [documento, setDocumento] = useState(params.get("doc") || "");
  const [persona, setPersona] = useState(null);
  const [coincidencias, setCoincidencias] = useState([]);
  const [nueva, setNueva] = useState(null);
  const [clinico, setClinico] = useState(CLINICO_VACIO);
  const [pendiente, setPendiente] = useState(null); // { tipo: "repetida" | "consentimiento", mensaje }
  const [autoregistro, setAutoregistro] = useState(leerPreferencia("autoregistro", true));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(null);
  const [registrados, setRegistrados] = useState([]);
  const [lista, setLista] = useState("");
  const [resultadoLista, setResultadoLista] = useState(null);
  const entrada = useRef(null);

  useEffect(() => {
    http
      .get("/salud/actividades")
      .then((res) => {
        setActividades(res.data.actividades);
        setActividadId((actual) =>
          res.data.actividades.some((a) => a.id === actual) ? actual : res.data.actividades[0]?.id || ""
        );
      })
      .catch(() => setError("No fue posible cargar las actividades."));
  }, []);

  const actividad = useMemo(() => actividades?.find((a) => a.id === actividadId), [actividades, actividadId]);
  const recientes = (leerPreferencia("recientes", []) || []).filter((id) => actividades?.some((a) => a.id === id) && id !== actividadId).slice(0, 4);

  function cargarRegistrados() {
    if (!actividadId) return;
    http
      .get("/salud/atenciones", { params: { actividadId, desde: fecha, hasta: fecha, limite: 200 } })
      .then((res) => setRegistrados(res.data.atenciones))
      .catch(() => {});
  }

  useEffect(() => {
    cargarRegistrados();
    if (actividadId) {
      guardarPreferencia("actividad", actividadId);
      const previas = leerPreferencia("recientes", []) || [];
      guardarPreferencia("recientes", [actividadId, ...previas.filter((x) => x !== actividadId)].slice(0, 6));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividadId, fecha]);

  useEffect(() => {
    if (params.get("doc") && actividades) buscar(params.get("doc"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividades]);

  function limpiar({ mantenerExito = true } = {}) {
    setDocumento("");
    setPersona(null);
    setCoincidencias([]);
    setNueva(null);
    setClinico(CLINICO_VACIO);
    setPendiente(null);
    if (!mantenerExito) setExito(null);
    setTimeout(() => entrada.current?.focus(), 0);
  }

  async function registrar(p, extra = {}) {
    if (!actividad) return setError("Elige primero la actividad o el tipo de atención.");
    setError("");
    setOcupado(true);
    try {
      const datos = { personaId: p.id, actividadId, fecha, ...extra };
      if (actividad.clinica) Object.assign(datos, clinico);
      const { data } = await http.post("/salud/atenciones", datos);
      setExito({ nombre: nombreCompleto(data.atencion.persona), actividad: actividad.nombre, id: data.atencion.id });
      setRegistrados((r) => [data.atencion, ...r]);
      limpiar();
    } catch (err) {
      const codigo = err.response?.data?.codigo;
      if (codigo === "YA_REGISTRADA") setPendiente({ tipo: "repetida", mensaje: err.response.data.message, persona: p });
      else if (codigo === "SIN_CONSENTIMIENTO") setPendiente({ tipo: "consentimiento", mensaje: err.response.data.message, persona: p });
      else setError(mensajeError(err, "No fue posible registrar la atención."));
    } finally {
      setOcupado(false);
    }
  }

  async function buscar(texto = documento) {
    const q = String(texto || "").trim();
    if (!q) return;
    setError("");
    setExito(null);
    setPendiente(null);
    setNueva(null);
    setCoincidencias([]);
    setOcupado(true);
    try {
      const { data } = await http.get("/salud/personas/buscar", { params: { q } });
      if (data.exacta) {
        setPersona(data.exacta);
        setOcupado(false);
        if (!actividad?.clinica && autoregistro) await registrar(data.exacta);
        return;
      }
      setPersona(null);
      if (data.coincidencias.length) setCoincidencias(data.coincidencias);
      else setNueva(/^[\d.\s-]+$/.test(q) ? { numeroDocumento: q.replace(/\D/g, "") } : { nombres: q });
    } catch (err) {
      setError(mensajeError(err, "No fue posible buscar a la persona."));
    } finally {
      setOcupado(false);
    }
  }

  async function deshacer(atencion) {
    try {
      await http.delete(`/salud/atenciones/${atencion.id}`);
      setRegistrados((r) => r.filter((x) => x.id !== atencion.id));
      if (exito?.id === atencion.id) setExito(null);
    } catch (err) {
      setError(mensajeError(err, "No fue posible eliminar el registro."));
    }
  }

  async function registrarLista(e) {
    e.preventDefault();
    setError("");
    setResultadoLista(null);
    setOcupado(true);
    try {
      const { data } = await http.post("/salud/atenciones/lote", { actividadId, fecha, identificadores: lista });
      setResultadoLista(data);
      if (data.registrados.length) cargarRegistrados();
      setLista(data.noEncontrados.join("\n"));
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar la lista."));
    } finally {
      setOcupado(false);
    }
  }

  const porCategoria = useMemo(() => {
    const grupos = {};
    for (const a of actividades || []) (grupos[a.categoria] ||= []).push(a);
    return grupos;
  }, [actividades]);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <Encabezado
        kicker="Salud integral"
        titulo="Registrar atención o asistencia"
        descripcion="Escribe o escanea la cédula o el código estudiantil y presiona Enter. Si la persona ya está registrada, queda guardada al instante."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <Tarjeta>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <Campo etiqueta="Actividad o tipo de atención">
                <select value={actividadId} onChange={(e) => setActividadId(e.target.value)} className={`${claseCampo} font-semibold`}>
                  {!actividades && <option>Cargando...</option>}
                  {actividades?.length === 0 && <option value="">No hay actividades en el periodo</option>}
                  {Object.entries(porCategoria).map(([categoria, lista]) => (
                    <optgroup key={categoria} label={catalogos?.categorias?.[categoria] || categoria}>
                      {lista.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Fecha">
                <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} className={claseCampo} />
              </Campo>
            </div>
            {recientes.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3 items-center">
                <span className="text-xs text-ink-500">Recientes:</span>
                {recientes.map((id) => (
                  <button key={id} type="button" onClick={() => setActividadId(id)} className="text-xs font-semibold text-primary bg-primary-light rounded-full px-3 py-1.5 hover:bg-[#DCE4F3]">
                    {actividades.find((a) => a.id === id)?.nombre}
                  </button>
                ))}
              </div>
            )}
            {actividades?.length === 0 && (
              <div className="mt-3">
                <Aviso tono="dorado">
                  Crea las actividades del periodo en <Link to="/salud/actividades" className="underline font-bold">Actividades</Link> (o copia el catálogo del periodo anterior).
                </Aviso>
              </div>
            )}
            {actividad?.clinica && (
              <p className="mt-3 mb-0 text-sm text-ink-500 flex items-center gap-2">
                <Icono nombre="estetoscopio" size={16} /> Atención de enfermería: después de buscar a la persona puedes anotar signos vitales e insumos.
              </p>
            )}
          </Tarjeta>

          <div className="flex gap-1.5 vidrio-panel rounded-full p-1 self-start" role="tablist">
            {[
              ["una", "Una persona"],
              ["lista", "Lista de una jornada"],
            ].map(([id, texto]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={modo === id}
                onClick={() => setModo(id)}
                className={`text-sm font-semibold rounded-full px-4 min-h-[38px] ${modo === id ? "boton-liquido" : "text-ink-600 hover:bg-white/80"}`}
              >
                {texto}
              </button>
            ))}
          </div>

          {modo === "una" && (
            <Tarjeta>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  buscar();
                }}
                className="flex gap-2.5 flex-wrap"
              >
                <label className="sr-only" htmlFor="documento">Cédula o código estudiantil</label>
                <div className="relative flex-[1_1_260px]">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500">
                    <Icono nombre="buscar" size={22} />
                  </span>
                  <input
                    id="documento"
                    ref={entrada}
                    autoFocus
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    placeholder="Cédula o código"
                    autoComplete="off"
                    className={`${claseCampo} pl-12 min-h-[58px] text-xl font-semibold tracking-wide`}
                  />
                </div>
                <button type="submit" disabled={ocupado || !actividadId} className={`${botonPrimario} min-h-[58px] px-7`}>
                  {ocupado ? "Buscando..." : "Buscar"}
                </button>
              </form>
              {!actividad?.clinica && (
                <label className="mt-3 flex gap-2.5 items-center text-sm text-ink-600">
                  <input
                    type="checkbox"
                    checked={autoregistro}
                    onChange={(e) => {
                      setAutoregistro(e.target.checked);
                      guardarPreferencia("autoregistro", e.target.checked);
                    }}
                    className="w-4 h-4 accent-primary"
                  />
                  Registrar automáticamente al encontrar a la persona
                </label>
              )}

              <div className="flex flex-col gap-4 mt-5 empty:mt-0" aria-live="polite">
                {exito && (
                  <div className="flex items-center gap-3 bg-[#E3F4F1] text-[#0B6B61] rounded-2xl px-4 py-3.5">
                    <span className="w-9 h-9 rounded-full bg-[#0d9488] text-white flex items-center justify-center shrink-0">
                      <Icono nombre="check" size={20} strokeWidth={2.6} />
                    </span>
                    <p className="m-0 flex-1 text-sm">
                      <strong className="block text-base">{exito.nombre}</strong>
                      quedó registrado(a) en {exito.actividad}.
                    </p>
                  </div>
                )}
                {error && <Aviso>{error}</Aviso>}

                {persona && (
                  <>
                    <PersonaResumen persona={persona} onCambiar={() => limpiar({ mantenerExito: false })} />
                    {actividad?.clinica && <FormularioClinico clinico={clinico} setClinico={setClinico} actividad={actividad} catalogos={catalogos} />}
                    {!pendiente && (actividad?.clinica || !autoregistro) && (
                      <button type="button" disabled={ocupado} onClick={() => registrar(persona)} className={`${botonDorado} self-start`}>
                        <Icono nombre="check" size={18} strokeWidth={2.4} />
                        {actividad?.clinica ? "Guardar atención" : "Registrar asistencia"}
                      </button>
                    )}
                  </>
                )}

                {pendiente?.tipo === "repetida" && (
                  <Aviso tono="dorado">
                    <p className="m-0 mb-2">{pendiente.mensaje}</p>
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" onClick={() => registrar(pendiente.persona, { permitirRepetida: true })} className={botonSecundario}>
                        Registrar otra vez
                      </button>
                      <button type="button" onClick={() => limpiar({ mantenerExito: false })} className={botonSecundario}>
                        No, cancelar
                      </button>
                    </div>
                  </Aviso>
                )}
                {pendiente?.tipo === "consentimiento" && (
                  <Aviso tono="azul">
                    <p className="m-0 mb-2">{pendiente.mensaje}</p>
                    <p className="m-0 mb-3 text-ink-600">
                      Pregúntale si autoriza el tratamiento de sus datos personales por parte de la Unidad de Salud Integral (Ley 1581 de 2012).
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" onClick={() => registrar(pendiente.persona, { consentimientoDatos: true })} className={botonPrimario}>
                        Sí autoriza · registrar
                      </button>
                      <button type="button" onClick={() => limpiar({ mantenerExito: false })} className={botonSecundario}>
                        No autoriza
                      </button>
                    </div>
                  </Aviso>
                )}

                {coincidencias.length > 0 && (
                  <div>
                    <p className="m-0 mb-2 text-sm font-semibold text-ink-600">¿Es alguna de estas personas?</p>
                    <ul className="list-none m-0 p-0 flex flex-col gap-2">
                      {coincidencias.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCoincidencias([]);
                              setPersona(c);
                              if (!actividad?.clinica && autoregistro) registrar(c);
                            }}
                            className="w-full text-left flex justify-between gap-3 items-center border border-gray-200 rounded-xl px-4 py-3 hover:border-primary-soft hover:bg-primary-light"
                          >
                            <span>
                              <strong className="block text-ink-900">{nombreCompleto(c)}</strong>
                              <span className="text-sm text-ink-500">
                                {c.numeroDocumento} · {POBLACION_TEXTO[c.poblacion]}
                              </span>
                            </span>
                            <Icono nombre="derecha" size={18} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={() => { setCoincidencias([]); setNueva({}); }} className="mt-2 text-sm font-bold text-primary-soft">
                      No está en la lista · registrar nueva persona
                    </button>
                  </div>
                )}

                {nueva && (
                  <>
                    <Aviso tono="dorado">No encontramos a nadie con «{documento}».</Aviso>
                    <FormularioPersona
                      inicial={nueva}
                      catalogos={catalogos}
                      onCancelar={() => limpiar({ mantenerExito: false })}
                      onGuardada={(p) => {
                        setNueva(null);
                        setPersona(p);
                        if (!actividad?.clinica) registrar(p);
                      }}
                    />
                  </>
                )}
              </div>
            </Tarjeta>
          )}

          {modo === "lista" && (
            <Tarjeta titulo="Registrar una lista" subtitulo="Pega o escanea varios documentos o códigos (uno por línea o separados por comas). Ideal para charlas, ferias y tamizajes.">
              <form onSubmit={registrarLista} className="flex flex-col gap-3">
                <textarea
                  value={lista}
                  onChange={(e) => setLista(e.target.value)}
                  rows={8}
                  placeholder={"1061731427\n20231045\n34569970"}
                  className={`${claseCampo} py-3 font-mono`}
                />
                <button type="submit" disabled={ocupado || !lista.trim() || !actividadId} className={`${botonPrimario} self-start`}>
                  <Icono nombre="lista" size={18} strokeWidth={2} />
                  {ocupado ? "Registrando..." : "Registrar la lista"}
                </button>
              </form>
              {resultadoLista && (
                <div className="mt-4 flex flex-col gap-2.5">
                  <Aviso tono="verde">
                    <strong>{resultadoLista.registrados.length}</strong> registrados en {actividad?.nombre}.
                    {resultadoLista.yaRegistrados.length > 0 && ` ${resultadoLista.yaRegistrados.length} ya estaban registrados.`}
                  </Aviso>
                  {resultadoLista.sinConsentimiento.length > 0 && (
                    <Aviso tono="azul">
                      {resultadoLista.sinConsentimiento.length} persona(s) no tienen registrada la autorización de datos: pídela en la planilla de la jornada.
                    </Aviso>
                  )}
                  {resultadoLista.noEncontrados.length > 0 && (
                    <Aviso tono="dorado">
                      <p className="m-0 mb-2">
                        <strong>{resultadoLista.noEncontrados.length} sin registrar todavía</strong> (quedaron en la caja). Regístralas una por una:
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {resultadoLista.noEncontrados.map((doc) => (
                          <button
                            key={doc}
                            type="button"
                            onClick={() => {
                              setModo("una");
                              setDocumento(doc);
                              buscar(doc);
                            }}
                            className="text-xs font-bold bg-white border border-gray-200 rounded-full px-3 py-1.5 hover:border-primary-soft"
                          >
                            {doc} →
                          </button>
                        ))}
                      </div>
                    </Aviso>
                  )}
                </div>
              )}
            </Tarjeta>
          )}
        </div>

        <Tarjeta
          className="lg:sticky lg:top-6"
          titulo={actividad ? actividad.nombre : "Registrados"}
          subtitulo={`${fechaCorta(fecha)} · registrados`}
          acciones={<span className="font-display text-[34px] leading-none font-semibold text-primary tabular-nums">{registrados.length}</span>}
        >
          {registrados.length === 0 && <Vacio>Todavía no hay registros en esta actividad para la fecha.</Vacio>}
          <ul className="list-none m-0 p-0 flex flex-col max-h-[520px] overflow-y-auto -mx-1 px-1">
            {registrados.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <span className="flex-1 min-w-0 text-sm leading-tight">
                  <strong className="block truncate text-ink-900">{nombreCompleto(a.persona)}</strong>
                  <span className="text-ink-500">
                    {a.persona?.numeroDocumento} · {POBLACION_TEXTO[a.poblacion]}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => deshacer(a)}
                  title="Eliminar este registro"
                  aria-label={`Eliminar el registro de ${nombreCompleto(a.persona)}`}
                  className="w-9 h-9 rounded-full text-ink-500 hover:bg-red-50 hover:text-red-700 flex items-center justify-center shrink-0"
                >
                  <Icono nombre="deshacer" size={17} />
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </main>
  );
}
