import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { formatearHora, fechaInputUTC, horaInputUTC, fechaLarga } from "../comunes/lib/format";
import { Aviso, Segmentos, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";
import { btnTexto } from "./controlesDh";
import { PublicarSemana } from "./PublicarSemana";
import { Ventana } from "../comunes/componentes/Ventana";
import { FormularioNoDisponible, textoBloqueo } from "./NoDisponible";

const FORM_VACIO = { servicioId: "", fecha: "", horaInicio: "", horaFin: "", cupo: 1 };
const DIAS_SEM = [
  [1, "L", "lunes"],
  [2, "M", "martes"],
  [3, "X", "miércoles"],
  [4, "J", "jueves"],
  [5, "V", "viernes"],
];
const DURACIONES = [30, 45, 60];
const SEMANAS_OPCIONES = [1, 2, 4];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];

const card = "bg-white border border-gray-200 rounded-xl";
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoDe(d) {
  return d.toISOString().slice(0, 10);
}
function lunesDe(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return isoDe(d);
}
function minutos(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
}
function hhmm(total) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function etiquetaHora(hhmmValor) {
  const [h, m] = hhmmValor.split(":").map(Number);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}
function diaCorto(fecha) {
  return `${Number(fecha.slice(8))} ${MESES_CORTOS[Number(fecha.slice(5, 7)) - 1]}`;
}
function horasDelDia() {
  const opciones = [];
  for (let t = 7 * 60; t <= 19 * 60; t += 30) opciones.push(hhmm(t));
  return opciones;
}
const HORAS_SELECT = horasDelDia();

// Días hábiles de las próximas `semanas`, desde el lunes de esta semana, sin los ya pasados.
function fechasProgramadas(hoy, dias, semanas) {
  const lunes = new Date(`${lunesDe(hoy)}T12:00:00Z`);
  const fechas = [];
  for (let s = 0; s < semanas; s += 1) {
    for (const dia of [...dias].sort((a, b) => a - b)) {
      const f = new Date(lunes);
      f.setUTCDate(lunes.getUTCDate() + (dia - 1) + 7 * s);
      const iso = isoDe(f);
      if (iso >= hoy) fechas.push(iso);
    }
  }
  return fechas;
}

