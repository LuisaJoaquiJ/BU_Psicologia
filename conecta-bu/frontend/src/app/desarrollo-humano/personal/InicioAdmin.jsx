import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { useAuth } from "../../../lib/auth/AuthContext";
import { fechaLarga, formatearHora } from "../comunes/lib/format";
import { hoyLargo } from "../comunes/componentes/ui";

const ESTADO_ESTILOS = {
  Agendada: "bg-primary-light text-primary-soft",
  Atendida: "bg-[#E7F4EE] text-[#1D6B4A]",
  NoAsistio: "bg-gold-light text-[#7A5405]",
  Cancelada: "bg-gray-100 text-ink-500",
};
const ESTADO_TEXTO = { Agendada: "Agendada", Atendida: "Atendida", NoAsistio: "No asistió", Cancelada: "Cancelada" };
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Fecha local como "AAAA-MM-DD" (las fechas de horarios y eventos llegan asi).
function iso(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

// Los 7 dias (lunes a domingo) de la semana actual.
function semanaActual() {
  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
  return DIAS.map((nombre, i) => {
    const d = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
    return { nombre, numero: d.getDate(), fecha: iso(d), finDeSemana: i >= 5 };
  });
}

function saludo() {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Entrada al cargar: los bloques aparecen en cascada (50 ms entre uno y otro).
// Con "reducir movimiento" solo se desvanecen, sin desplazarse.
const ENTRA = "animate-aparecer motion-reduce:animate-aparecer-suave";
const retraso = (ms) => ({ animationDelay: `${ms}ms` });
const dia = (valor) => String(valor || "").slice(0, 10);
// "Mié 21" a partir de una fecha "AAAA-MM-DD…".
const diaCorto = (fecha) => {
  const f = new Date(`${dia(fecha)}T12:00:00`);
  return `${DIAS[(f.getDay() + 6) % 7]} ${f.getDate()}`;
};

// Fondo de la banda: manchas de luz que se mueven despacio (quietas si la
// persona pidio reducir el movimiento en su sistema).
function Aurora() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="absolute w-[620px] h-[620px] -left-40 -top-64 rounded-full blur-[30px] bg-[radial-gradient(circle,rgba(29,78,158,0.95)_0%,rgba(29,78,158,0)_70%)] animate-deriva-a motion-reduce:animate-none" />
      <div className="absolute w-[560px] h-[560px] left-[38%] -top-32 rounded-full blur-[40px] bg-[radial-gradient(circle,rgba(30,158,154,0.85)_0%,rgba(30,158,154,0)_70%)] animate-deriva-b motion-reduce:animate-none" />
      <div className="absolute w-[520px] h-[520px] left-[18%] -bottom-[330px] rounded-full blur-[40px] bg-[radial-gradient(circle,rgba(201,162,63,0.6)_0%,rgba(201,162,63,0)_70%)] animate-deriva-c motion-reduce:animate-none" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,26,56,0)_55%,rgba(7,26,56,0.55)_100%)]" />
    </div>
  );
}

