import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { Aviso, Segmentos, botonSecundario } from "../comunes/componentes/ui";
import { BotonFlotante, Ventana } from "../comunes/componentes/Ventana";
import { FormularioSinCita } from "./AtencionSinCita";
import {
  AvisoRegistrar,
  DetalleCita,
  Flotante,
  KpiAgenda,
  Leyenda,
  MiniCalendario,
  VistaLista,
  VistaMes,
  VistaSemana,
  anclaDe,
  useClicFuera,
} from "./agenda/VistasAgenda";
import {
  CUANDO,
  ESTADOS,
  ahoraBogota,
  addDias,
  dia,
  diasVisibles,
  esPorRegistrar,
  fechaLegible,
  isoDe,
  lunesDe,
  nombreMes,
  parseISO,
  rangoSemanaActual,
  sinTildes,
  tituloSemana,
} from "./agenda/modelo";

const campo =
  "border border-[#DCE3EE] rounded-xl px-3 min-h-[40px] text-sm text-ink-900 bg-white/90 shadow-[inset_0_1px_2px_rgba(11,35,71,0.05)]";

// RF-008 · HU-15, HU-16: citas del módulo, con lista, semana y mes, y el
// registro de asistencia en la misma fila (el mismo PATCH de siempre).
export function AgendaAdminPage({ api = "/admin" }) {
  const [params, setParams] = useSearchParams();
  const [sinCita, setSinCita] = useState(Boolean(params.get("sincita")));
  const fechaInicial = /^\d{4}-\d{2}-\d{2}$/.test(params.get("fecha") || "") ? params.get("fecha") : "";
  const [citas, setCitas] = useState(null);
  const [bloqueos, setBloqueos] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [cuando, setCuando] = useState(fechaInicial ? "dia" : "proximas");
  const [fecha, setFecha] = useState(fechaInicial || ahoraBogota().iso);
  const [estado, setEstado] = useState("todas");
  const [servicio, setServicio] = useState("");
  const [buscar, setBuscar] = useState("");
  const [vista, setVista] = useState("lista");
  const [semana, setSemana] = useState(() => isoDe(lunesDe(ahoraBogota().iso)));
  const [mes, setMes] = useState(() => {
    const h = parseISO(ahoraBogota().iso);
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });
  const [detalle, setDetalle] = useState(null);
  const [mini, setMini] = useState(null);
  const [reloj, setReloj] = useState(() => ahoraBogota());

  const cerrarFlotantes = useCallback(() => {
    setDetalle(null);
    setMini(null);
  }, []);
  useClicFuera(Boolean(detalle || mini), cerrarFlotantes);

  const cargar = useCallback(
    () =>
      http
        .get(`${api}/citas`)
        .then((res) => {
          setCitas(res.data.citas);
          setError("");
        })
        .catch((err) => {
          setCitas([]);
          setError(
            err.response?.data?.message
              ? `No pudimos cargar las citas: ${err.response.data.message}`
              : "No pudimos cargar las citas. Revisa que el servidor esté encendido y tu conexión.",
          );
        }),
    [api],
  );

  useEffect(() => {
    cargar();
    http
      .get(`${api}/horarios/bloqueos`)
      .then((res) => setBloqueos(res.data.bloqueos || []))
      .catch(() => setBloqueos([]));
    if (params.get("sincita")) setParams({}, { replace: true });
    const id = setInterval(() => setReloj(ahoraBogota()), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registrar(cita, asistio) {
    setError("");
    setMensaje("");
    setRegistrando(true);
    try {
      await http.patch(`${api}/citas/${cita.id}/asistencia`, { asistio });
      setMensaje(`Quedó registrado que ${cita.usuario?.nombre?.split(" ")[0] || "el estudiante"} ${asistio ? "asistió" : "no asistió"}.`);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || "No pudimos registrar la asistencia. Intenta de nuevo.");
    } finally {
      setRegistrando(false);
    }
  }

  const hoy = reloj.iso;
  const ahoraMin = reloj.minutos;
  const ctx = useMemo(() => ({ hoy, ahoraMin, fecha }), [hoy, ahoraMin, fecha]);
  const todas = useMemo(
    () => [...(citas || [])].sort((a, b) => (dia(a) + String(a.horario?.horaInicio)).localeCompare(dia(b) + String(b.horario?.horaInicio))),
    [citas],
  );
  const servicios = useMemo(() => [...new Set(todas.map((c) => c.horario?.servicio?.nombre).filter(Boolean))].sort(), [todas]);
  const q = sinTildes(buscar);
  const coincide = (c) => !q || sinTildes(c.usuario?.nombre).includes(q) || sinTildes(c.usuario?.emailInstitucional).includes(q);
  const base = todas.filter((c) => (!servicio || c.horario?.servicio?.nombre === servicio) && coincide(c));
  const opcion = CUANDO.find((o) => o.id === cuando) || CUANDO[0];
  const deCuando = base.filter((c) => opcion.filtro(c, ctx));
  const visibles = deCuando.filter((c) => estado === "todas" || c.estado === estado);
  if (cuando === "pasadas" || cuando === "registrar") visibles.reverse();
  const enCalendario = base.filter((c) => estado === "todas" || c.estado === estado);
  const porRegistrar = todas.filter((c) => esPorRegistrar(c, hoy, ahoraMin)).length;
  const semanaKpi = rangoSemanaActual(hoy);

  const grupos = [];
  for (const c of visibles) {
    if (!grupos.length || grupos.at(-1).dia !== dia(c)) grupos.push({ dia: dia(c), citas: [] });
    grupos.at(-1).citas.push(c);
  }

  const conteos = Object.fromEntries(CUANDO.map((o) => [o.id, base.filter((c) => o.filtro(c, ctx)).length]));
  const universoEstado = vista === "lista" ? deCuando : base;
  const contarEstado = (id) => universoEstado.filter((c) => id === "todas" || c.estado === id).length;
  const hayFiltros = cuando !== "proximas" || estado !== "todas" || servicio || buscar;
  const lunes = parseISO(semana);
  const tituloCal =
    vista === "semana" ? tituloSemana(lunes, diasVisibles(lunes, enCalendario, bloqueos)) : `${nombreMes(mes.getMonth())} de ${mes.getFullYear()}`;
  const citaAbierta = detalle ? todas.find((c) => c.id === detalle.id) : null;
  const hoyTexto = fechaLegible(hoy);

  function verPorRegistrar() {
    cerrarFlotantes();
    setVista("lista");
    setCuando("registrar");
    setEstado("todas");
    setServicio("");
    setBuscar("");
  }

  function irAFecha(iso) {
    cerrarFlotantes();
    if (vista === "lista") {
      setCuando("dia");
      setFecha(iso);
    } else if (vista === "semana") {
      setSemana(isoDe(lunesDe(iso)));
    } else {
      setSemana(isoDe(lunesDe(iso)));
      setVista("semana");
    }
  }

  function mover(direccion) {
    cerrarFlotantes();
    if (vista === "semana") setSemana(isoDe(addDias(lunes, direccion * 7)));
    else setMes(new Date(mes.getFullYear(), mes.getMonth() + direccion, 1));
  }

  function irHoy() {
    cerrarFlotantes();
    const h = ahoraBogota().iso;
    setSemana(isoDe(lunesDe(h)));
    const d = parseISO(h);
    setMes(new Date(d.getFullYear(), d.getMonth(), 1));
    if (vista === "lista") {
      setCuando("proximas");
      setFecha(h);
    }
  }

  function abrirDetalle(cita, el) {
    setMini(null);
    setDetalle({ id: cita.id, ancla: anclaDe(el) });
  }

  const vacio = (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
      <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary-light text-primary">
        <Icono nombre="calendario" size={28} strokeWidth={2} />
      </span>
      {todas.length === 0 ? (
        <>
          <p className="m-0 text-lg font-extrabold text-ink-900">Todavía no hay citas en este módulo</p>
          <p className="mx-auto mt-2 mb-0 max-w-[38em] text-ink-500">
            Aquí aparecen las citas que los estudiantes piden en tus horarios publicados. Si ya hay citas y no salen, revisa que el servicio de la cita pertenezca a este módulo.
          </p>
        </>
      ) : (
        <>
          <p className="m-0 text-lg font-extrabold text-ink-900">Ninguna cita coincide con estos filtros</p>
          <p className="m-0 mt-2 text-ink-500">
            En total hay {todas.length} {todas.length === 1 ? "cita" : "citas"} en este módulo.
          </p>
          <button
            type="button"
            onClick={() => {
              setCuando("todas");
              setEstado("todas");
              setServicio("");
              setBuscar("");
            }}
            className="mt-3 min-h-[44px] rounded-full px-5 font-bold boton-liquido"
          >
            Ver todas las citas
          </button>
        </>
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 pb-24 sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">Panel del personal · Desarrollo Humano</p>
          <h1 className="m-0 text-[30px] font-extrabold leading-tight sm:text-[38px]">Agenda de citas</h1>
          <p className="mt-1 mb-0 max-w-[48em] text-ink-500">
            Citas de los estudiantes con el equipo de Desarrollo Humano. Hoy es {hoyTexto.charAt(0).toLowerCase()}
            {hoyTexto.slice(1)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">
              <Icono nombre="buscar" size={16} />
            </span>
            <input
              type="search"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar estudiante"
              aria-label="Buscar estudiante"
              className={`${campo} w-[240px] max-w-full rounded-full pl-9`}
            />
          </label>
          <Link to="/admin/horarios" className={`${botonSecundario} no-underline`}>
            <Icono nombre="reloj" size={16} strokeWidth={2.2} /> Mis horarios
          </Link>
        </div>
      </div>

      <KpiAgenda hoy={hoy} ahoraMin={ahoraMin} citas={todas} semana={semanaKpi} listo={Boolean(citas)} />
      <AvisoRegistrar cantidad={citas ? porRegistrar : 0} onVer={verPorRegistrar} />

      {mensaje && (
        <div className="mb-4" role="status">
          <Aviso tono="verde">{mensaje}</Aviso>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Aviso>{error}</Aviso>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {vista === "lista" ? (
            <Segmentos etiqueta="Cuándo" valor={cuando} alCambiar={setCuando} opciones={CUANDO.map((o) => [o.id, o.texto])} conteos={conteos} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" aria-label="Anterior" onClick={() => mover(-1)} className="grid h-10 w-10 place-items-center rounded-full burbuja text-primary hover:bg-white">
                <Icono nombre="izquierda" size={18} strokeWidth={2.2} />
              </button>
              <button type="button" aria-label="Siguiente" onClick={() => mover(1)} className="grid h-10 w-10 place-items-center rounded-full burbuja text-primary hover:bg-white">
                <Icono nombre="derecha" size={18} strokeWidth={2.2} />
              </button>
              <button type="button" onClick={irHoy} className="min-h-[40px] rounded-full px-4 text-sm font-bold text-primary burbuja hover:bg-white">
                Hoy
              </button>
              <h2 className="m-0 text-lg font-extrabold">{tituloCal}</h2>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} className={`${campo} w-auto`}>
              {ESTADOS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.texto} ({contarEstado(e.id)})
                </option>
              ))}
            </select>
            <select aria-label="Servicio" value={servicio} onChange={(e) => setServicio(e.target.value)} className={`${campo} w-auto max-w-[220px]`}>
              <option value="">Todos los servicios</option>
              {servicios.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-abre
              onClick={(e) => {
                if (mini) setMini(null);
                else {
                  setDetalle(null);
                  setMini({ ancla: anclaDe(e.currentTarget) });
                }
              }}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-sm font-bold text-ink-900 hover:bg-gray-50"
            >
              <Icono nombre="calendario" size={16} strokeWidth={2} /> Ir a una fecha
            </button>
            <Segmentos
              etiqueta="Vista"
              valor={vista}
              alCambiar={(v) => {
                cerrarFlotantes();
                setVista(v);
              }}
              opciones={[
                ["lista", "Lista", "lista"],
                ["semana", "Semana", "cuadricula"],
                ["mes", "Mes", "calendario"],
              ]}
            />
          </div>
        </div>

        {vista === "lista" && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-sm font-bold text-ink-900" aria-live="polite">
              {cuando === "dia" ? `Mostrando las citas del ${fechaLegible(fecha).toLowerCase()}.` : `Mostrando ${visibles.length} ${visibles.length === 1 ? "cita" : "citas"}.`}
            </p>
            {hayFiltros && (
              <button
                type="button"
                onClick={() => {
                  setCuando("proximas");
                  setEstado("todas");
                  setServicio("");
                  setBuscar("");
                }}
                className="min-h-[36px] text-sm font-bold text-primary hover:underline"
              >
                Quitar filtros
              </button>
            )}
          </div>
        )}

        {!citas && <p className="m-0 text-ink-500">Cargando citas…</p>}

        {citas && vista === "lista" && (
          <VistaLista grupos={grupos} hoy={hoy} ahoraMin={ahoraMin} bloqueos={bloqueos} registrando={registrando} onRegistrar={registrar} onVer={abrirDetalle} vacio={vacio} />
        )}
        {citas && vista === "semana" && (
          <VistaSemana lunes={lunes} citas={enCalendario} bloqueos={bloqueos} hoy={hoy} ahoraMin={ahoraMin} activaId={detalle?.id} onAbrir={abrirDetalle} />
        )}
        {citas && vista === "mes" && (
          <VistaMes
            mes={mes}
            citas={enCalendario}
            bloqueos={bloqueos}
            hoy={hoy}
            ahoraMin={ahoraMin}
            onElegirDia={(iso) => {
              cerrarFlotantes();
              setSemana(isoDe(lunesDe(iso)));
              setVista("semana");
            }}
          />
        )}
        {citas && vista !== "lista" && <Leyenda />}
      </section>

      {citaAbierta && detalle?.ancla && (
        <Flotante ancla={detalle.ancla} etiqueta="Detalle de la cita">
          <DetalleCita cita={citaAbierta} hoy={hoy} ahoraMin={ahoraMin} registrando={registrando} onRegistrar={registrar} onCerrar={() => setDetalle(null)} />
        </Flotante>
      )}
      {mini && (
        <MiniCalendario
          ancla={mini.ancla}
          hoy={hoy}
          citas={enCalendario}
          seleccionado={vista === "lista" && cuando === "dia" ? fecha : null}
          onElegir={irAFecha}
        />
      )}

      {!sinCita && (
        <BotonFlotante icono="persona" onClick={() => setSinCita(true)}>
          Atender sin cita
        </BotonFlotante>
      )}
      {sinCita && (
        <Ventana titulo="Atención sin cita" alCerrar={() => setSinCita(false)}>
          <FormularioSinCita
            api={api}
            alGuardar={async (cita) => {
              setSinCita(false);
              setError("");
              setMensaje(`Quedó registrada la atención de ${cita.usuario?.nombre || "el estudiante"} (${cita.horario?.servicio?.nombre}).`);
              setVista("lista");
              setCuando("dia");
              setFecha(dia(cita));
              setEstado("todas");
              setServicio("");
              setBuscar("");
              await cargar();
            }}
          />
        </Ventana>
      )}
    </main>
  );
}