function seCruzan(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

// Huecos nuevos: un turno por cada duración que cabe entre desde y hasta, sin pisar lo ya publicado de ese servicio.
function slotsNuevos({ hoy, dias, desde, hasta, duracion, semanas, servicioId, horarios }) {
  const ini = minutos(desde);
  const fin = minutos(hasta);
  if (!servicioId || !dias.length || !(fin > ini) || !duracion) return [];
  const lista = [];
  for (const fecha of fechasProgramadas(hoy, dias, semanas)) {
    for (let t = ini; t + duracion <= fin; t += duracion) {
      const cruza = (horarios || []).some((h) => {
        if ((h.servicioId || h.servicio?.id) !== servicioId) return false;
        if (String(h.fecha).slice(0, 10) !== fecha) return false;
        return seCruzan(minutos(horaInputUTC(h.horaInicio)), minutos(horaInputUTC(h.horaFin)), t, t + duracion);
      });
      if (!cruza) lista.push({ servicioId, fecha, horaInicio: hhmm(t), horaFin: hhmm(t + duracion), cupo: 1 });
    }
  }
  return lista;
}

function textoConteo(slots) {
  if (!slots.length) return "No hay horarios nuevos con esa selección.";
  const porDia = {};
  for (const s of slots) porDia[s.fecha] = (porDia[s.fecha] || 0) + 1;
  const cuentas = Object.values(porDia);
  const n = slots.length;
  const base = n === 1 ? "Se publicará 1 horario nuevo" : `Se publicarán ${n} horarios nuevos`;
  if (cuentas.length && cuentas.every((c) => c === cuentas[0])) return `${base} (${cuentas[0]} por día).`;
  return `${base}.`;
}

// Libre, con cita o cerrado a mano. La cita llega en el listado de gestión.
function clasificar(h) {
  const cita = h.cita || null;
  const ver = Boolean(cita);
  if (cita?.estado === "Agendada") return { tipo: "cita", nota: cita.estudiante || "Con cita", ver, agendada: true };
  if (!h.ocupado) {
    return { tipo: "libre", nota: cita?.estado === "Cancelada" ? "Se liberó: la cita fue cancelada" : "Libre para reservar", cerrar: true };
  }
  if (cita && (cita.estado === "Atendida" || cita.estado === "NoAsistio")) {
    return { tipo: "cita", nota: cita.estudiante || "Cita registrada", detalle: cita.estado === "Atendida" ? "Asistió" : "No asistió", reabrir: true, ver };
  }
  return { tipo: "cerrado", nota: "Cerrado manualmente", reabrir: true };
}

const BORDE = {
  libre: "border-l-[#0E6B4A] bg-white",
  cita: "border-l-primary-dark bg-primary-light/50",
  cerrado: "border-l-gray-400 bg-gray-50",
};

function CalendarioDias({ hoy, seleccionado, conHorario, onSeleccionar }) {
  const [mes, setMes] = useState(() => {
    const base = new Date(`${seleccionado}T12:00:00`);
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const primer = (new Date(mes.getFullYear(), mes.getMonth(), 1).getDay() + 6) % 7;
  const cantidad = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celdas = [...Array(primer).fill(null), ...Array.from({ length: cantidad }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);
  const titulo = `${MESES[mes.getMonth()]} ${mes.getFullYear()}`;

  return (
    <section className={`${card} p-4 sm:p-5`} aria-label="Calendario">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="m-0 text-lg font-extrabold capitalize">{titulo}</h2>
        <div className="flex gap-1">
          <button type="button" aria-label="Mes anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="w-9 h-9 rounded-full grid place-items-center text-primary hover:bg-primary-light">
            <Icono nombre="izquierda" size={18} strokeWidth={2.2} />
          </button>
          <button type="button" aria-label="Mes siguiente" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="w-9 h-9 rounded-full grid place-items-center text-primary hover:bg-primary-light">
            <Icono nombre="derecha" size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink-500 mb-1">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <span key={d} className="py-1">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((n, i) => {
          if (!n) return <span key={`v-${i}`} />;
          const iso = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
          const sel = iso === seleccionado;
          const esHoy = iso === hoy;
          const tiene = conHorario.has(iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSeleccionar(iso)}
              aria-pressed={sel}
              aria-current={esHoy ? "date" : undefined}
              className={`relative h-10 rounded-lg text-sm font-bold tabular-nums ${
                sel ? "bg-primary-dark text-white" : esHoy ? "bg-accent text-white" : tiene ? "text-ink-900 hover:bg-primary-light" : "text-ink-500 hover:bg-primary-light"
              }`}
            >
              {n}
              {tiene && <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${sel || esHoy ? "bg-gold" : "bg-primary"}`} />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#0E6B4A]" />Con horarios publicados</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-[4px] bg-accent" />Hoy</span>
      </div>
    </section>
  );
}

// RF-007 · HU-13, HU-14: el personal publica horarios, los cierra o los vuelve
// a abrir, y marca el tiempo en que no atiende. Mismos endpoints de siempre.
export function GestionHorariosPage({ api = "/admin" }) {
  const [servicios, setServicios] = useState([]);
  const [horarios, setHorarios] = useState(null);
  const [bloqueos, setBloqueos] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [formEdicion, setFormEdicion] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [accionando, setAccionando] = useState(null);
  const [params, setParams] = useSearchParams();
  const [aviso, setAviso] = useState("");
  const [diaSel, setDiaSel] = useState(null);
  const [modo, setModo] = useState("varias");
  const [servicioVarias, setServicioVarias] = useState("");
  const [dias, setDias] = useState([1, 3, 5]);
  const [desde, setDesde] = useState("08:00");
  const [hasta, setHasta] = useState("12:00");
  const [duracion, setDuracion] = useState(45);
  const [semanas, setSemanas] = useState(2);
  const [pintar, setPintar] = useState(false);
  const formRef = useRef(null);

  const hoyStr = hoyLocal();
  const diaElegido = diaSel || hoyStr;

  function cargarHorarios() {
    http.get(`${api}/horarios/bloqueos`).then((res) => setBloqueos(res.data.bloqueos)).catch(() => setBloqueos([]));
    return http.get(`${api}/horarios`).then((res) => setHorarios(res.data.horarios)).catch(() => setError("No fue posible cargar los horarios."));
  }

  useEffect(() => {
    http.get("/servicios").then((res) => {
      const lista = res.data.servicios || [];
      setServicios(lista);
      const id = lista[0]?.id || "";
      setForm((f) => ({ ...f, servicioId: f.servicioId || id }));
      setServicioVarias((s) => s || id);
    });
    cargarHorarios();
    if (params.get("agregar") === "1") {
      setModo("varias");
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const irA = useCallback((siguiente, fecha) => {
    setError("");
    setAviso("");
    setModo(siguiente);
    if (fecha) setForm((f) => ({ ...f, fecha }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (params.get("agregar")) setParams({}, { replace: true });
  }, [params, setParams]);

  const servicioActual = servicioVarias || servicios[0]?.id || "";
  const previstos = useMemo(
    () => slotsNuevos({ hoy: hoyStr, dias, desde, hasta, duracion, semanas, servicioId: servicioActual, horarios }),
    [hoyStr, dias, desde, hasta, duracion, semanas, servicioActual, horarios],
  );

  async function quitarBloqueo(b) {
    if (!window.confirm(`¿Quitar «${b.motivo}» (${textoBloqueo(b)})? Los horarios de ese tiempo vuelven a ofrecerse.`)) return;
    setError("");
    try {
      await http.delete(`${api}/horarios/bloqueos/${b.id}`);
      setAviso("Listo: ese tiempo vuelve a estar disponible.");
      await cargarHorarios();
    } catch (err) {
      setError(err.response?.data?.message || "No pudimos quitarlo.");
    }
  }

  async function crearHorario(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await http.post(`${api}/horarios`, { ...form, servicioId: form.servicioId || servicioActual, cupo: 1 });
      setForm((f) => ({ ...FORM_VACIO, servicioId: f.servicioId }));
      await cargarHorarios();
      setAviso("Listo: el horario quedó publicado.");
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible crear el horario.");
    } finally {
      setEnviando(false);
    }
  }

  async function publicarVarias() {
    if (!previstos.length) return;
    setError("");
    setEnviando(true);
    let creadas = 0;
    let repetidas = 0;
    let fallidas = 0;
    for (let i = 0; i < previstos.length; i += 5) {
      const lote = await Promise.allSettled(previstos.slice(i, i + 5).map((datos) => http.post(`${api}/horarios`, datos)));
      for (const r of lote) {
        if (r.status === "fulfilled") creadas += 1;
        else if (r.reason?.response?.status === 409) repetidas += 1;
        else fallidas += 1;
      }
    }
    setEnviando(false);
    await cargarHorarios();
    if (!creadas && fallidas) {
      setError("No pudimos publicar los horarios. Revisa tu conexión e intenta de nuevo.");
      return;
    }
    const partes = [`Publicaste ${creadas} ${creadas === 1 ? "horario" : "horarios"}. Los estudiantes ya los pueden pedir.`];
    if (repetidas) partes.push(`${repetidas} ya existían y no se repitieron.`);
    if (fallidas) partes.push(`${fallidas} no se pudieron crear.`);
    setAviso(partes.join(" "));
  }

  function empezarEdicion(horario) {
    setEditandoId(horario.id);
    setFormEdicion({
      servicioId: horario.servicioId,
      fecha: fechaInputUTC(horario.fecha),
      horaInicio: horaInputUTC(horario.horaInicio),
      horaFin: horaInputUTC(horario.horaFin),
      cupo: horario.cupo,
    });
  }

  async function guardarEdicion(id) {
    setError("");
    setAccionando(id);
    try {
      await http.patch(`${api}/horarios/${id}`, formEdicion);
      setEditandoId(null);
      await cargarHorarios();
      setAviso("Guardamos los cambios del horario.");
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible guardar los cambios.");
    } finally {
      setAccionando(null);
    }
  }

  async function alternarDisponibilidad(horario) {
    setError("");
    setAccionando(horario.id);
    try {
      if (horario.ocupado) await http.patch(`${api}/horarios/${horario.id}/habilitar`);
      else await http.patch(`${api}/horarios/${horario.id}/deshabilitar`, {});
      await cargarHorarios();
      setAviso(horario.ocupado ? "El horario volvió a estar libre para reservar." : "El horario quedó cerrado: ya no se puede reservar.");
    } catch (err) {
      const mensaje = err.response?.data?.message || "";
      if (err.response?.status === 409 && mensaje.toLowerCase().includes("confirma")) {
        if (window.confirm(`${mensaje}\n\n¿Deseas continuar de todas formas?`)) {
          try {
            await http.patch(`${api}/horarios/${horario.id}/deshabilitar`, { confirmar: true });
            await cargarHorarios();
            setAviso("El horario quedó cerrado y se canceló la cita.");
          } catch (err2) {
            setError(err2.response?.data?.message || "No fue posible deshabilitar el horario.");
          }
        }
      } else {
        setError(mensaje || "No fue posible actualizar el horario.");
      }
    } finally {
      setAccionando(null);
    }
  }

  const delDia = (horarios || []).filter((h) => String(h.fecha).slice(0, 10) === diaElegido).sort((a, b) => String(a.horaInicio).localeCompare(String(b.horaInicio)));
  const clases = delDia.map((h) => ({ h, c: clasificar(h) }));
  const nLibres = clases.filter((x) => x.c.tipo === "libre").length;
  const nCitas = clases.filter((x) => x.c.tipo === "cita").length;
  const nCerrados = clases.filter((x) => x.c.tipo === "cerrado").length;
  const conHorario = new Set((horarios || []).map((h) => String(h.fecha).slice(0, 10)));
  const bloqueosDia = bloqueos.filter((b) => b.fechaInicio <= diaElegido && b.fechaFin >= diaElegido);
  const proximosBloqueos = bloqueos.filter((b) => b.fechaFin >= hoyStr);
  const finRango = fechasProgramadas(hoyStr, [1, 2, 3, 4, 5], semanas);
  const etiquetaRango = semanas === 1 ? "Solo esta semana" : finRango.length ? `Del ${diaCorto(finRango[0])} al ${diaCorto(finRango[finRango.length - 1])}` : "Sin días por delante";
  const ayuda = modo === "varias"
    ? "Publica varias horas de una vez; los estudiantes las ven al instante."
    : modo === "una"
      ? "Agrega una hora puntual en un día."
      : "Bloquea un tiempo. Si ya hay citas, se cancelan y avisamos a los estudiantes.";
  const previa = modo === "varias" ? textoConteo(previstos) : modo === "una" ? "Se publicará 1 horario nuevo." : "El motivo solo lo ve el personal.";

  function alternarDia(id) {
    setDias((xs) => (xs.includes(id) ? xs.filter((d) => d !== id) : [...xs, id]));
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
      <div className="flex justify-between items-end gap-4 flex-wrap mb-6">
        <div>
          <p className="m-0 mb-1 text-[11px] font-bold tracking-[0.14em] uppercase text-accent">Panel del personal · Desarrollo Humano</p>
          <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">Mis horarios de atención</h1>
          <p className="mt-1 mb-0 text-ink-500 max-w-[40em]">Publica las horas en que atiendes para que los estudiantes puedan pedir su cita.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => irA("ausente")} className={botonSecundario}>
            <Icono nombre="alerta" size={16} strokeWidth={2.2} />
            No estaré disponible
          </button>
          <button type="button" onClick={() => irA("varias")} className={botonPrimario}>
            <Icono nombre="mas" size={16} strokeWidth={2.4} />
            Agregar horario
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 whitespace-pre-line"><Aviso>{error}</Aviso></div>
      )}
      {aviso && (
        <div className="mb-4" role="status"><Aviso tono="verde">{aviso}</Aviso></div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-6">
          <CalendarioDias hoy={hoyStr} seleccionado={diaElegido} conHorario={conHorario} onSeleccionar={setDiaSel} />
          <section className={`${card} p-4 sm:p-5`}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="m-0 text-lg font-extrabold">Tiempo no disponible</h2>
              <button type="button" onClick={() => irA("ausente")} className={btnTexto}>
                <Icono nombre="mas" size={15} strokeWidth={2.4} />
                Agregar
              </button>
            </div>
            <p className="m-0 mb-3 text-sm text-ink-500">Si ya hay citas en ese tiempo, se cancelan y avisamos a los estudiantes.</p>
            {proximosBloqueos.length === 0 ? (
              <p className="m-0 text-sm text-ink-500">No has marcado tiempo no disponible.</p>
            ) : (
              <ul className="list-none m-0 p-0 flex flex-col gap-2">
                {proximosBloqueos.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                    <Icono nombre="alerta" size={18} strokeWidth={2} className="text-accent shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink-900">{b.motivo}{b.detalle ? <span className="font-semibold text-ink-500"> · {b.detalle}</span> : null}</span>
                      <span className="block text-xs text-ink-500">{textoBloqueo(b)}</span>
                    </span>
                    <button type="button" onClick={() => quitarBloqueo(b)} className={btnTexto}>Quitar</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className={`${card} p-4 sm:p-5`} aria-label={fechaLarga(`${diaElegido}T12:00:00Z`)}>
            <div className="flex justify-between items-start gap-3 flex-wrap mb-3">
              <div>
                <h2 className="m-0 text-xl font-extrabold">{fechaLarga(`${diaElegido}T12:00:00Z`)}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!horarios ? null : delDia.length === 0 ? (
                    <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-gray-100 text-ink-600">Sin horarios publicados</span>
                  ) : (
                    <>
                      <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-[#E3F4F1] text-[#0B6B61]">{nLibres} {nLibres === 1 ? "libre" : "libres"}</span>
                      <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-[#E4EAF4] text-primary-dark">{nCitas} con cita</span>
                      <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-gray-100 text-ink-600">{nCerrados} {nCerrados === 1 ? "cerrado" : "cerrados"}</span>
                    </>
                  )}
                </div>
              </div>
              {diaElegido >= hoyStr && (
                <button type="button" onClick={() => irA("una", diaElegido)} className={botonSecundario}>
                  <Icono nombre="mas" size={15} strokeWidth={2.4} />
                  Agregar en este día
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500 mb-3">
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] border border-gray-200 border-l-[3px] border-l-[#0E6B4A] bg-white" />Libres para reservar</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] border-l-[3px] border-l-primary-dark bg-primary-light" />Ocupados (con cita)</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] border-l-[3px] border-l-gray-400 bg-gray-100" />Cerrados</span>
            </div>
            {bloqueosDia.map((b) => (
              <p key={b.id} className="m-0 mb-2 rounded-xl bg-[#FFF6E0] text-[#5C4206] text-sm px-3 py-2">
                <strong>No disponible: {b.motivo}.</strong> {b.todoElDia ? "Todo el día" : `${formatearHora(b.horaInicio)} a ${formatearHora(b.horaFin)}`}
              </p>
            ))}
            {!horarios && <p className="m-0 text-ink-500">Cargando horarios…</p>}
            {horarios && delDia.length === 0 && (
              <div className="py-8 text-center">
                <p className="m-0 font-extrabold text-ink-900">No tienes horarios este día</p>
                <p className="m-0 mt-1 text-sm text-ink-500">Agrega horas para que los estudiantes puedan reservar.</p>
                {diaElegido >= hoyStr && (
                  <button type="button" onClick={() => irA("una", diaElegido)} className={`${botonSecundario} mt-3`}>Agregar horario</button>
                )}
              </div>
            )}
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {clases.map(({ h, c }) => (
                <li key={h.id} className={`rounded-xl border border-gray-200 border-l-4 px-3 py-3 ${BORDE[c.tipo]}`}>
                  {editandoId === h.id ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
                      <label className="flex flex-col gap-1 text-sm font-bold text-ink-600 sm:col-span-2">
                        Servicio
                        <select value={formEdicion.servicioId} onChange={(e) => setFormEdicion({ ...formEdicion, servicioId: e.target.value })} className={claseCampo}>
                          {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-bold text-ink-600">
                        Fecha
                        <input type="date" value={formEdicion.fecha} onChange={(e) => setFormEdicion({ ...formEdicion, fecha: e.target.value })} className={claseCampo} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-bold text-ink-600">
                        Empieza
                        <input type="time" value={formEdicion.horaInicio} onChange={(e) => setFormEdicion({ ...formEdicion, horaInicio: e.target.value })} className={claseCampo} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-bold text-ink-600">
                        Termina
                        <input type="time" value={formEdicion.horaFin} onChange={(e) => setFormEdicion({ ...formEdicion, horaFin: e.target.value })} className={claseCampo} />
                      </label>
                      <div className="flex gap-2 lg:col-span-3">
                        <button type="button" onClick={() => guardarEdicion(h.id)} disabled={accionando === h.id} className={botonPrimario}>Guardar cambios</button>
                        <button type="button" onClick={() => setEditandoId(null)} className={botonSecundario}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="w-[108px] shrink-0">
                        <b className="block text-ink-900 tabular-nums">{formatearHora(h.horaInicio)}</b>
                        <span className="block text-xs text-ink-500 tabular-nums">hasta {formatearHora(h.horaFin)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-ink-900 truncate">{h.servicio?.nombre}</span>
                        <span className="block text-xs text-ink-500">
                          {c.tipo === "cita" && <Icono nombre="persona" size={13} strokeWidth={2} className="inline mr-1 -mt-0.5" />}
                          {c.nota}
                          {c.detalle ? ` · ${c.detalle}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {c.ver && (
                          <Link to={`/admin/citas?fecha=${String(h.fecha).slice(0, 10)}`} className={btnTexto}>Ver cita</Link>
                        )}
                        {h.cita?.estado !== "Agendada" && (
                          <button type="button" onClick={() => empezarEdicion(h)} className={btnTexto}>
                            <Icono nombre="editar" size={14} strokeWidth={2} />
                            Editar
                          </button>
                        )}
                        {c.cerrar && (
                          <button type="button" onClick={() => alternarDisponibilidad(h)} disabled={accionando === h.id} className={btnTexto}>
                            <Icono nombre="alerta" size={14} strokeWidth={2} />
                            Cerrar
                          </button>
                        )}
                        {c.reabrir && (
                          <button type="button" onClick={() => alternarDisponibilidad(h)} disabled={accionando === h.id} className={btnTexto}>Reabrir</button>
                        )}
                        {c.tipo === "cita" && h.cita?.estado === "Agendada" && (
                          <button type="button" onClick={() => alternarDisponibilidad(h)} disabled={accionando === h.id} className={btnTexto}>Cerrar</button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section ref={formRef} id="agregar-horario" className={`${card} p-4 sm:p-5 border-primary-dark/30 scroll-mt-4`}>
            <div className="flex justify-between items-start gap-3 flex-wrap mb-4">
              <div>
                <h2 className="m-0 text-lg font-extrabold">Agregar horario</h2>
                <p className="m-0 mt-1 text-sm text-ink-500">{ayuda}</p>
              </div>
              <Segmentos
                etiqueta="Forma de agregar"
                valor={modo}
                alCambiar={setModo}
                opciones={[
                  ["varias", "Varias horas"],
                  ["una", "Una sola hora"],
                  ["ausente", "No estaré disponible"],
                ]}
              />
            </div>

            {modo === "ausente" ? (
              <FormularioNoDisponible
                api={api}
                fechaInicial={diaElegido >= hoyStr ? diaElegido : undefined}
                alGuardar={async (res) => {
                  setAviso(`Listo: «${res.bloqueo.motivo}» quedó registrado. ${res.citasCanceladas ? `Se cancelaron ${res.citasCanceladas} ${res.citasCanceladas === 1 ? "cita" : "citas"} y se avisó a los estudiantes. ` : ""}En ese tiempo los estudiantes no verán horarios.`);
                  setModo("varias");
                  await cargarHorarios();
                }}
              />
            ) : modo === "una" ? (
              <form onSubmit={crearHorario} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600 sm:col-span-2">
                    Servicio
                    <select required value={form.servicioId || servicioActual} onChange={(e) => setForm({ ...form, servicioId: e.target.value })} className={claseCampo}>
                      {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                    Día
                    <input required type="date" min={hoyStr} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={claseCampo} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                      Empieza
                      <input required type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} className={claseCampo} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                      Termina
                      <input required type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} className={claseCampo} />
                    </label>
                  </div>
                </div>
                <PieFormulario texto={previa} tono="ok" cancelar={() => setForm((f) => ({ ...FORM_VACIO, servicioId: f.servicioId }))} enviar="Publicar horario" enviando={enviando} />
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                    Servicio
                    <select value={servicioActual} onChange={(e) => setServicioVarias(e.target.value)} className={claseCampo}>
                      {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-bold text-ink-600">Días de la semana</span>
                    <div className="flex gap-1.5" role="group" aria-label="Días de la semana">
                      {DIAS_SEM.map(([id, letra, nombre]) => (
                        <button key={id} type="button" aria-pressed={dias.includes(id)} aria-label={nombre} onClick={() => alternarDia(id)} className={`w-10 h-10 rounded-lg border font-bold ${dias.includes(id) ? "bg-primary-dark text-white border-primary-dark" : "border-gray-200 bg-white text-ink-900 hover:bg-primary-light"}`}>
                          {letra}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                    Desde
                    <select value={desde} onChange={(e) => setDesde(e.target.value)} className={claseCampo}>
                      {HORAS_SELECT.map((h) => <option key={h} value={h}>{etiquetaHora(h)}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                    Hasta
                    <select value={hasta} onChange={(e) => setHasta(e.target.value)} className={claseCampo}>
                      {HORAS_SELECT.map((h) => <option key={h} value={h}>{etiquetaHora(h)}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                    Duración por cita
                    <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} className={claseCampo}>
                      {DURACIONES.map((m) => <option key={m} value={m}>{m} minutos</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                    Semanas
                    <select value={semanas} onChange={(e) => setSemanas(Number(e.target.value))} className={claseCampo}>
                      {SEMANAS_OPCIONES.map((n) => (
                        <option key={n} value={n}>{n === semanas ? etiquetaRango : n === 1 ? "Solo esta semana" : `${n} semanas`}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="m-0 -mt-2 text-xs text-ink-500">{etiquetaRango}. Los huecos que ya están publicados no se cuentan.</p>
                <button type="button" onClick={() => setPintar(true)} className={`${btnTexto} self-start`}>Elegir horas sueltas en la semana</button>
                <PieFormulario texto={previa} tono={previstos.length ? "ok" : "muted"} cancelar={() => { setDias([1, 3, 5]); setDesde("08:00"); setHasta("12:00"); setDuracion(45); setSemanas(2); }} enviar={enviando ? "Publicando…" : "Publicar horarios"} enviando={enviando || !previstos.length} onEnviar={publicarVarias} />
              </div>
            )}
          </section>
        </div>
      </div>

      {pintar && (
        <Ventana titulo="Elegir horas sueltas" alCerrar={() => setPintar(false)}>
          <PublicarSemana api={api} servicios={servicios} horarios={horarios} alPublicar={cargarHorarios} />
        </Ventana>
      )}
    </main>
  );
}

function PieFormulario({ texto, tono, cancelar, enviar, enviando, onEnviar }) {
  return (
    <div className="flex justify-between items-center gap-3 flex-wrap border-t border-gray-200 pt-4">
      <span className={`inline-flex items-center gap-2 text-sm font-bold ${tono === "ok" ? "text-[#0E6B4A]" : "text-ink-500"}`} aria-live="polite">
        {tono === "ok" && <Icono nombre="check" size={16} strokeWidth={2.4} />}
        {texto}
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={cancelar} className={botonSecundario}>Cancelar</button>
        <button type={onEnviar ? "button" : "submit"} onClick={onEnviar} disabled={enviando} className={botonPrimario}>{enviar}</button>
      </div>
    </div>
  );
}