// Calendario de la semana sobre la aurora: citas, eventos y horarios libres por dia.
function TuSemana({ semana, hoy, citas, eventos, horarios }) {
  const delDia = (lista, fecha, campo) => lista.filter((x) => dia(campo(x)) === fecha);
  const eventosSemana = eventos.filter((e) => dia(e.fecha) >= semana[0].fecha && dia(e.fecha) <= semana[6].fecha);
  const citasSemana = citas.filter((c) => dia(c.horario?.fecha) >= hoy && dia(c.horario?.fecha) <= semana[6].fecha);
  const libresSemana = horarios.filter((h) => dia(h.fecha) >= hoy && dia(h.fecha) <= semana[6].fecha);
  return (
    <section aria-label="Tu semana" style={retraso(200)} className={`relative flex-[1_1_360px] min-w-0 rounded-[22px] p-5 sm:p-[22px] bg-white/[0.12] border border-white/[0.28] shadow-[0_30px_60px_rgba(2,10,28,0.45)] ${ENTRA}`}>
      <h2 className="m-0 font-sans text-lg font-bold text-white">Tu semana</h2>
      <p className="mt-0.5 mb-4 text-sm text-white/75">Citas, eventos y horarios libres</p>
      <ol className="list-none m-0 p-0 grid grid-cols-7 gap-1.5 text-center">
        {semana.map((d) => {
          const esHoy = d.fecha === hoy;
          const nCitas = delDia(citas, d.fecha, (c) => c.horario?.fecha).length;
          const nEventos = delDia(eventos, d.fecha, (e) => e.fecha).length;
          const nLibres = d.fecha >= hoy ? delDia(horarios, d.fecha, (h) => h.fecha).length : 0;
          const detalle = [nCitas && plural(nCitas, "cita", "citas"), nEventos && plural(nEventos, "evento", "eventos"), nLibres && plural(nLibres, "horario libre", "horarios libres")].filter(Boolean);
          return (
            <li
              key={d.fecha}
              aria-label={`${d.nombre} ${d.numero}${esHoy ? ", hoy" : ""}: ${detalle.length ? detalle.join(", ") : "sin actividad"}`}
              className={`rounded-xl pt-2 pb-2.5 ${esHoy ? "bg-[linear-gradient(180deg,#7FE8FF,#1E9E9A)] text-[#071A38]" : d.finDeSemana ? "bg-white/[0.04] text-white/55" : "bg-white/10 text-white"}`}
            >
              <span className={`block text-xs ${esHoy ? "font-semibold" : "opacity-75"}`}>{d.nombre}</span>
              <span className="block text-xl font-extrabold tabular-nums leading-tight">{d.numero}</span>
              <span className="flex justify-center gap-[3px] h-1.5 mt-1">
                {nCitas > 0 && <span className={`w-1.5 h-1.5 rounded-full ${esHoy ? "bg-[#071A38]" : "bg-cyan"}`} />}
                {nEventos > 0 && <span className="w-1.5 h-1.5 rounded-full bg-gold-soft" />}
                {nLibres > 0 && <span className={`w-1.5 h-1.5 rounded-full border ${esHoy ? "border-[#071A38]" : "border-white/80"}`} />}
              </span>
            </li>
          );
        })}
      </ol>
      <ul className="list-none m-0 mt-4 p-0 flex flex-col gap-2.5 text-[15px] text-white">
        {eventosSemana.slice(0, 2).map((e) => (
          <li key={e.id} className="flex gap-2.5 items-center min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-gold-soft shrink-0" aria-hidden="true" />
            <span className="truncate">
              <strong>{diaCorto(e.fecha)}</strong> · {e.nombre}
            </span>
          </li>
        ))}
        <li className="flex gap-2.5 items-center">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan shrink-0" aria-hidden="true" />
          <span className="text-white/85">{citasSemana.length ? `${plural(citasSemana.length, "cita agendada", "citas agendadas")} desde hoy` : "Sin citas agendadas esta semana"}</span>
        </li>
        <li className="flex gap-2.5 items-center">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-white/70 shrink-0 box-border" aria-hidden="true" />
          <span className="text-white/85">{libresSemana.length ? plural(libresSemana.length, "horario libre para agendar", "horarios libres para agendar") : "Sin horarios libres esta semana"}</span>
        </li>
      </ul>
    </section>
  );
}

function Cifra({ titulo, valor, detalle }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-sm text-ink-500">{titulo}</p>
      <p className="mt-1 mb-0 text-[34px] sm:text-[36px] font-extrabold tracking-[-0.03em] leading-tight text-primary-dark tabular-nums">
        {valor}
        {detalle && <span className="ml-1.5 text-lg font-semibold tracking-normal text-ink-500">{detalle}</span>}
      </p>
    </div>
  );
}

// Anillo de asistencia con el degradado de la marca (cian -> turquesa -> azul).
function AnilloAsistencia({ tasa, detalle }) {
  const valor = Math.max(0, Math.min(100, Number(tasa) || 0));
  const largo = 2 * Math.PI * 78;
  return (
    <svg width="190" height="190" viewBox="0 0 190 190" role="img" aria-label={`Asistencia a citas: ${tasa === null || tasa === undefined ? "sin datos" : `${valor} %`}. ${detalle}`} className="shrink-0 mx-auto sm:mx-0">
      <defs>
        <linearGradient id="anillo-asistencia" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7FE8FF" />
          <stop offset="50%" stopColor="#1E9E9A" />
          <stop offset="100%" stopColor="#1D4E9E" />
        </linearGradient>
      </defs>
      <circle cx="95" cy="95" r="78" fill="none" stroke="#EEF2F7" strokeWidth="18" />
      {valor > 0 && (
        // El anillo se dibuja hasta su valor cuando llegan los datos.
        <circle
          cx="95"
          cy="95"
          r="78"
          fill="none"
          stroke="url(#anillo-asistencia)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={`${(valor / 100) * largo} ${largo}`}
          transform="rotate(-90 95 95)"
          className="animate-trazo motion-reduce:animate-none"
          style={{ "--desde": `${(valor / 100) * largo}`, animationDelay: "250ms" }}
        />
      )}
      <text x="95" y="96" textAnchor="middle" fontSize="44" fontWeight="800" fill="#0B2347" fontFamily="DM Sans, sans-serif">
        {tasa === null || tasa === undefined ? "—" : `${Math.round(valor)} %`}
      </text>
      <text x="95" y="124" textAnchor="middle" fontSize="14" fill="#5B5C68" fontFamily="DM Sans, sans-serif">
        asistencia
      </text>
    </svg>
  );
}

