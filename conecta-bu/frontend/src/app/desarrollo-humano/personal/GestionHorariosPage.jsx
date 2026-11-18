import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { formatearHora, fechaInputUTC, horaInputUTC, fechaLarga } from "../comunes/lib/format";
import { Aviso, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";
import { PublicarSemana } from "./PublicarSemana";
import { BotonFlotante, Ventana } from "../comunes/componentes/Ventana";
import { CalendarioMes } from "../comunes/componentes/CalendarioMes";
import { FormularioNoDisponible, textoBloqueo } from "./NoDisponible";

const FORM_VACIO = { servicioId: "", fecha: "", horaInicio: "", horaFin: "", cupo: 1 };

const OPCIONES_VISTA = [
  ["calendario", "Calendario", "calendario"],
  ["lista", "Lista", "lista"],
];

const OPCIONES_FILTRO = [
  ["todos", "Todos"],
  ["libres", "Libres"],
  ["ocupados", "Ocupados"],
];

const CAMPOS_EDICION = [
  ["fecha", "Fecha", "date"],
  ["horaInicio", "Empieza", "time"],
  ["horaFin", "Termina", "time"],
];

// ---------- Tokens de diseño y colorimetría ----------

const BASE_ACCION =
  "inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all duration-150 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed";

// Acción principal de confirmación (Guardar edición): azul institucional sólido.
const ACCION_GUARDAR = `${botonPrimario} !min-h-[36px] !px-3.5 !text-sm`;

// Acción neutra secundaria (Editar / Cancelar).
const ACCION_NEUTRA = `${botonSecundario} !min-h-[36px] !px-3.5`;

// Cerrar horario: ámbar suave, coherente con "No disponible".
const ACCION_CERRAR = `${BASE_ACCION} border border-amber-300/90 text-amber-800 bg-amber-50/80 hover:bg-amber-100`;

// Volver a abrir: verde teal suave, coherente con estado "Libre".
const ACCION_ABRIR = `${BASE_ACCION} border border-[#0B6B61]/30 text-[#0B6B61] bg-[#D5EFEA]/70 hover:bg-[#D5EFEA]`;

// Eliminar: discreto en reposo para reducir ruido visual; rojo claro solo en hover.
const ACCION_ELIMINAR = `${BASE_ACCION} text-ink-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200`;

// Acción de fila para la barra de avisos de bloqueo (Quitar).
const ACCION_FILA = `${BASE_ACCION} border border-amber-300 text-amber-900 bg-white hover:bg-amber-100/70`;

// Etiquetas de estado sincronizadas con la leyenda del calendario (verde = libre, marino = ocupado).
const BADGE_BASE = "inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 border select-none";
const BADGE_LIBRE = `${BADGE_BASE} bg-emerald-50 text-emerald-800 border-emerald-200/80`;
const BADGE_OCUPADO = `${BADGE_BASE} bg-[#19407B]/[0.07] text-[#19407B] border-[#19407B]/20`;
const BADGE_PASADO = `${BADGE_BASE} bg-gray-100 text-ink-500 border-gray-200`;

// ---------- Hooks locales ----------

// Mensaje que se oculta solo después de unos segundos.
function useMensajeTemporal(ms = 5000) {
  const [mensaje, setMensaje] = useState("");
  useEffect(() => {
    if (!mensaje) return undefined;
    const id = setTimeout(() => setMensaje(""), ms);
    return () => clearTimeout(id);
  }, [mensaje, ms]);
  return [mensaje, setMensaje];
}

// Ejecuta `cerrar` al presionar Escape mientras `activo` sea true.
function useCerrarConEscape(activo, cerrar) {
  useEffect(() => {
    if (!activo) return undefined;
    const alTeclear = (e) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [activo, cerrar]);
}

// ---------- Funciones auxiliares ----------

const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoyISO = () => aISO(new Date());
const plural = (n, uno, muchos) => `${n} ${n === 1 ? uno : muchos}`;

function agrupar(lista) {
  const grupos = [];
  for (const h of [...lista].sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio))) {
    const dia = h.fecha.slice(0, 10);
    if (!grupos.length || grupos.at(-1).dia !== dia) grupos.push({ dia, fecha: h.fecha, horarios: [] });
    grupos.at(-1).horarios.push(h);
  }
  return grupos;
}

