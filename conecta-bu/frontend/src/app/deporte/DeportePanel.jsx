import { useCallback, useEffect, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";
import { PanelLayout } from "../../components/AdminLayout";
import { Icono } from "../../components/Iconos";
import { fechaCorta, horas, hoyISO } from "../../lib/deporte";
import { descargar, mensajeError } from "../../lib/salud";
import { Aviso, Campo, Encabezado, Insignia, Kpi, Tarjeta, Vacio, botonDorado, botonPrimario, botonSecundario, claseCampo, claseCampoCorto } from "../salud/ui";
import { GruposPage, GrupoDetallePage, useCatalogosDeporte } from "./GruposDeporte";
import { BarrasDisciplina, IconoDisciplina } from "./Progreso";

// Panel del personal del modulo Deporte (/deporte): solo entran los correos
// que el superadministrador asigno a Deporte.
const MENU_DEPORTE = [
  { to: "/deporte", label: "Inicio", icono: "tablero", end: true },
  { to: "/deporte/grupos", label: "Grupos y asistencia", icono: "calendario" },
  { to: "/deporte/estudiantes", label: "Estudiantes y horas", icono: "usuarios" },
  { to: "/deporte/disciplinas", label: "Disciplinas", icono: "trofeo" },
];

function descargarReporte(periodo) {
  return descargar("/deporte/admin/reporte", periodo ? { periodo } : {}, "deporte-horas.xlsx");
}

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function InicioPersonal() {
  const { usuario } = useAuth();
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    http
      .get("/deporte/admin/resumen")
      .then((x) => setR(x.data))
      .catch(() => setError("No fue posible cargar el resumen."));
  }, []);
  return (
    <main className="max-w-[1160px] mx-auto px-5 sm:px-8 pt-9 pb-16 flex flex-col gap-6">
      <section className="relative overflow-hidden bg-primary rounded-[28px] px-6 py-8 sm:px-10 sm:py-10 text-white">
        <svg aria-hidden="true" viewBox="0 0 400 400" className="absolute -right-24 -top-28 w-[360px] h-[360px]">
          <circle cx="200" cy="200" r="180" fill="none" stroke="rgba(232,178,58,0.35)" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="120" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
        </svg>
        <p className="relative m-0 mb-1.5 text-[13px] font-bold tracking-[0.14em] uppercase text-gold">Deporte · {r?.periodo || "…"}</p>
        <h1 className="relative m-0 text-white text-[32px] sm:text-[40px] font-extrabold">
          {saludo()}, {usuario?.nombre?.split(" ")[0]}
        </h1>
        <p className="relative mt-2 mb-6 text-[#D6DDEC] max-w-[560px]">
          Toma asistencia de las clases de hoy: cada estudiante presente suma las horas de la sesión para completar sus {r?.requeridas || 40} horas.
        </p>
        <div className="relative flex gap-2.5 flex-wrap">
          <Link to="/deporte/grupos" className={`${botonDorado} min-h-[50px]`}>
            <Icono nombre="calendario" size={18} /> Ver grupos
          </Link>
          <button type="button" onClick={() => descargarReporte(r?.periodo)} className="inline-flex items-center gap-2 border-[1.5px] border-white/30 text-white font-bold text-sm px-5 min-h-[50px] rounded-full hover:bg-white/10">
            <Icono nombre="descarga" size={17} /> Reporte en Excel
          </button>
        </div>
      </section>
      {error && <Aviso>{error}</Aviso>}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <Kpi destacado titulo="Estudiantes inscritos" valor={r ? r.inscritos : "…"} detalle={r ? `en ${r.gruposActivos} grupos activos` : null} />
        <Kpi titulo="Sesiones del periodo" valor={r ? r.sesiones : "…"} detalle={r?.asistenciaPromedio !== null && r ? `${r.asistenciaPromedio} % de asistencia` : null} />
        <Kpi titulo="Horas otorgadas" valor={r ? horas(r.horasOtorgadas) : "…"} detalle="en el periodo" />
        <Kpi titulo="Completaron sus horas" valor={r ? r.cumplieron : "…"} detalle={r ? `${r.requeridas} horas requeridas` : null} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Tarjeta titulo="Clases de hoy" subtitulo={new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}>
          {r && r.clasesHoy.length === 0 && <Vacio>Hoy no hay clases en el horario de los grupos.</Vacio>}
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
            {r?.clasesHoy.map((c) => (
              <li key={c.id}>
                <Link to={`/deporte/grupos/${c.id}`} className="flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3 hover:bg-gray-50">
                  <IconoDisciplina nombre={c.disciplina} tamano={40} />
                  <span className="flex-1 min-w-0 leading-tight">
                    <span className="block font-bold text-ink-900 truncate">{c.nombre}</span>
                    <span className="block text-sm text-ink-500 truncate">
                      {c.franja.inicio}–{c.franja.fin}
                      {c.lugar ? ` · ${c.lugar}` : ""} · {c.inscritos} inscritos
                    </span>
                  </span>
                  {c.asistenciaTomada ? <Insignia tono="verde">Asistencia tomada</Insignia> : <Insignia tono="dorado">Tomar asistencia</Insignia>}
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <div className="flex flex-col gap-5">
          <Tarjeta titulo="Inscritos por disciplina">
            {r && r.porDisciplina.length === 0 && <Vacio>Sin inscripciones este periodo.</Vacio>}
            {r && <BarrasDisciplina datos={r.porDisciplina.map((d) => ({ nombre: d.nombre, horas: d.total }))} formato={(n) => `${n} inscrito${n === 1 ? "" : "s"}`} />}
          </Tarjeta>
          <Tarjeta titulo="Cerca de completar" subtitulo="Con el 75 % o más de las horas">
            {r && r.cercaDeCumplir.length === 0 && <Vacio>Nadie por ahora.</Vacio>}
            <ul className="list-none m-0 p-0">
              {r?.cercaDeCumplir.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 py-2 border-t border-gray-100 first:border-t-0 text-sm">
                  <Link to={`/deporte/estudiantes/${e.id}`} className="font-semibold text-ink-900 truncate">
                    {e.nombre}
                  </Link>
                  <span className="font-bold tabular-nums">{horas(e.total)}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      </div>
    </main>
  );
}

function EstudiantesPage() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => {
      http.get("/deporte/admin/estudiantes", { params: { q: q || undefined, estado: estado || undefined } }).then((r) => setDatos(r.data));
    }, 250);
    return () => clearTimeout(t);
  }, [q, estado]);
  return (
    <main className="max-w-[1160px] mx-auto px-5 sm:px-8 pt-9 pb-16">
      <Encabezado
        kicker="Deporte"
        titulo="Estudiantes y horas"
        descripcion={`Avance de cada estudiante hacia las ${datos?.requeridas || 40} horas requeridas. Busca a cualquier estudiante por nombre o correo para reconocerle horas por torneos o eventos.`}
        acciones={
          <button type="button" onClick={() => descargarReporte()} className={botonSecundario}>
            <Icono nombre="descarga" size={16} /> Excel
          </button>
        }
      />
      <div className="flex gap-2.5 flex-wrap mb-5">
        <label className="relative flex-[1_1_260px]">
          <span className="sr-only">Buscar</span>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
            <Icono nombre="buscar" size={18} />
          </span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o correo" className={`${claseCampo} pl-10`} />
        </label>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className={claseCampoCorto} aria-label="Estado">
          <option value="">Todos</option>
          <option value="pendientes">En curso</option>
          <option value="cumplieron">Completaron</option>
        </select>
      </div>
      <div className="bg-white border border-gray-200 rounded-[22px] overflow-hidden">
        {datos?.estudiantes.length === 0 && (
          <div className="p-5">
            <Vacio>No hay estudiantes con estos filtros.</Vacio>
          </div>
        )}
        <ul className="list-none m-0 p-0">
          {datos?.estudiantes.map((e) => (
            <li key={e.id} className="border-t border-gray-100 first:border-t-0">
              <Link to={`/deporte/estudiantes/${e.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 flex-wrap">
                <span className="flex-[1_1_220px] min-w-0 leading-tight">
                  <span className="block font-semibold text-ink-900 truncate">{e.nombre}</span>
                  <span className="block text-xs text-ink-500 truncate">
                    {e.email}
                    {e.gruposActivos.length ? ` · ${e.gruposActivos.join(", ")}` : ""}
                  </span>
                </span>
                <span className="flex-[1_1_200px] max-w-[280px]">
                  <span className="block h-2 rounded-full bg-gray-100 overflow-hidden">
                    <span className={`block h-full rounded-full ${e.cumplido ? "bg-[#0d9488]" : "bg-gold"}`} style={{ width: `${e.porcentaje}%` }} />
                  </span>
                  <span className="block text-xs text-ink-500 mt-1">
                    {horas(e.total)} de {datos.requeridas} · este periodo {horas(e.horasPeriodo)}
                  </span>
                </span>
                {e.cumplido ? <Insignia tono="verde">Completó</Insignia> : <Insignia tono="gris">{e.porcentaje} %</Insignia>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function EstudianteDetallePage() {
  const { id } = useParams();
  const { cat } = useCatalogosDeporte();
  const [d, setD] = useState(null);
  const [form, setForm] = useState({ horas: "", motivo: "", disciplinaId: "", fecha: hoyISO() });
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const cargar = useCallback(() => http.get(`/deporte/admin/estudiantes/${id}`).then((r) => setD(r.data)), [id]);
  useEffect(() => {
    cargar().catch((err) => setError(mensajeError(err, "No fue posible cargar al estudiante.")));
  }, [cargar]);

  async function reconocer(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    try {
      const r = await http.post(`/deporte/admin/estudiantes/${id}/horas`, { ...form, horas: Number(form.horas), disciplinaId: form.disciplinaId || undefined });
      setD(r.data);
      setForm({ horas: "", motivo: "", disciplinaId: "", fecha: hoyISO() });
      setAviso("Horas reconocidas.");
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar."));
    }
  }

  async function quitar(h) {
    if (!window.confirm(`¿Quitar ${horas(h.horas)} reconocidas por «${h.detalle}»?`)) return;
    try {
      const r = await http.delete(`/deporte/admin/horas/${h.id}`);
      setD(r.data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible quitar las horas."));
    }
  }

  if (!d) return <main className="max-w-[1160px] mx-auto px-5 sm:px-8 pt-9">{error ? <Aviso>{error}</Aviso> : <p className="text-ink-500">Cargando…</p>}</main>;
  return (
    <main className="max-w-[1160px] mx-auto px-5 sm:px-8 pt-9 pb-16 flex flex-col gap-6">
      <Link to="/deporte/estudiantes" className="text-sm font-bold text-primary-soft inline-flex items-center gap-1 w-fit">
        <Icono nombre="izquierda" size={16} /> Estudiantes
      </Link>
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h1 className="m-0 text-[30px] font-extrabold">{d.estudiante.nombre}</h1>
          <p className="m-0 mt-1 text-ink-500">{d.estudiante.email}</p>
        </div>
        <button type="button" onClick={() => descargar(`/deporte/admin/estudiantes/${id}/constancia`, {}, "constancia-horas-deporte.pdf")} className={botonPrimario}>
          <Icono nombre="descarga" size={17} /> Constancia
        </button>
      </div>
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <div className="bg-white border border-gray-200 rounded-[22px] p-5">
        <div className="flex justify-between items-end gap-3 flex-wrap mb-2">
          <p className="m-0 text-ink-600">
            <strong className="font-display text-3xl text-primary">{horas(d.total)}</strong> de {d.requeridas} horas
          </p>
          {d.cumplido ? <Insignia tono="verde">Requisito cumplido</Insignia> : <Insignia tono="dorado">Faltan {horas(d.faltan)}</Insignia>}
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${d.cumplido ? "bg-[#0d9488]" : "bg-gold"}`} style={{ width: `${d.porcentaje}%` }} />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] items-start">
        <Tarjeta titulo="Historial de horas">
          {d.historial.length === 0 && <Vacio>Sin horas registradas.</Vacio>}
          <ul className="list-none m-0 p-0">
            {d.historial.map((h) => (
              <li key={`${h.tipo}-${h.id}`} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <IconoDisciplina nombre={h.disciplina} tamano={34} />
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block font-semibold text-ink-900 truncate">
                    {h.grupo || h.disciplina} {h.tipo === "reconocida" && <Insignia tono="azul">Reconocida</Insignia>}
                  </span>
                  <span className="block text-xs text-ink-500 truncate">
                    {fechaCorta(h.fecha)} · {h.detalle}
                  </span>
                </span>
                <span className="font-bold tabular-nums">{horas(h.horas)}</span>
                {h.tipo === "reconocida" && (
                  <button type="button" onClick={() => quitar(h)} aria-label="Quitar horas reconocidas" className="w-8 h-8 rounded-full text-ink-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center">
                    <Icono nombre="cerrar" size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
        <div className="flex flex-col gap-5">
          <Tarjeta titulo="Reconocer horas" subtitulo="Torneos, representación institucional, eventos deportivos…">
            <form onSubmit={reconocer} className="flex flex-col gap-3">
              <div className="grid gap-3 grid-cols-2">
                <Campo etiqueta="Horas">
                  <input type="number" min="0.5" max="40" step="0.5" required value={form.horas} onChange={(e) => setForm((f) => ({ ...f, horas: e.target.value }))} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Fecha">
                  <input type="date" required max={hoyISO()} value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} className={claseCampo} />
                </Campo>
              </div>
              <Campo etiqueta="Motivo">
                <input required maxLength={200} value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} placeholder="Torneo regional de voleibol" className={claseCampo} />
              </Campo>
              <Campo etiqueta="Disciplina (opcional)">
                <select value={form.disciplinaId} onChange={(e) => setForm((f) => ({ ...f, disciplinaId: e.target.value }))} className={claseCampo}>
                  <option value="">Sin disciplina</option>
                  {cat?.disciplinas.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <button type="submit" className={botonPrimario}>
                Reconocer horas
              </button>
            </form>
          </Tarjeta>
          <Tarjeta titulo="Grupos">
            {d.inscripciones.length === 0 && <Vacio>Sin inscripciones.</Vacio>}
            <ul className="list-none m-0 p-0">
              {d.inscripciones.map((i) => (
                <li key={i.grupoId} className="flex justify-between gap-3 py-2 border-t border-gray-100 first:border-t-0 text-sm">
                  <Link to={`/deporte/grupos/${i.grupoId}`} className="font-semibold text-ink-900 truncate">
                    {i.grupo}
                  </Link>
                  <span className="text-ink-500 whitespace-nowrap">
                    {i.periodo} · {i.estado === "Activa" ? "Activo" : "Retirado"}
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      </div>
    </main>
  );
}

function DisciplinasPage() {
  const { cat, recargar } = useCatalogosDeporte();
  const [nueva, setNueva] = useState({ nombre: "", tipo: "Individual", descripcion: "" });
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    if (cat && !config) setConfig(cat.config);
  }, [cat, config]);

  async function accion(promesa, mensaje) {
    setError("");
    setAviso("");
    try {
      await promesa;
      await recargar();
      setAviso(mensaje);
      return true;
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar."));
      return false;
    }
  }

  return (
    <main className="max-w-[1160px] mx-auto px-5 sm:px-8 pt-9 pb-16">
      <Encabezado kicker="Deporte" titulo="Disciplinas y requisito" descripcion="Las disciplinas que oferta la Universidad y las horas que cada estudiante debe completar." />
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
                <IconoDisciplina nombre={d.nombre} tamano={40} />
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block font-bold text-ink-900">{d.nombre}</span>
                  <span className="block text-xs text-ink-500 truncate">
                    {d.tipo}
                    {d.descripcion ? ` · ${d.descripcion}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => accion(http.patch(`/deporte/admin/disciplinas/${d.id}`, { activa: !d.activa }), d.activa ? `${d.nombre} quedó oculta para nuevos grupos.` : `${d.nombre} está activa.`)}
                  className={`${botonSecundario} min-h-[36px] text-[13px]`}
                >
                  {d.activa ? "Desactivar" : "Activar"}
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              accion(http.post("/deporte/admin/disciplinas", nueva), `${nueva.nombre} agregada.`).then((ok) => ok && setNueva({ nombre: "", tipo: "Individual", descripcion: "" }));
            }}
            className="mt-4 pt-4 border-t border-gray-100 grid gap-3 sm:grid-cols-[1.2fr_1fr]"
          >
            <Campo etiqueta="Nueva disciplina">
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
            <div>
              <button type="submit" className={botonPrimario}>
                <Icono nombre="mas" size={16} strokeWidth={2.4} /> Agregar
              </button>
            </div>
          </form>
        </Tarjeta>
        <Tarjeta titulo="Requisito de horas">
          {config && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                accion(http.put("/deporte/admin/config", { horasRequeridas: Number(config.horasRequeridas), maxGruposPorPeriodo: Number(config.maxGruposPorPeriodo) }), "Requisito actualizado.");
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

export function DeportePanel() {
  return (
    <PanelLayout menu={MENU_DEPORTE} panel="deporte">
      <Routes>
        <Route index element={<InicioPersonal />} />
        <Route path="grupos" element={<GruposPage />} />
        <Route path="grupos/:id" element={<GrupoDetallePage />} />
        <Route path="estudiantes" element={<EstudiantesPage />} />
        <Route path="estudiantes/:id" element={<EstudianteDetallePage />} />
        <Route path="disciplinas" element={<DisciplinasPage />} />
      </Routes>
    </PanelLayout>
  );
}