function Tarea({ a, titulo, detalle, orden }) {
  return (
    <li className={ENTRA} style={retraso(340 + orden * 50)}>
      <Link to={a} className="relative flex gap-3 items-start p-3.5 rounded-[14px] bg-white/[0.12] text-white no-underline hover:bg-white/[0.18] min-h-[44px]">
        <span aria-hidden="true" className="w-[22px] h-[22px] rounded-[7px] border-2 border-cyan shrink-0 mt-px" />
        <span className="leading-snug min-w-0">
          <strong className="block text-[15px]">{titulo}</strong>
          <span className="text-sm text-white/[0.78]">{detalle}</span>
        </span>
      </Link>
    </li>
  );
}

// Portada de un evento: su foto o, si no tiene, un degradado de la marca.
function PortadaEvento({ evento, children }) {
  return (
    <div className="relative h-[130px] overflow-hidden bg-primary-dark flex items-end p-3">
      {evento.imagenUrl ? (
        <img src={evento.imagenUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div aria-hidden="true">
          <div className="absolute w-[220px] h-[220px] -left-10 -top-24 rounded-full bg-[radial-gradient(circle,rgba(127,232,255,0.9)_0%,rgba(127,232,255,0)_70%)] animate-deriva-a motion-reduce:animate-none" />
          <div className="absolute w-[220px] h-[220px] -right-12 -bottom-28 rounded-full bg-[radial-gradient(circle,rgba(30,158,154,0.9)_0%,rgba(30,158,154,0)_70%)] animate-deriva-b motion-reduce:animate-none" />
        </div>
      )}
      <span className="relative">{children}</span>
    </div>
  );
}

// Inicio del panel de Desarrollo Humano: saludo sobre una aurora con la
// semana, indicadores (RF-015), pendientes del dia, citas (RF-008) y eventos (RF-011).
export function InicioAdmin() {
  const { usuario } = useAuth();
  const [stats, setStats] = useState(null);
  const [todas, setTodas] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [errorCitas, setErrorCitas] = useState("");

  useEffect(() => {
    http
      .get("/admin/estadisticas")
      .then((res) => setStats(res.data))
      .catch(() => setStats(false));
    // Todas las citas del modulo: de ahi salen las de hoy, las proximas y las
    // que esperan registro de asistencia.
    http
      .get("/admin/citas")
      .then((res) => setTodas(res.data.citas))
      .catch((err) => {
        setTodas([]);
        setErrorCitas(err.response?.data?.message || "No pudimos cargar las citas. Revisa que el servidor esté encendido.");
      });
    http
      .get("/admin/eventos", { params: { estado: "Publicado" } })
      .then((res) => setEventos(res.data.eventos))
      .catch(() => setEventos([]));
    http
      .get("/admin/horarios")
      .then((res) => setHorarios(res.data.horarios.filter((h) => !h.ocupado)))
      .catch(() => setHorarios([]));
  }, []);

  const hoy = iso(new Date());
  const semana = semanaActual();
  const diaCita = (c) => dia(c.horario?.fecha);
  const orden = (a, b) => (diaCita(a) + String(a.horario?.horaInicio)).localeCompare(diaCita(b) + String(b.horario?.horaInicio));
  const lista = [...(todas || [])].sort(orden);
  const activas = lista.filter((c) => c.estado !== "Cancelada");
  const agenda = todas ? activas.filter((c) => diaCita(c) === hoy) : null;
  const pendientes = lista.filter((c) => c.estado === "Agendada" && diaCita(c) < hoy);
  const proximas = lista.filter((c) => c.estado === "Agendada" && diaCita(c) > hoy);
  const vistaAgenda = agenda && agenda.length ? agenda : proximas.slice(0, 5);

  const proximosEventos = eventos.filter((e) => dia(e.fecha) >= hoy);
  const sinRegistrar = stats ? stats.eventosDetalle.filter((e) => dia(e.fecha) < hoy && e.sinRegistrar > 0) : [];
  const libresSemana = horarios.filter((h) => dia(h.fecha) >= hoy && dia(h.fecha) <= semana[6].fecha);
  const conCupos = proximosEventos.find((e) => (e._count?.inscripciones ?? 0) < e.cupos);

  // Pendientes del dia, cada uno con el lugar donde se resuelve.
  const tareas = [
    ...(agenda || [])
      .filter((c) => c.estado === "Agendada")
      .slice(0, 1)
      .map((c) => ({ a: "/admin/citas", titulo: `Atender a ${c.usuario?.nombre?.split(" ")[0] || "tu estudiante"}`, detalle: `${formatearHora(c.horario?.horaInicio)} · ${c.horario?.servicio?.nombre || "Cita"}` })),
    ...(pendientes.length ? [{ a: "/admin/citas", titulo: "Registrar asistencia de citas", detalle: `${plural(pendientes.length, "cita pasada espera", "citas pasadas esperan")} registro` }] : []),
    ...sinRegistrar.slice(0, 2).map((e) => ({ a: `/admin/eventos/${e.id}/inscritos`, titulo: "Registrar asistencia", detalle: `${e.nombre} · ${plural(e.sinRegistrar, "inscrito", "inscritos")} sin registrar` })),
    ...(libresSemana.length === 0 ? [{ a: "/admin/horarios?agregar=1", titulo: "Publicar horarios de la semana", detalle: "No hay horarios libres para agendar" }] : []),
    ...(conCupos ? [{ a: "/admin/eventos", titulo: `Difundir ${conCupos.nombre}`, detalle: `${plural(conCupos._count?.inscripciones ?? 0, "inscrito", "inscritos")} de ${conCupos.cupos} cupos` }] : []),
  ].slice(0, 4);

  const texto = !agenda
    ? "Cargando tu día…"
    : agenda.length
      ? `Hoy tienes ${plural(agenda.length, "cita", "citas")}.`
      : proximas.length
        ? `Hoy no tienes citas. Tu próxima es el ${fechaLarga(proximas[0].horario?.fecha).toLowerCase()} a las ${formatearHora(proximas[0].horario?.horaInicio)}.`
        : "Hoy no tienes citas. Es un buen día para preparar la semana.";

  return (
    <>
      <section className="relative overflow-hidden bg-[#071A38] text-white">
        <Aurora />
        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-12 sm:pt-16 pb-28 flex flex-wrap gap-10 items-end">
          <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-4">
            <p className={`m-0 text-[15px] font-semibold text-[#9EEFFF] ${ENTRA}`}>{hoyLargo()}</p>
            <h1 style={retraso(50)} className={`${ENTRA} m-0 font-sans text-[44px] sm:text-[64px] lg:text-[72px] leading-[0.98] tracking-[-0.045em] font-extrabold max-w-[8em] bg-[linear-gradient(100deg,#FFFFFF_0%,#FFFFFF_45%,#B8F4FF_75%,#EAD8A2_100%)] bg-clip-text text-transparent`}>
              {saludo()}, {usuario?.nombre?.split(" ")[0]}
            </h1>
            <p style={retraso(100)} className={`m-0 text-[17px] sm:text-[19px] leading-normal text-white/[0.84] max-w-[30em] ${ENTRA}`}>
              {texto}
            </p>
            <div style={retraso(150)} className={`flex flex-wrap gap-2.5 mt-1.5 ${ENTRA}`}>
              <Link
                to="/admin/horarios?agregar=1"
                className="min-h-[50px] inline-flex items-center px-6 rounded-full bg-[linear-gradient(100deg,#7FE8FF_0%,#3FD0C9_55%,#1E9E9A_100%)] text-[#071A38] font-extrabold text-[15px] no-underline transition hover:-translate-y-px hover:shadow-[0_10px_28px_rgba(127,232,255,0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                Publicar horario
              </Link>
              <Link to="/admin/eventos?nuevo=1" className="min-h-[50px] inline-flex items-center px-[22px] rounded-full bg-white/10 border-[1.5px] border-white/35 text-white font-bold text-[15px] no-underline hover:bg-white/[0.18]">
                Nuevo evento
              </Link>
              <Link to="/admin/citas?sincita=1" className="min-h-[50px] inline-flex items-center px-[22px] rounded-full bg-white/10 border-[1.5px] border-white/35 text-white font-bold text-[15px] no-underline hover:bg-white/[0.18]">
                Atender sin cita
              </Link>
            </div>
          </div>
          <TuSemana semana={semana} hoy={hoy} citas={activas} eventos={eventos} horarios={horarios} />
        </div>
      </section>

      <main className="relative max-w-[1440px] mx-auto -mt-[72px] px-4 sm:px-6 lg:px-10 pb-16 grid gap-5 grid-cols-1 lg:grid-cols-3">
        {stats === false && <p className="lg:col-span-3 m-0 text-sm text-red-700 bg-red-50 rounded-xl p-3">No fue posible cargar los indicadores.</p>}

        <section aria-label="Indicadores" style={retraso(220)} className={`lg:col-span-2 bg-white rounded-3xl p-6 sm:p-7 shadow-[0_18px_50px_rgba(7,26,56,0.14)] flex flex-wrap gap-8 items-center ${ENTRA}`}>
          <AnilloAsistencia tasa={stats ? stats.citas.tasaAsistencia : null} detalle={stats ? `${stats.citas.atendidas} de ${stats.citas.atendidas + stats.citas.noAsistieron} atendidas` : ""} />
          <div className="flex-[1_1_280px] min-w-0 grid grid-cols-2 gap-x-7 gap-y-6">
            <Cifra titulo="Citas atendidas" valor={stats ? stats.citas.atendidas : "…"} detalle={stats ? `de ${stats.citas.atendidas + stats.citas.noAsistieron}` : null} />
            <Cifra titulo="Citas de hoy" valor={agenda ? agenda.length : "…"} />
            <Cifra titulo="Inscritos a eventos" valor={stats ? stats.eventos.inscritos : "…"} detalle={stats ? `en ${plural(stats.eventos.eventos, "evento", "eventos")}` : null} />
            <Cifra titulo="Estudiantes registrados" valor={stats ? stats.estudiantesRegistrados : "…"} />
          </div>
        </section>

        <section aria-label="Para hoy" style={retraso(270)} className={`relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white bg-[linear-gradient(155deg,#0B2347_0%,#1D4E9E_55%,#1E9E9A_100%)] shadow-[0_18px_50px_rgba(7,26,56,0.22)] flex flex-col gap-3 ${ENTRA}`}>
          <div aria-hidden="true" className="absolute w-[260px] h-[260px] -right-24 -bottom-28 rounded-full bg-[radial-gradient(circle,rgba(127,232,255,0.6)_0%,rgba(127,232,255,0)_70%)] animate-brillo motion-reduce:animate-none" />
          <h2 className="relative m-0 mb-1 font-sans text-[19px] font-bold text-white">Para hoy</h2>
          {tareas.length ? (
            <ul className="relative list-none m-0 p-0 flex flex-col gap-2.5">
              {tareas.map((t, i) => (
                <Tarea key={t.titulo + t.detalle} orden={i} {...t} />
              ))}
            </ul>
          ) : (
            <p className="relative m-0 text-[15px] leading-relaxed text-white/85">{todas && stats ? "Todo al día: no hay asistencias por registrar y tienes horarios publicados." : "Revisando tus pendientes…"}</p>
          )}
        </section>

        {(errorCitas || (agenda && vistaAgenda.length > 0)) && (
          <section aria-label="Citas" style={retraso(320)} className={`lg:col-span-3 bg-white rounded-3xl p-6 sm:p-7 shadow-[0_18px_50px_rgba(7,26,56,0.08)] ${ENTRA}`}>
            <div className="flex justify-between items-baseline gap-3 mb-2">
              <h2 className="m-0 font-sans text-[19px] font-bold">{agenda && agenda.length ? "Citas de hoy" : "Próximas citas"}</h2>
              <Link to="/admin/citas" className="py-2 text-sm font-bold text-primary-soft">
                Ver citas
              </Link>
            </div>
            {errorCitas && <p className="m-0 mb-2 text-sm font-semibold text-red-700 bg-red-50 rounded-xl px-3 py-2">{errorCitas}</p>}
            <ul className="list-none m-0 p-0 grid gap-x-8 md:grid-cols-2">
              {vistaAgenda.map((cita) => (
                <li key={cita.id} className="flex items-center gap-3.5 py-3 border-t border-gray-100">
                  <span className="shrink-0 w-24 tabular-nums font-bold text-sm text-primary leading-tight">
                    {diaCita(cita) !== hoy && (
                      <span className="block text-xs font-semibold text-ink-500">
                        {diaCorto(cita.horario?.fecha)}
                      </span>
                    )}
                    <span className="whitespace-nowrap">{formatearHora(cita.horario?.horaInicio)}</span>
                  </span>
                  <span className="flex-1 min-w-0 text-sm">
                    <strong className="block truncate">{cita.usuario?.nombre}</strong>
                    <span className="text-ink-500">{cita.horario?.servicio?.nombre}</span>
                  </span>
                  <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${ESTADO_ESTILOS[cita.estado] || ""}`}>{ESTADO_TEXTO[cita.estado] || cita.estado}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Eventos" style={retraso(370)} className={`lg:col-span-3 bg-white rounded-3xl p-6 sm:p-7 shadow-[0_18px_50px_rgba(7,26,56,0.08)] ${ENTRA}`}>
          <div className="flex justify-between items-baseline gap-3">
            <h2 className="m-0 font-sans text-[19px] font-bold">Eventos</h2>
            <Link to="/admin/estadisticas" className="py-2 text-sm font-bold text-primary-soft">
              Estadísticas
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proximosEventos.slice(0, 2).map((e) => {
              const inscritos = e._count?.inscripciones ?? 0;
              const pct = e.cupos ? Math.min(100, Math.round((inscritos / e.cupos) * 100)) : 0;
              return (
                <article key={e.id} className="rounded-[18px] overflow-hidden border border-[#E8EBF1]">
                  <PortadaEvento evento={e}>
                    <span className="bg-white/95 text-primary-dark text-[13px] font-bold rounded-full px-3 py-1">
                      {diaCorto(e.fecha)} · {formatearHora(e.horaInicio)}
                    </span>
                  </PortadaEvento>
                  <div className="p-4">
                    <strong className="block text-base truncate" title={e.nombre}>
                      {e.nombre}
                    </strong>
                    <span className="text-sm text-ink-500">
                      {plural(inscritos, "inscrito", "inscritos")} de {e.cupos} cupos
                    </span>
                    <div className="mt-2.5 h-1.5 rounded-full bg-[#EEF2F7]" role="img" aria-label={`${pct} % de los cupos ocupados`}>
                      <div
                        className="h-1.5 rounded-full bg-[linear-gradient(90deg,#1E9E9A,#7FE8FF)] origin-left animate-crecer-x motion-reduce:animate-none"
                        style={{ width: `${Math.max(pct, inscritos ? 4 : 0)}%`, animationDelay: "500ms" }}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
            {sinRegistrar.slice(0, Math.max(0, 2 - Math.min(2, proximosEventos.length))).map((e) => (
              <article key={e.id} className="rounded-[18px] overflow-hidden border border-[#E8EBF1]">
                <div className="h-[130px] bg-[linear-gradient(135deg,#F8F2E1_0%,#EAD8A2_100%)] flex items-end p-3">
                  <span className="bg-white/95 text-[#6B5310] text-[13px] font-bold rounded-full px-3 py-1">
                    {diaCorto(e.fecha)} · ya pasó
                  </span>
                </div>
                <div className="p-4">
                  <strong className="block text-base truncate" title={e.nombre}>
                    {e.nombre}
                  </strong>
                  <span className="block text-sm font-semibold text-[#8A5A00]">{plural(e.sinRegistrar, "inscrito", "inscritos")} sin registrar</span>
                  <Link to={`/admin/eventos/${e.id}/inscritos`} className="mt-2.5 min-h-[40px] inline-flex items-center px-3.5 rounded-full bg-primary-dark text-white font-bold text-[13px] no-underline hover:bg-primary">
                    Registrar asistencia
                  </Link>
                </div>
              </article>
            ))}
            <article className="rounded-[18px] border-[1.5px] border-dashed border-[#BFD0E6] bg-[linear-gradient(160deg,#F2FBFF_0%,#FFFFFF_70%)] flex flex-col items-center justify-center gap-3 p-6 text-center min-h-[200px]">
              <p className="m-0 text-[15px] text-ink-600 max-w-[16em]">Crea un taller y los estudiantes lo verán en su inicio.</p>
              <Link
                to="/admin/eventos?nuevo=1"
                className="min-h-[44px] inline-flex items-center px-5 rounded-full bg-[linear-gradient(100deg,#1D4E9E,#1E9E9A)] text-white font-bold text-sm no-underline transition hover:-translate-y-px hover:shadow-[0_10px_28px_rgba(30,158,154,0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                Nuevo evento
              </Link>
            </article>
          </div>
        </section>
      </main>
    </>
  );
}