// Marcas por día para el calendario: libres, ocupados y tiempos no disponibles.
function construirMarcas(horarios, bloqueos) {
  const marcas = {};
  for (const g of agrupar(horarios)) {
    const libres = g.horarios.filter((h) => !h.ocupado).length;
    const ocupados = g.horarios.length - libres;
    marcas[g.dia] = [
      ...(libres ? [{ texto: plural(libres, "libre", "libres"), tono: "verde" }] : []),
      ...(ocupados ? [{ texto: plural(ocupados, "ocupado", "ocupados"), tono: "marino" }] : []),
    ];
  }
  for (const b of bloqueos) {
    for (let d = new Date(`${b.fechaInicio}T12:00:00`); ; d.setDate(d.getDate() + 1)) {
      const dia = aISO(d);
      if (dia > b.fechaFin) break;
      (marcas[dia] ||= []).unshift({ texto: b.motivo, tono: "ambar" });
    }
  }
  return marcas;
}

// ---------- Componentes locales ----------

// Navegación entre vistas o filtros: pestañas neutras con acento institucional al activarse.
function PestanasVista({ valor, alCambiar, opciones }) {
  return (
    <div role="tablist" className="inline-flex items-center gap-1 rounded-xl bg-gray-100/90 p-1">
      {opciones.map(([id, texto, icono]) => {
        const activa = valor === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => alCambiar(id)}
            className={`inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg px-3.5 text-sm font-bold transition-all duration-150 ${
              activa ? "bg-white text-[#19407B] shadow-sm ring-1 ring-gray-200/80" : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {icono && <Icono nombre={icono} size={16} strokeWidth={2.2} />}
            {texto}
          </button>
        );
      })}
    </div>
  );
}

function FilaEdicion({ formEdicion, setFormEdicion, servicios, ocupado, onGuardar, onCancelar }) {
  const campo = (clave) => (e) => setFormEdicion({ ...formEdicion, [clave]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end rounded-xl bg-slate-50/90 border border-slate-200/80 p-4">
      <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-600 lg:col-span-2">
        Servicio
        <select value={formEdicion.servicioId} onChange={campo("servicioId")} className={claseCampo}>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>
      {CAMPOS_EDICION.map(([clave, texto, type]) => (
        <label key={clave} className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">
          {texto}
          <input type={type} value={formEdicion[clave]} onChange={campo(clave)} className={claseCampo} />
        </label>
      ))}
      <div className="flex items-center gap-2 pt-1 lg:col-span-5">
        <button type="button" onClick={onGuardar} disabled={ocupado} className={ACCION_GUARDAR}>
          {ocupado ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" onClick={onCancelar} className={ACCION_NEUTRA}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FilaHorario({ horario, ocupado, pasado, onEditar, onAlternar, onEliminar }) {
  const estaCerrado = horario.ocupado;

  return (
    <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-3">
      {/* Bloque izquierdo: Franja horaria + Servicio + Estado */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`w-1 self-stretch rounded-full shrink-0 ${
            pasado ? "bg-gray-300" : estaCerrado ? "bg-[#19407B]" : "bg-emerald-500"
          }`}
          aria-hidden="true"
        />
        <div className="w-[96px] shrink-0">
          <span className={`block text-sm font-extrabold tabular-nums ${pasado ? "text-ink-500" : "text-ink-900"}`}>
            {formatearHora(horario.horaInicio)}
          </span>
          <span className="block text-xs text-ink-500 tabular-nums">a {formatearHora(horario.horaFin)}</span>
        </div>

        <div className="min-w-0 border-l border-gray-200/80 pl-3.5">
          <span className={`block text-sm font-bold truncate ${pasado ? "text-ink-500" : "text-ink-900"}`}>
            {horario.servicio?.nombre}
          </span>
          <div className="mt-1">
            {pasado ? (
              <span className={BADGE_PASADO}>Finalizado</span>
            ) : estaCerrado ? (
              <span className={BADGE_OCUPADO}>
                <span className="h-1.5 w-1.5 rounded-full bg-[#19407B]" />
                Ocupado / Cerrado
              </span>
            ) : (
              <span className={BADGE_LIBRE}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Libre
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bloque derecho: Acciones jerarquizadas */}
      {!pasado && (
        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          <button type="button" onClick={onEditar} className={ACCION_NEUTRA} title="Cambiar fecha, horas o servicio de este horario">
            Editar
          </button>
          {estaCerrado ? (
            <button type="button" onClick={onAlternar} disabled={ocupado} className={ACCION_ABRIR} title="Volver a ofrecer este horario a los estudiantes">
              Volver a abrir
            </button>
          ) : (
            <button type="button" onClick={onAlternar} disabled={ocupado} className={ACCION_CERRAR} title="Dejar de ofrecer este horario a los estudiantes">
              Cerrar
            </button>
          )}
          <button type="button" onClick={onEliminar} disabled={ocupado} className={ACCION_ELIMINAR} title="Borrar este horario de forma definitiva">
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

function GrupoHorarios({
  grupo,
  hoyStr,
  servicios,
  editandoId,
  formEdicion,
  setFormEdicion,
  accionando,
  acciones,
  mostrarCabecera = true,
}) {
  const esHoy = grupo.dia === hoyStr;
  // Comparar fechas en formato AAAA-MM-DD funciona como orden cronológico.
  const pasado = grupo.dia < hoyStr;

  return (
    <section aria-label={fechaLarga(grupo.fecha)} className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden">
      {mostrarCabecera && (
        <h2 className="m-0 px-5 py-3.5 text-base font-extrabold flex items-center justify-between gap-3 bg-gray-50/70 border-b border-gray-100 text-ink-900">
          <span className="flex items-center gap-2.5">
            {fechaLarga(grupo.fecha)}
            {esHoy && (
              <span className="inline-flex items-center rounded-md bg-primary-light text-primary-soft text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 select-none">
                Hoy
              </span>
            )}
            {pasado && (
              <span className="inline-flex items-center rounded-md bg-gray-100 text-ink-600 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 select-none">
                Pasado
              </span>
            )}
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-500 bg-white px-2.5 py-1 rounded-full border border-gray-200/80">
            {plural(grupo.horarios.length, "horario", "horarios")}
          </span>
        </h2>
      )}
      <ul className="list-none m-0 p-0 divide-y divide-gray-100">
        {grupo.horarios.map((h) => (
          <li key={h.id} className={`px-4 sm:px-5 py-3.5 transition-colors ${pasado ? "bg-gray-50/40" : "hover:bg-slate-50/60"}`}>
            {editandoId === h.id && !pasado ? (
              <FilaEdicion
                formEdicion={formEdicion}
                setFormEdicion={setFormEdicion}
                servicios={servicios}
                ocupado={accionando === h.id}
                onGuardar={() => acciones.guardarEdicion(h.id)}
                onCancelar={acciones.cancelarEdicion}
              />
            ) : (
              <FilaHorario
                horario={h}
                pasado={pasado}
                ocupado={accionando === h.id}
                onEditar={() => acciones.empezarEdicion(h)}
                onAlternar={() => acciones.alternarDisponibilidad(h)}
                onEliminar={() => acciones.eliminarHorario(h)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FormularioUnaHora({ form, setForm, servicios, hoyStr, enviando, onSubmit }) {
  const campo = (clave) => (e) => setForm({ ...form, [clave]: e.target.value });
  const lbl = "flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-600";
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 grid gap-4 sm:grid-cols-2 items-end max-w-[720px]">
      <p className="m-0 sm:col-span-2 text-sm text-ink-600">Para una cita en una fecha y hora exactas, fuera de tu horario habitual.</p>
      <label className={`${lbl} sm:col-span-2`}>
        Servicio
        <select required value={form.servicioId} onChange={campo("servicioId")} className={claseCampo}>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={`${lbl} sm:col-span-2`}>
        Fecha
        <input required type="date" min={hoyStr} value={form.fecha} onChange={campo("fecha")} className={claseCampo} />
      </label>
      <label className={lbl}>
        Empieza
        <input required type="time" value={form.horaInicio} onChange={campo("horaInicio")} className={claseCampo} />
      </label>
      <label className={lbl}>
        Termina
        <input required type="time" value={form.horaFin} onChange={campo("horaFin")} className={claseCampo} />
      </label>
      <button
        type="submit"
        disabled={enviando}
        className={`${botonPrimario} sm:col-span-2 w-full mt-1 disabled:cursor-not-allowed`}
      >
        {enviando ? "Agregando…" : "Agregar este horario"}
      </button>
    </form>
  );
}

// RF-007 · HU-13, HU-14: el administrador publica horarios de atención y
// puede modificarlos, cerrarlos, volver a abrirlos o eliminarlos.
// Agenda propia de Desarrollo Humano (/admin/horarios).
export function GestionHorariosPage({ api = "/admin" }) {
  const [servicios, setServicios] = useState([]);
  const [horarios, setHorarios] = useState(null);
  const [errorCarga, setErrorCarga] = useState("");
  const [bloqueos, setBloqueos] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [formEdicion, setFormEdicion] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [accionando, setAccionando] = useState(null);
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [params, setParams] = useSearchParams();
  // ?agregar=1 (desde "Publicar horario" del inicio) abre el panel de una vez.
  const [panelAbierto, setPanelAbierto] = useState(params.get("agregar") === "1");
  const [modoPanel, setModoPanel] = useState("semana");
  const [aviso, setAviso] = useMensajeTemporal(5000);
  const [vista, setVista] = useState("calendario");
  const [filtro, setFiltro] = useState("todos");
  const [diaSel, setDiaSel] = useState(null);

  const hoyStr = hoyISO();

  const cerrarPanel = useCallback(() => {
    setPanelAbierto(false);
    setError("");
    if (params.get("agregar")) setParams({}, { replace: true });
  }, [params, setParams]);

  // Escape cierra el panel. No se cierra con scroll porque es un modal.
  useCerrarConEscape(panelAbierto, cerrarPanel);

  function abrirPanel(modo) {
    setError("");
    setAviso("");
    setModoPanel(modo);
    setPanelAbierto(true);
  }

  const cargarHorarios = useCallback(() => {
    http
      .get(`${api}/horarios/bloqueos`)
      .then((res) => setBloqueos(res.data.bloqueos || []))
      .catch(() => setBloqueos([]));
    return http
      .get(`${api}/horarios`)
      .then((res) => {
        setHorarios(res.data.horarios);
        setErrorCarga("");
      })
      .catch((err) => {
        // Sin horarios cargados: se muestra el error, no el "Cargando…" eterno.
        setHorarios(null);
        setErrorCarga(err.response?.data?.message || "No fue posible cargar tus horarios. Revisa tu conexión e intenta de nuevo.");
      });
  }, [api]);

  useEffect(() => {
    http
      .get("/servicios")
      .then((res) => {
        setServicios(res.data.servicios);
        setForm((f) => ({ ...f, servicioId: f.servicioId || res.data.servicios[0]?.id || "" }));
      })
      .catch(() => setError("No fue posible cargar los servicios."));
    cargarHorarios();
  }, [cargarHorarios]);

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
      await http.post(`${api}/horarios`, form);
      setForm((f) => ({ ...FORM_VACIO, servicioId: f.servicioId }));
      await cargarHorarios();
      setPanelAbierto(false);
      setAviso("Listo: el horario quedó publicado y ya aparece en tu lista.");
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible crear el horario.");
    } finally {
      setEnviando(false);
    }
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
      setAviso("Listo: los cambios del horario quedaron guardados.");
      await cargarHorarios();
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
      if (horario.ocupado) {
        await http.patch(`${api}/horarios/${horario.id}/habilitar`);
        setAviso("Listo: el horario volvió a estar abierto para los estudiantes.");
      } else {
        await http.patch(`${api}/horarios/${horario.id}/deshabilitar`, {});
        setAviso("Listo: el horario quedó cerrado y ya no se ofrece a los estudiantes.");
      }
      await cargarHorarios();
    } catch (err) {
      const mensaje = err.response?.data?.message || "";
      // HU-14: si el horario tiene una cita agendada, el backend pide confirmar
      // porque también se cancelaría esa cita.
      if (err.response?.status === 409 && mensaje.toLowerCase().includes("confirma")) {
        if (window.confirm(`${mensaje}\n\n¿Deseas continuar de todas formas?`)) {
          try {
            await http.patch(`${api}/horarios/${horario.id}/deshabilitar`, { confirmar: true });
            setAviso("Listo: el horario quedó cerrado y la cita fue cancelada.");
            await cargarHorarios();
          } catch (err2) {
            setError(err2.response?.data?.message || "No fue posible cerrar el horario.");
          }
        }
      } else {
        setError(mensaje || "No fue posible actualizar el horario.");
      }
    } finally {
      setAccionando(null);
    }
  }

  // Eliminación definitiva. Si el horario tiene citas, el backend responde 409
  // y se pide confirmación antes de reintentar con confirmar=true.
  async function eliminarHorario(horario) {
    if (!window.confirm(`¿Eliminar el horario de las ${formatearHora(horario.horaInicio)}? Esta acción no se puede deshacer.`)) return;
    setError("");
    setAccionando(horario.id);
    try {
      await http.delete(`${api}/horarios/${horario.id}`);
      setAviso("Listo: el horario fue eliminado.");
      await cargarHorarios();
    } catch (err) {
      const mensaje = err.response?.data?.message || "";
      if (err.response?.status === 409) {
        if (window.confirm(`${mensaje}\n\n¿Deseas eliminarlo de todas formas?`)) {
          try {
            await http.delete(`${api}/horarios/${horario.id}`, { params: { confirmar: true } });
            setAviso("Listo: el horario y sus citas fueron eliminados.");
            await cargarHorarios();
          } catch (err2) {
            setError(err2.response?.data?.message || "No fue posible eliminar el horario.");
          }
        }
      } else {
        setError(mensaje || "No fue posible eliminar el horario.");
      }
    } finally {
      setAccionando(null);
    }
  }

  const acciones = {
    empezarEdicion,
    guardarEdicion,
    alternarDisponibilidad,
    eliminarHorario,
    cancelarEdicion: () => setEditandoId(null),
  };

  // Horarios del periodo (pasados o futuros según el toggle) y luego el filtro de estado.
  const delPeriodo = (horarios || []).filter((h) => verAnteriores || h.fecha.slice(0, 10) >= hoyStr);
  const libres = delPeriodo.filter((h) => !h.ocupado).length;
  const ocupados = delPeriodo.length - libres;
  const visibles = delPeriodo.filter((h) => filtro === "todos" || (filtro === "libres" ? !h.ocupado : h.ocupado));
  const porDia = agrupar(visibles);
  const marcas = construirMarcas(horarios || [], bloqueos);
  const diaElegido = diaSel || hoyStr;
  const grupoElegido = agrupar((horarios || []).filter((h) => h.fecha.slice(0, 10) === diaElegido))[0];
  const bloqueosDe = (dia) => bloqueos.filter((b) => b.fechaInicio <= dia && b.fechaFin >= dia);
  const proximosBloqueos = bloqueos.filter((b) => b.fechaFin >= hoyStr);

  // Encabezado del día elegido: "Martes 17 de noviembre". Se arma desde el
  // AAAA-MM-DD en UTC para que la zona del navegador no corra el día.
  const fechaElegida = new Date(`${diaElegido}T12:00:00Z`);
  const nombreDia = fechaElegida.toLocaleDateString("es-CO", { weekday: "long", timeZone: "UTC" });
  const nombreMes = fechaElegida.toLocaleDateString("es-CO", { month: "long", timeZone: "UTC" });
  const tituloDia = `${nombreDia.charAt(0).toUpperCase()}${nombreDia.slice(1)} ${fechaElegida.getUTCDate()} de ${nombreMes}`;

  const grupoProps = { hoyStr, servicios, editandoId, formEdicion, setFormEdicion, accionando, acciones };
  const hayFiltros = filtro !== "todos" || verAnteriores;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-32">
      <header className="mb-7">
        <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#19407B]">Desarrollo Humano · Agenda</p>
        <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold text-ink-900">Mis horarios de atención</h1>
        <p className="mt-2 mb-0 text-ink-500 max-w-[46em] leading-relaxed">
          Estas son las horas que los estudiantes pueden reservar. Para publicar más o marcar un tiempo en que no atiendes, usa el botón{" "}
          <strong className="text-ink-900">Agregar horario</strong>.
        </p>
      </header>

      {error && !panelAbierto && (
        <div className="mb-5">
          <Aviso>{error}</Aviso>
        </div>
      )}
      {aviso && (
        <div className="mb-5" role="status">
          <Aviso tono="verde">{aviso}</Aviso>
        </div>
      )}

      {/* Barra de herramientas: vistas y resumen de estados a la izquierda, filtros a la derecha */}
      <div className="flex justify-between items-center gap-4 flex-wrap mb-6 bg-white rounded-2xl border border-gray-200/90 shadow-sm px-3.5 py-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          <PestanasVista valor={vista} alCambiar={setVista} opciones={OPCIONES_VISTA} />
          <div className="hidden sm:block h-6 w-px bg-gray-200" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <span className={`${BADGE_LIBRE} tabular-nums`}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {plural(libres, "libre", "libres")}
            </span>
            <span className={`${BADGE_OCUPADO} tabular-nums`}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#19407B]" />
              {plural(ocupados, "ocupado", "ocupados")}
            </span>
          </div>
        </div>

        {vista === "lista" && (
          <div className="flex items-center gap-3 flex-wrap">
            <PestanasVista valor={filtro} alCambiar={setFiltro} opciones={OPCIONES_FILTRO} />
            <label className="flex items-center gap-2 min-h-[40px] px-1 text-sm font-bold text-ink-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={verAnteriores}
                onChange={(e) => setVerAnteriores(e.target.checked)}
                className="w-4 h-4 rounded accent-[#19407B]"
              />
              Días pasados
            </label>
          </div>
        )}
      </div>

      {/* Tiempos no disponibles */}
      {proximosBloqueos.length > 0 && (
        <section className="mb-6 bg-amber-50/90 border border-amber-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Icono nombre="calendario" size={16} strokeWidth={2.2} />
            </span>
            <h2 className="m-0 text-base font-extrabold text-amber-950">Tiempo no disponible</h2>
          </div>
          <ul className="list-none m-0 p-0 flex flex-col gap-2">
            {proximosBloqueos.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 flex-wrap bg-white rounded-xl border border-amber-200/80 border-l-4 border-l-amber-400 px-4 py-3 shadow-sm"
              >
                <span className="min-w-0">
                  <span className="block font-bold text-ink-900">
                    {b.motivo}
                    {b.detalle ? <span className="font-semibold text-ink-500"> · {b.detalle}</span> : null}
                  </span>
                  <span className="block text-sm text-ink-500">{textoBloqueo(b)}</span>
                </span>
                <button type="button" onClick={() => quitarBloqueo(b)} className={ACCION_FILA}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Carga y error */}
      {!horarios && !errorCarga && <p className="text-ink-500">Cargando horarios…</p>}
      {!horarios && errorCarga && (
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm px-6 py-10 text-center flex flex-col items-center gap-3">
          <p className="m-0 text-lg font-extrabold text-ink-900">No pudimos cargar tus horarios</p>
          <p className="m-0 text-ink-500 max-w-[36em]">{errorCarga}</p>
          <button type="button" onClick={cargarHorarios} className={`${botonPrimario} mt-2`}>
            Reintentar
          </button>
        </div>
      )}

      {/* Vista calendario */}
      {horarios && vista === "calendario" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)] items-start">
          <CalendarioMes
            marcas={marcas}
            seleccionado={diaElegido}
            onSeleccionar={setDiaSel}
            leyenda={[
              ["verde", "Libres para reservar"],
              ["marino", "Ocupados (con cita o cerrados)"],
              ["ambar", "No disponible"],
            ]}
          />

          <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm px-5 py-4">
              <h2 className="m-0 text-left text-lg font-extrabold text-ink-900">{tituloDia}</h2>
            </div>

            {bloqueosDe(diaElegido).map((b) => (
              <div
                key={b.id}
                className="rounded-2xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-400 text-amber-900 px-4 py-3 flex items-center justify-between gap-3"
              >
                <span>
                  <strong className="block">No disponible: {b.motivo}</strong>
                  <span className="block text-sm text-amber-800">
                    {b.todoElDia ? "Todo el día" : `${formatearHora(b.horaInicio)} a ${formatearHora(b.horaFin)}`}
                  </span>
                </span>
                <button type="button" onClick={() => quitarBloqueo(b)} className={ACCION_FILA}>
                  Quitar
                </button>
              </div>
            ))}

            {grupoElegido ? (
              <GrupoHorarios grupo={grupoElegido} mostrarCabecera={false} {...grupoProps} />
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center flex flex-col items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-[#19407B]/[0.08] text-[#19407B] flex items-center justify-center">
                  <Icono nombre="calendario" size={22} strokeWidth={2} />
                </span>
                <p className="m-0 font-extrabold text-ink-900">Sin horarios este día</p>
                <p className="m-0 text-sm text-ink-500 max-w-[24em]">Los estudiantes no podrán reservar en esta fecha hasta que publiques un horario.</p>
                {diaElegido >= hoyStr && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, fecha: diaElegido }));
                      abrirPanel("una");
                    }}
                    className={`${botonSecundario} mt-1`}
                  >
                    Agregar un horario este día
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Vista lista: vacía, sin resultados por filtro, o con horarios */}
      {horarios && vista === "lista" && delPeriodo.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm px-6 py-14 text-center flex flex-col items-center gap-3">
          <span className="w-16 h-16 rounded-2xl bg-[#19407B]/[0.08] text-[#19407B] flex items-center justify-center">
            <Icono nombre="calendario" size={28} strokeWidth={2} />
          </span>
          <p className="m-0 text-lg font-extrabold text-ink-900">Todavía no tienes horarios publicados</p>
          <p className="m-0 text-ink-500 max-w-[36em]">Publica las horas en que atiendes para que los estudiantes puedan pedir su cita.</p>
          <button type="button" onClick={() => abrirPanel("semana")} className={`${botonPrimario} mt-2`}>
            Agregar horario
          </button>
        </div>
      )}

      {horarios && vista === "lista" && delPeriodo.length > 0 && visibles.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm px-6 py-10 text-center flex flex-col items-center gap-3">
          <p className="m-0 text-lg font-extrabold text-ink-900">Ningún horario coincide con este filtro</p>
          <p className="m-0 text-ink-500">Hay {plural(delPeriodo.length, "horario", "horarios")} en total.</p>
          <button
            type="button"
            onClick={() => {
              setFiltro("todos");
              setVerAnteriores(false);
            }}
            className={`${botonSecundario} mt-2`}
          >
            Ver todos
          </button>
        </div>
      )}

      {horarios && vista === "lista" && visibles.length > 0 && (
        <div className="flex flex-col gap-4">
          {hayFiltros && (
            <p className="m-0 text-sm font-bold text-ink-700" aria-live="polite">
              Mostrando {plural(visibles.length, "horario", "horarios")}.
            </p>
          )}
          {porDia.map((grupo) => (
            <GrupoHorarios key={grupo.dia} grupo={grupo} {...grupoProps} />
          ))}
        </div>
      )}

      {!panelAbierto && servicios.length > 0 && <BotonFlotante onClick={() => abrirPanel("semana")}>Agregar horario</BotonFlotante>}

      {panelAbierto && (
        <Ventana titulo="Agregar horario" alCerrar={cerrarPanel}>
          <div role="tablist" aria-label="Forma de agregar" className="inline-flex flex-wrap bg-white border border-gray-200/90 rounded-2xl p-1 gap-1 mb-5 shadow-xs">
            {[
              ["semana", "Varias horas"],
              ["una", "Una sola hora"],
              ["ausente", "No estaré disponible"],
            ].map(([id, texto]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={modoPanel === id}
                onClick={() => setModoPanel(id)}
                className={`min-h-[38px] px-4 rounded-xl text-sm font-extrabold cursor-pointer transition-all duration-150 ${
                  modoPanel === id
                    ? "bg-[#EBF2FA] text-[#19407B] border border-[#19407B]"
                    : "text-ink-600 border border-transparent hover:text-[#19407B] hover:bg-[#F4F6F9]"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
          {error && (
            <div className="mb-4">
              <Aviso>{error}</Aviso>
            </div>
          )}
          {modoPanel === "ausente" ? (
            <FormularioNoDisponible
              api={api}
              fechaInicial={diaSel}
              alGuardar={async (res) => {
                setPanelAbierto(false);
                setAviso(
                  `Listo: «${res.bloqueo.motivo}» quedó registrado. ${
                    res.citasCanceladas ? `Se cancelaron ${res.citasCanceladas} ${res.citasCanceladas === 1 ? "cita" : "citas"} y se avisó a los estudiantes. ` : ""
                  }En ese tiempo los estudiantes no verán horarios.`,
                );
                await cargarHorarios();
              }}
            />
          ) : modoPanel === "semana" ? (
            <PublicarSemana api={api} servicios={servicios} horarios={horarios} alPublicar={cargarHorarios} />
          ) : (
            <FormularioUnaHora form={form} setForm={setForm} servicios={servicios} hoyStr={hoyStr} enviando={enviando} onSubmit={crearHorario} />
          )}
        </Ventana>
      )}
    </main>
  );
}