import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { horarioTexto, mensajeError } from "../comun/formato";

function Aviso({ tono = "rojo", children }) {
  const clase = tono === "verde" ? "bg-emerald-50 text-emerald-800 border-emerald-100" : "bg-red-50 text-red-700 border-red-100";
  return <p className={`m-0 mb-4 text-sm border rounded-xl px-4 py-3 ${clase}`}>{children}</p>;
}

function Marco({ titulo, texto, children }) {
  return (
    <main className="max-w-[1100px] mx-auto px-4 py-8">
      <h1 className="m-0 text-3xl font-extrabold">{titulo}</h1>
      {texto && <p className="mt-2 mb-6 text-ink-500 max-w-2xl">{texto}</p>}
      {children}
    </main>
  );
}

function fechaCorta(valor) {
  if (!valor) return "";
  const texto = String(valor).slice(0, 10);
  const fecha = new Date(`${texto}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return texto;
  return fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}

export function InicioCultura() {
  const [grupos, setGrupos] = useState(null);
  const [agenda, setAgenda] = useState([]);
  const [convocatorias, setConvocatorias] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    http.get("/cultura/perfil").then((r) => setPerfil(r.data)).catch(() => {});
    http.get("/cultura/grupos").then((r) => setGrupos(r.data)).catch(() => setGrupos({ inscritas: 0, maxGrupos: 2 }));
    http.get("/cultura/agenda").then((r) => setAgenda(r.data)).catch(() => {});
    http.get("/cultura/convocatorias").then((r) => setConvocatorias(r.data.filter((c) => c.postulacion))).catch(() => {});
  }, []);
  const proximo = [...agenda].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0];
  const eventosInscritos = agenda.filter((e) => e.inscrito).length;
  async function guardarTipo(tipoSnies) {
    const r = await http.put("/cultura/perfil", { tipoSnies: Number(tipoSnies) });
    setPerfil(r.data);
    setAviso("Quedó guardado tu tipo de usuario para el informe SNIES.");
  }
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-4 sm:pt-6 pb-16">
      <section className="relative rounded-[28px] text-white shadow-[0_24px_50px_rgba(15,23,42,0.18)]" style={{ background: "linear-gradient(115deg, #0F172A 0%, #134E4A 58%, #0F766E 100%)" }}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute -right-16 -top-24 w-[420px] h-[420px] rounded-full blur-3xl" style={{ background: "rgba(45,212,191,0.35)" }} />
        </div>
        <div className="relative px-6 sm:px-10 py-8 sm:py-10 grid gap-8 items-center lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 flex flex-col gap-3.5">
            <h1 className="m-0 font-sans text-[40px] sm:text-[56px] leading-[1.02] tracking-[-0.04em] font-extrabold text-white">Arte y Cultura</h1>
            <p className="m-0 text-[17px] leading-relaxed text-[#D7F7F3] max-w-[520px]">
              Grupos artísticos del periodo, presentaciones y convocatorias de Bienestar. La asistencia queda con tu usuario, la hora y la dirección IP.
            </p>
            <div className="flex gap-3 flex-wrap mt-2">
              <Link to="/mi-cultura/grupos" className="bg-[#2DD4BF] text-[#0F172A] font-extrabold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center shadow-[0_10px_24px_rgba(45,212,191,0.35)] no-underline">
                Ver grupos
              </Link>
              <Link to="/mi-cultura/agenda" className="bg-white/10 border-[1.5px] border-white/40 text-white font-bold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center no-underline hover:bg-white/15">
                Ver agenda
              </Link>
            </div>
          </div>
          <section className="w-full min-w-0 bg-white text-[#0F172A] rounded-[24px] p-6 sm:p-7 flex flex-col gap-3 shadow-[0_24px_60px_rgba(2,10,28,0.28)]">
            <h2 className="m-0 font-sans text-lg font-bold">Próximo evento</h2>
            {!proximo && <p className="m-0 text-[#64748B]">Todavía no hay presentaciones publicadas.</p>}
            {proximo && (
              <>
                <strong className="text-[18px] leading-snug">{proximo.nombre}</strong>
                <p className="m-0 text-sm text-[#64748B]">
                  {fechaCorta(proximo.fecha)}
                  {proximo.horaInicio ? ` · ${proximo.horaInicio}` : ""}
                </p>
                {proximo.lugar && <p className="m-0 text-sm text-[#64748B]">{proximo.lugar}</p>}
                {proximo.inscrito && <p className="m-0 text-sm font-bold text-[#0F766E]">Ya estás inscrito.</p>}
              </>
            )}
            <Link to="/mi-cultura/agenda" className="self-start mt-1 font-bold text-sm px-4 min-h-[44px] inline-flex items-center rounded-full bg-[#CCFBF1] text-[#0F172A] no-underline hover:bg-[#99F6E4]">
              {proximo?.inscrito ? "Ver mi inscripción" : "Ir a la agenda"}
            </Link>
          </section>
        </div>
      </section>

      <div className="pt-8">
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <section className="bg-white border border-[#E7E2D6] rounded-[24px] p-5 sm:p-7 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <h2 className="m-0 mb-4 text-xl font-extrabold text-[#0F172A]">Tu perfil para el informe</h2>
      <label className="text-sm font-semibold flex flex-col gap-1 max-w-sm mb-6">
        Tipo de usuario (código SNIES de esta ficha)
        <select className="border rounded-xl px-3 min-h-[44px]" value={perfil?.tipoSnies || 1} onChange={(e) => guardarTipo(e.target.value)}>
          {(perfil?.tipos || [
            { codigo: 1, nombre: "Estudiante" },
            { codigo: 2, nombre: "Docente" },
            { codigo: 3, nombre: "Administrativo" },
            { codigo: 4, nombre: "Egresado" },
          ]).map((t) => (
            <option key={t.codigo} value={t.codigo}>{t.codigo} · {t.nombre}</option>
          ))}
        </select>
      </label>
      <form
        key={`${perfil?.documento || ""}-${perfil?.programa || ""}-${perfil?.caracterizacion || ""}`}
        className="grid gap-3 sm:grid-cols-3 mb-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          const r = await http.put("/cultura/perfil", {
            tipoSnies: perfil?.tipoSnies || 1,
            documento: datos.get("documento"),
            programa: datos.get("programa"),
            caracterizacion: datos.get("caracterizacion"),
          });
          setPerfil(r.data);
          setAviso("Quedaron guardados tu programa, tu cédula y tu caracterización.");
        }}
      >
        <label className="text-sm font-semibold">Cédula<input name="documento" defaultValue={perfil?.documento || ""} className="border rounded-xl px-3 min-h-[44px] w-full mt-1" /></label>
        <label className="text-sm font-semibold">Programa académico<input name="programa" defaultValue={perfil?.programa || ""} className="border rounded-xl px-3 min-h-[44px] w-full mt-1" /></label>
        <label className="text-sm font-semibold">Caracterización
          <select name="caracterizacion" defaultValue={perfil?.caracterizacion || "No registra"} className="border rounded-xl px-3 min-h-[44px] w-full mt-1">
            {(perfil?.caracterizaciones || ["No registra"]).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <button className="boton-liquido min-h-[44px] px-4 rounded-full font-bold w-fit">Guardar perfil</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/mi-cultura/grupos" className="bg-white border border-[#E7E2D6] rounded-2xl p-5 no-underline text-[#0F172A] shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="m-0 text-sm text-ink-500">Grupos</p>
          <p className="m-0 mt-1 text-2xl font-extrabold">{grupos ? `${grupos.inscritas} de ${grupos.maxGrupos}` : "…"}</p>
        </Link>
        <Link to="/mi-cultura/agenda" className="bg-white border border-[#E7E2D6] rounded-2xl p-5 no-underline text-[#0F172A] shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="m-0 text-sm text-[#64748B]">Eventos en los que estás</p>
          <p className="m-0 mt-1 text-2xl font-extrabold">{eventosInscritos}</p>
        </Link>
        <Link to="/mi-cultura/convocatorias" className="bg-white border border-[#E7E2D6] rounded-2xl p-5 no-underline text-[#0F172A] shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="m-0 text-sm text-ink-500">Postulaciones</p>
          <p className="m-0 mt-1 text-2xl font-extrabold">{convocatorias.length}</p>
        </Link>
      </div>
      </section>
      </div>
    </main>
  );
}

export function GruposCultura() {
  const [oferta, setOferta] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    http.get("/cultura/grupos").then((r) => setOferta(r.data)).catch(() => setError("No fue posible cargar los grupos."));
  }, []);

  async function accion(grupo, tipo) {
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const r =
        tipo === "inscribir"
          ? await http.post(`/cultura/grupos/${grupo.id}/inscripcion`)
          : tipo === "asistencia"
            ? await http.post(`/cultura/grupos/${grupo.id}/asistencia`)
            : await http.delete(`/cultura/grupos/${grupo.id}/inscripcion`);
      if (tipo !== "asistencia") setOferta(r.data);
      setAviso(tipo === "inscribir" ? `Quedaste inscrito en ${grupo.nombre}.` : tipo === "asistencia" ? "Quedó registrada tu asistencia de hoy, con hora e IP." : `Te retiraste de ${grupo.nombre}.`);
    } catch (err) {
      setError(mensajeError(err, "No fue posible completar la acción."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Marco titulo="Grupos artísticos" texto={oferta ? `Periodo ${oferta.periodo}. Puedes estar en ${oferta.maxGrupos} grupos (llevas ${oferta.inscritas}).` : ""}>
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      {(oferta?.areas || []).map((area) => (
        <section key={area.id} className="mb-8">
                  <h2 className="m-0 mb-3 text-xl font-extrabold">{area.nombre}</h2>
                  <p className="m-0 -mt-2 mb-3 text-sm text-ink-500">{area.categoria}</p>
          <div className="grid gap-3">
            {area.grupos.map((grupo) => (
              <article key={grupo.id} className="bg-white border rounded-2xl p-4 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <h3 className="m-0 font-extrabold">{grupo.nombre}</h3>
                  <p className="m-0 mt-1 text-sm text-ink-500">
                    {horarioTexto(grupo.horario)}
                    {grupo.lugar ? ` · ${grupo.lugar}` : ""}
                    {grupo.director ? ` · ${grupo.director}` : ""}
                  </p>
                  <p className="m-0 mt-1 text-sm">{grupo.cuposDisponibles} cupos libres</p>
                </div>
                {grupo.inscrito ? (
                  <div className="flex gap-2">
                    <button type="button" disabled={ocupado} onClick={() => accion(grupo, "asistencia")} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold">
                      Registrar asistencia
                    </button>
                    <button type="button" disabled={ocupado} onClick={() => accion(grupo, "retirar")} className="min-h-[44px] px-4 rounded-full border font-bold">
                      Retirarme
                    </button>
                  </div>
                ) : grupo.cuposDisponibles < 1 ? (
                  <button type="button" disabled className="min-h-[44px] px-4 rounded-full border font-bold opacity-60">
                    Sin cupos
                  </button>
                ) : (
                  <button type="button" disabled={ocupado || !grupo.inscripcionesAbiertas} onClick={() => accion(grupo, "inscribir")} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold disabled:opacity-50">
                    Inscribirme
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
      {oferta && oferta.areas.length === 0 && <p className="text-ink-500">Todavía no hay grupos publicados en este periodo.</p>}
    </Marco>
  );
}

export function AgendaCultura() {
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  function cargar() {
    http.get("/cultura/agenda").then((r) => setEventos(r.data)).catch(() => setError("No fue posible cargar la agenda."));
  }
  useEffect(cargar, []);
  async function accion(evento, tipo) {
    setOcupado(true);
    setError("");
    try {
      const r = tipo === "inscribir" ? await http.post(`/cultura/agenda/${evento.id}/inscripcion`) : await http.delete(`/cultura/agenda/${evento.id}/inscripcion`);
      setEventos(r.data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible completar la acción."));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <Marco titulo="Agenda cultural" texto="Presentaciones, muestras y talleres publicados por el área.">
      {error && <Aviso>{error}</Aviso>}
      <div className="grid gap-3">
        {(eventos || []).map((evento) => (
          <article key={evento.id} className="bg-white border rounded-2xl p-4 flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="m-0 font-extrabold">{evento.nombre}</h2>
              <p className="m-0 mt-1 text-sm text-ink-500">
                {evento.fecha} · {evento.horaInicio}–{evento.horaFin}
                {evento.lugar ? ` · ${evento.lugar}` : ""}
              </p>
              {evento.descripcion && <p className="m-0 mt-2 text-sm">{evento.descripcion}</p>}
              {evento.representacion && <p className="m-0 mt-1 text-sm">Representación artística: {evento.representacion}</p>}
              <p className="m-0 mt-1 text-sm">{evento.cuposDisponibles} cupos · inscripción hasta {evento.fechaLimite}</p>
            </div>
            {evento.inscrito ? (
              <button type="button" disabled={ocupado} onClick={() => accion(evento, "cancelar")} className="min-h-[44px] px-4 rounded-full border font-bold">
                Cancelar inscripción
              </button>
            ) : evento.cuposDisponibles < 1 ? (
              <button type="button" disabled className="min-h-[44px] px-4 rounded-full border font-bold opacity-60">Sin cupos</button>
            ) : (
              <button type="button" disabled={ocupado || !evento.abierta} onClick={() => accion(evento, "inscribir")} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold disabled:opacity-50">
                Inscribirme
              </button>
            )}
          </article>
        ))}
      </div>
      {eventos && eventos.length === 0 && <p className="text-ink-500">No hay eventos publicados.</p>}
    </Marco>
  );
}

export function ConvocatoriasCultura() {
  const [lista, setLista] = useState(null);
  const [textos, setTextos] = useState({});
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    http.get("/cultura/convocatorias").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar las convocatorias."));
  }, []);
  async function enviar(id) {
    setOcupado(true);
    setError("");
    try {
      const r = await http.post(`/cultura/convocatorias/${id}/postulacion`, { motivacion: textos[id] || "" });
      setLista(r.data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible enviar la postulación."));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <Marco titulo="Convocatorias" texto="Postúlate con una motivación breve. El área revisa y acepta o rechaza.">
      {error && <Aviso>{error}</Aviso>}
      <div className="grid gap-4">
        {(lista || []).map((c) => (
          <article key={c.id} className="bg-white border rounded-2xl p-4">
            <h2 className="m-0 font-extrabold">{c.titulo}</h2>
            <p className="m-0 mt-1 text-sm text-ink-500">Cierra el {c.cierra}</p>
            {c.descripcion && <p className="mt-2 mb-0 text-sm">{c.descripcion}</p>}
            {c.postulacion ? (
              <p className="mt-3 mb-0 font-bold">Tu postulación está {c.postulacion.estado.toLowerCase()}.</p>
            ) : (
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviar(c.id);
                }}
              >
                <label className="text-sm font-semibold" htmlFor={`mot-${c.id}`}>
                  Motivación
                </label>
                <textarea id={`mot-${c.id}`} maxLength={500} value={textos[c.id] || ""} onChange={(e) => setTextos({ ...textos, [c.id]: e.target.value })} className="border rounded-xl px-3 py-2 min-h-[90px]" />
                <button type="submit" disabled={ocupado} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold w-fit disabled:opacity-50">
                  Enviar postulación
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
      {lista && lista.length === 0 && <p className="text-ink-500">No hay convocatorias abiertas.</p>}
    </Marco>
  );
}
