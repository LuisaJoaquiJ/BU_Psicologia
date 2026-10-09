import { useEffect, useState } from "react";
import { Icono } from "../../components/Iconos";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";
import { fechaLarga, formatearHora } from "../../lib/format";
import { BandaInicio, botonBandaPrincipal, botonBandaSecundario, hoyLargo } from "../../components/ui";

const ESTADO_ESTILOS = {
  Agendada: "bg-primary-light text-primary-soft",
  Atendida: "bg-[#E7F4EE] text-[#1D6B4A]",
  NoAsistio: "bg-gold-light text-[#7A5405]",
  Cancelada: "bg-gray-100 text-ink-500",
};
const ESTADO_TEXTO = { Agendada: "Agendada", Atendida: "Atendida", NoAsistio: "No asistió", Cancelada: "Cancelada" };

// Colores de asistencia validados para daltonismo (mismos que Estadísticas).
const COLORES = { asistieron: "#0d9488", noAsistieron: "#d97706", sinRegistrar: "#e5e7eb" };

function hoyISO() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

function saludo() {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatoTasa(valor) {
  return valor === null || valor === undefined ? "—" : `${valor.toLocaleString("es-CO")} %`;
}

function Indicador({ titulo, valor, detalle, destacado = false }) {
  return (
    <div className={`rounded-[20px] p-4 sm:p-5 min-w-0 ${destacado ? "bg-primary text-white" : "bg-white border border-gray-200"}`}>
      <p className={`m-0 text-[13px] ${destacado ? "text-white/75" : "text-ink-500"}`}>{titulo}</p>
      <p className={`mt-1.5 mb-0 font-display text-[30px] sm:text-[38px] leading-tight font-semibold tabular-nums ${destacado ? "text-gold" : "text-primary"}`}>
        {valor}
      </p>
      {detalle && <p className={`mt-1 mb-0 text-[13px] ${destacado ? "text-white/75" : "text-ink-500"}`}>{detalle}</p>}
    </div>
  );
}

// Inicio del panel Administrador (rediseño): indicadores de RF-015, agenda
// del día (RF-008) y asistencia por evento (RF-011), con accesos rápidos.
export function InicioAdmin() {
  const { usuario } = useAuth();
  const [stats, setStats] = useState(null);
  const [todas, setTodas] = useState(null);
  const [errorCitas, setErrorCitas] = useState("");

  useEffect(() => {
    http
      .get("/admin/estadisticas")
      .then((res) => setStats(res.data))
      .catch(() => setStats(false));
    // Todas las citas del modulo: de ahi salen las de hoy, las proximas y las
    // que esperan registro de asistencia (asi el inicio nunca queda vacio si
    // hay citas otro dia).
    http
      .get("/admin/citas")
      .then((res) => setTodas(res.data.citas))
      .catch((err) => {
        setTodas([]);
        setErrorCitas(err.response?.data?.message || "No pudimos cargar las citas. Revisa que el servidor esté encendido.");
      });
  }, []);

  const hoy = hoyISO();
  const dia = (c) => String(c.horario?.fecha || "").slice(0, 10);
  const orden = (a, b) => (dia(a) + String(a.horario?.horaInicio)).localeCompare(dia(b) + String(b.horario?.horaInicio));
  const lista = [...(todas || [])].sort(orden);
  const agenda = todas ? lista.filter((c) => dia(c) === hoy && c.estado !== "Cancelada") : null;
  const pendientes = lista.filter((c) => c.estado === "Agendada" && dia(c) < hoy);
  const proximas = lista.filter((c) => c.estado === "Agendada" && dia(c) > hoy);
  const porRegistrar = (agenda || []).filter((c) => c.estado === "Agendada").length + pendientes.length;
  const eventos = stats ? stats.eventosDetalle.slice(-3) : [];

  const siguiente = (agenda || []).find((c) => c.estado === "Agendada") || proximas[0];
  const vistaAgenda = agenda && agenda.length ? agenda : proximas.slice(0, 6);
  const fechaCorta = (c) => fechaLarga(c.horario?.fecha).split(",")[0] + " " + Number(dia(c).slice(8, 10));

  return (
    <>
      <BandaInicio
        titulo={
          <>
            {saludo()}, <span className="text-cyan">{usuario?.nombre?.split(" ")[0]}.</span>
          </>
        }
        fecha={hoyLargo()}
        texto={
          agenda
            ? agenda.length === 0
              ? proximas.length
                ? `Hoy no tienes citas. Tu próxima es el ${fechaLarga(proximas[0].horario?.fecha).toLowerCase()} a las ${formatearHora(proximas[0].horario?.horaInicio)}`
                : "Hoy no tienes citas. Puedes publicar más horarios o preparar el próximo taller."
              : `Hoy tienes ${agenda.length} ${agenda.length === 1 ? "cita" : "citas"}${porRegistrar ? ` y ${porRegistrar} ${porRegistrar === 1 ? "espera" : "esperan"} registro de asistencia` : ""}.`
            : "Cargando tu día…"
        }
        acciones={
          <>
            <Link to="/admin/eventos?nuevo=1" className={botonBandaPrincipal}>
              Nuevo evento
            </Link>
            <Link to="/admin/horarios?agregar=1" className={botonBandaSecundario}>
              Publicar horario
            </Link>
            <Link to="/admin/citas?sincita=1" className={botonBandaSecundario}>
              Atender sin cita
            </Link>
          </>
        }
        aside={
          <>
            <h2 className="m-0 font-sans text-lg font-bold text-primary">Siguiente cita</h2>
            {!agenda && <p className="m-0 text-ink-500">Cargando…</p>}
            {agenda && !siguiente && <p className="m-0 text-ink-600">No tienes citas agendadas por ahora.</p>}
            {siguiente && (
              <div className="flex gap-4 items-center">
                <span className="shrink-0 w-[92px] h-[68px] rounded-2xl bg-primary-light text-primary font-extrabold flex items-center justify-center tabular-nums text-[15px] whitespace-nowrap">
                  {formatearHora(siguiente.horario?.horaInicio)}
                </span>
                <span className="min-w-0">
                  <strong className="block text-[17px] leading-snug text-primary truncate">{siguiente.usuario?.nombre}</strong>
                  <span className="block text-sm text-ink-500">{siguiente.horario?.servicio?.nombre}</span>
                  {dia(siguiente) !== hoy && <span className="block text-sm font-semibold text-ink-700">{fechaLarga(siguiente.horario?.fecha)}</span>}
                </span>
              </div>
            )}
            <Link
              to="/admin/citas"
              className="self-start font-bold text-sm px-4 min-h-[44px] inline-flex items-center rounded-full bg-primary-light text-primary hover:bg-[#E2E9F6]"
            >
              {siguiente && dia(siguiente) === hoy ? "Registrar asistencia" : "Ver citas"}
            </Link>
          </>
        }
      />
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-7">
        {stats === false && <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3">No fue posible cargar los indicadores.</p>}

        <section aria-label="Indicadores" className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Indicador
            titulo="Citas de hoy"
            valor={agenda ? agenda.length : "…"}
            detalle={agenda ? `${proximas.length} próximas · ${porRegistrar} por registrar asistencia` : null}
          />
          <Indicador
            titulo="Asistencia a citas"
            valor={stats ? formatoTasa(stats.citas.tasaAsistencia) : "…"}
            detalle={stats ? `${stats.citas.atendidas} atendidas de ${stats.citas.atendidas + stats.citas.noAsistieron}` : null}
          />
          <Indicador
            titulo="Inscritos a eventos"
            valor={stats ? stats.eventos.inscritos : "…"}
            detalle={stats ? `en ${stats.eventos.eventos} eventos publicados o cerrados` : null}
          />
          <Indicador destacado titulo="Estudiantes registrados" valor={stats ? stats.estudiantesRegistrados : "…"} />
        </section>

        <div className="flex gap-5 flex-wrap">
          <section aria-label="Citas" className="flex-[1_1_300px] min-w-0 bg-white border border-gray-200 rounded-[22px] p-6">
            <div className="flex justify-between items-center mb-3.5">
              <h2 className="m-0 text-lg font-sans font-bold">{agenda && agenda.length === 0 ? "Próximas citas" : "Citas de hoy"}</h2>
              <Link to="/admin/citas" className="inline-flex items-center gap-1.5 py-2 text-sm font-bold text-primary-soft">
                Ver citas
                <Icono nombre="flecha" size={16} strokeWidth={2.2} />
              </Link>
            </div>
            {pendientes.length > 0 && (
              <Link
                to="/admin/citas"
                className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-[#FFF6E0] text-[#7A5405] px-4 py-3 text-sm font-bold hover:brightness-[0.98]"
              >
                {pendientes.length} {pendientes.length === 1 ? "cita pasada espera" : "citas pasadas esperan"} registro de asistencia
                <Icono nombre="flecha" size={16} strokeWidth={2.2} />
              </Link>
            )}
            {errorCitas && <p className="m-0 mb-2 text-sm font-semibold text-red-700 bg-red-50 rounded-xl px-3 py-2">{errorCitas}</p>}
            {!agenda && <p className="m-0 text-sm text-ink-500">Cargando...</p>}
            {agenda && agenda.length === 0 && (
              <p className="m-0 mb-1 text-sm text-ink-500">
                Hoy no hay citas{proximas.length ? "; estas son las que vienen." : " ni hay citas agendadas para los próximos días."}
              </p>
            )}
            <ul className="list-none m-0 p-0 flex flex-col">
              {vistaAgenda.map((cita) => (
                <li key={cita.id} className="flex items-center gap-3.5 py-3 border-t border-gray-100">
                  <span className="shrink-0 w-24 tabular-nums font-bold text-sm text-primary leading-tight">
                    {dia(cita) !== hoy && <span className="block text-xs font-semibold text-ink-500">{fechaCorta(cita)}</span>}
                    <span className="whitespace-nowrap">{formatearHora(cita.horario?.horaInicio)}</span>
                  </span>
                  <span className="flex-1 min-w-0 text-sm">
                    <strong className="block truncate">{cita.usuario?.nombre}</strong>
                    <span className="text-ink-500">{cita.horario?.servicio?.nombre}</span>
                  </span>
                  <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${ESTADO_ESTILOS[cita.estado] || ""}`}>
                    {ESTADO_TEXTO[cita.estado] || cita.estado}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Asistencia por evento" className="flex-[1_1_300px] min-w-0 bg-white border border-gray-200 rounded-[22px] p-6">
            <div className="flex justify-between items-center mb-1.5">
              <h2 className="m-0 text-lg font-sans font-bold">Asistencia por evento</h2>
              <Link to="/admin/estadisticas" className="inline-flex items-center gap-1.5 py-2 text-sm font-bold text-primary-soft">
                Estadísticas
                <Icono nombre="flecha" size={16} strokeWidth={2.2} />
              </Link>
            </div>
            <div className="flex gap-4 text-xs text-ink-600 mb-3.5 flex-wrap">
              {[
                ["asistieron", "Asistieron"],
                ["noAsistieron", "No asistieron"],
                ["sinRegistrar", "Sin registrar"],
              ].map(([clave, texto]) => (
                <span key={clave} className="flex gap-1.5 items-center">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORES[clave] }} />
                  {texto}
                </span>
              ))}
            </div>
            {stats && eventos.length === 0 && <p className="m-0 text-sm text-ink-500">Todavía no hay eventos publicados.</p>}
            <div className="flex flex-col gap-4">
              {eventos.map((e) => (
                <div key={e.id}>
                  <div className="flex justify-between text-sm mb-1.5 gap-3">
                    <strong className="truncate">{e.nombre}</strong>
                    <span className="text-ink-500 shrink-0">{e.inscritos} inscritos</span>
                  </div>
                  <div className="flex gap-0.5 h-3">
                    {["asistieron", "noAsistieron", "sinRegistrar"].map((clave) =>
                      e[clave] > 0 ? (
                        <span
                          key={clave}
                          title={`${clave === "asistieron" ? "Asistieron" : clave === "noAsistieron" ? "No asistieron" : "Sin registrar"}: ${e[clave]}`}
                          className="first:rounded-l last:rounded-r"
                          style={{ flexGrow: e[clave], background: COLORES[clave] }}
                        />
                      ) : null,
                    )}
                    {e.inscritos === 0 && <span className="flex-1 rounded bg-gray-100" />}
                  </div>
                  <p className="mt-1.5 mb-0 text-xs text-ink-500 tabular-nums">
                    {e.asistieron} asistieron · {e.noAsistieron} no asistieron · {e.sinRegistrar} sin registrar
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
