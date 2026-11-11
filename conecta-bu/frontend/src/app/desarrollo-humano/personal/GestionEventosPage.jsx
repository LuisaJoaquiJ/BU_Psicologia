import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { fechaInputUTC, fechaLarga, formatearHora, horaInputUTC } from "../comunes/lib/format";
import { urlDelServidor } from "../comunes/lib/imagenes";
import { Aviso, Segmentos, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";

// RF-009: talleres y eventos de Desarrollo Humano. Un solo formulario sirve
// para crear, duplicar y editar, con vista previa en vivo de cómo lo verán
// los estudiantes. Desde cada evento se va a inscritos y asistencia (RF-011).

const VACIO = {
  nombre: "",
  descripcion: "",
  lugar: "",
  modalidad: "Presencial",
  enlaceReunion: "",
  fecha: "",
  horaInicio: "14:00",
  horaFin: "16:00",
  cupos: 30,
  cierre: "antes",
  fechaLimiteInscripcion: "",
};

// Acción principal de estado según el estado actual; el resto va en "Más".
const ACCION_PRINCIPAL = {
  Borrador: { estado: "Publicado", label: "Publicar" },
  Publicado: { estado: "Cerrado", label: "Cerrar inscripciones" },
  Cerrado: { estado: "Publicado", label: "Reabrir inscripciones" },
};

function restarDia(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function horaTexto(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

function limiteDe(v) {
  if (!v.fecha) return "";
  if (v.cierre === "antes") return restarDia(v.fecha);
  if (v.cierre === "mismo") return v.fecha;
  return v.fechaLimiteInscripcion;
}

function erroresDe(v) {
  const e = {};
  if (!v.nombre.trim()) e.nombre = "Escribe el nombre del evento.";
  if (!v.fecha) e.fecha = "Elige la fecha.";
  if (!v.horaInicio || !v.horaFin) e.horas = "Escribe la hora de inicio y de fin.";
  else if (v.horaFin <= v.horaInicio) e.horas = "La hora de fin debe ser después de la de inicio.";
  if (!(Number(v.cupos) >= 1)) e.cupos = "Debe haber al menos un cupo.";
  if (v.modalidad !== "Presencial") {
    const enlace = (v.enlaceReunion || "").trim();
    if (!enlace) e.enlace = "Pega el enlace de la reunión (Meet, Teams o Zoom).";
    else if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(enlace)) e.enlace = "Ese enlace no parece completo. Cópialo de nuevo desde la reunión.";
  }
  const lim = limiteDe(v);
  if (v.cierre === "otra" && !lim) e.limite = "Elige hasta cuándo hay inscripciones.";
  else if (lim && v.fecha && lim > v.fecha) e.limite = "Las inscripciones no pueden cerrar después del evento.";
  return e;
}

const chip = (activo) =>
  `min-h-[44px] px-4 rounded-full border-[1.5px] font-extrabold transition-colors ${
    activo ? "border-transparent boton-liquido" : "border-[#D3DBE8] bg-white text-primary hover:border-primary"
  }`;

function Formulario({ inicial, modo, eventos, alGuardar, alCancelar, enVentana = false }) {
  const [v, setV] = useState(inicial);
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(null);
  const [error, setError] = useState("");
  // Foto: la que ya tenia el evento, una nueva elegida o la marca de quitarla.
  const [foto, setFoto] = useState({ archivo: null, vista: inicial.imagenUrl ? urlDelServidor(inicial.imagenUrl) : null, quitar: false });
  const [errorFoto, setErrorFoto] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  function elegirFoto(archivo) {
    setErrorFoto("");
    if (!archivo) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) return setErrorFoto("La foto debe ser JPG, PNG o WEBP.");
    if (archivo.size > 5 * 1024 * 1024) return setErrorFoto("La foto no puede pesar más de 5 MB.");
    setFoto({ archivo, vista: URL.createObjectURL(archivo), quitar: false });
  }
  const set = (clave) => (e) => setV((x) => ({ ...x, [clave]: e.target.value }));
  const errores = erroresDe(v);
  const mostrar = (k) => intentado && errores[k];
  const lugares = useMemo(() => [...new Set((eventos || []).map((e) => e.lugar).filter(Boolean))], [eventos]);
  const limite = limiteDe(v);

  function copiarDe(id) {
    const e = eventos.find((x) => x.id === id);
    if (!e) return;
    setV((x) => ({
      ...x,
      nombre: e.nombre,
      descripcion: e.descripcion || "",
      lugar: e.lugar || "",
      modalidad: e.modalidad || "Presencial",
      enlaceReunion: e.enlaceReunion || "",
      horaInicio: horaInputUTC(e.horaInicio),
      horaFin: horaInputUTC(e.horaFin),
      cupos: e.cupos,
    }));
  }

  async function guardar(estado) {
    setIntentado(true);
    setError("");
    if (Object.keys(errores).length) return;
    setEnviando(estado || "guardar");
    const datos = {
      nombre: v.nombre.trim(),
      descripcion: v.descripcion,
      lugar: v.modalidad === "Virtual" ? "" : v.lugar,
      modalidad: v.modalidad,
      enlaceReunion: v.modalidad === "Presencial" ? "" : v.enlaceReunion.trim(),
      fecha: v.fecha,
      horaInicio: v.horaInicio,
      horaFin: v.horaFin,
      cupos: Number(v.cupos),
      fechaLimiteInscripcion: limite,
    };
    try {
      const res = modo === "editar" ? await http.patch(`/admin/eventos/${inicial.id}`, datos) : await http.post("/admin/eventos", { ...datos, estado });
      const id = res.data.evento?.id || inicial.id;
      // La foto va aparte: si falla, el evento igual queda guardado.
      let avisoFoto = "";
      try {
        if (foto.archivo) {
          const forma = new FormData();
          forma.append("imagen", foto.archivo);
          await http.post(`/admin/eventos/${id}/imagen`, forma);
        } else if (foto.quitar && inicial.imagenUrl) {
          await http.delete(`/admin/eventos/${id}/imagen`);
        }
      } catch (errFoto) {
        avisoFoto = ` Pero no pudimos guardar la foto: ${errFoto.response?.data?.message || "intenta subirla de nuevo editando el evento."}`;
      }
      await alGuardar(
        (modo === "editar"
          ? "Guardamos los cambios del evento."
          : estado === "Publicado"
            ? "Publicado. Los estudiantes ya lo ven en la agenda y pueden inscribirse."
            : "Guardado como borrador. Solo el personal lo ve hasta que lo publiques.") + avisoFoto,
      );
    } catch (err) {
      setError(err.response?.data?.message || "No pudimos guardar el evento. Intenta de nuevo.");
    } finally {
      setEnviando(null);
    }
  }

  const campoError = (k) => (mostrar(k) ? "!border-red-600" : "");

  return (
    <section
      aria-label={modo === "editar" ? "Editar evento" : "Nuevo taller o evento"}
      className="flex flex-col gap-4"
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          guardar(modo === "editar" ? undefined : "Publicado");
        }}
        className={`flex flex-col gap-[18px] ${enVentana ? "" : "bg-white rounded-xl p-5 sm:p-7"}`}
      >
        {!enVentana && (
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <h2 id="form-evento" className="m-0 text-2xl font-extrabold">
              {modo === "editar" ? "Editar evento" : "Nuevo taller o evento"}
            </h2>
            <button type="button" onClick={alCancelar} className="min-h-[44px] px-3 rounded-full font-bold text-ink-500 hover:text-primary">
              Cerrar
            </button>
          </div>
        )}

        {modo !== "editar" && eventos?.length > 0 && (
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
            Empezar desde un evento anterior (opcional)
            <select defaultValue="" onChange={(e) => copiarDe(e.target.value)} className={claseCampo}>
              <option value="">— Empezar en blanco —</option>
              {eventos.slice(0, 15).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5 font-extrabold">
          Nombre del evento
          <input
            value={v.nombre}
            onChange={set("nombre")}
            placeholder="Ej.: Taller de manejo del estrés"
            aria-invalid={!!mostrar("nombre")}
            className={`${claseCampo} ${campoError("nombre")}`}
          />
          {mostrar("nombre") && <span className="text-sm font-bold text-red-700">{errores.nombre}</span>}
        </label>

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 font-extrabold">
            Fecha
            <input type="date" value={v.fecha} onChange={set("fecha")} aria-invalid={!!mostrar("fecha")} className={`${claseCampo} ${campoError("fecha")}`} />
          </label>
          <label className="flex flex-col gap-1.5 font-extrabold">
            Empieza
            <input
              type="time"
              value={v.horaInicio}
              onChange={set("horaInicio")}
              aria-invalid={!!mostrar("horas")}
              className={`${claseCampo} ${campoError("horas")}`}
            />
          </label>
          <label className="flex flex-col gap-1.5 font-extrabold">
            Termina
            <input
              type="time"
              value={v.horaFin}
              onChange={set("horaFin")}
              aria-invalid={!!mostrar("horas")}
              className={`${claseCampo} ${campoError("horas")}`}
            />
          </label>
        </div>
        {(mostrar("fecha") || mostrar("horas")) && <p className="-mt-2 m-0 text-sm font-bold text-red-700">{errores.fecha || errores.horas}</p>}

        <div className="flex flex-col gap-1.5">
          <span className="font-extrabold" id="modalidad-etiqueta">
            Modalidad
          </span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-labelledby="modalidad-etiqueta">
            {[
              ["Presencial", "Presencial"],
              ["Virtual", "Virtual"],
              ["Hibrida", "Híbrida"],
            ].map(([id, texto]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={v.modalidad === id}
                onClick={() => setV((x) => ({ ...x, modalidad: id }))}
                className={chip(v.modalidad === id)}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
        {v.modalidad !== "Presencial" && (
          <label className="flex flex-col gap-1.5 font-extrabold">
            Enlace de la reunión
            <input
              type="url"
              inputMode="url"
              spellCheck={false}
              value={v.enlaceReunion}
              onChange={set("enlaceReunion")}
              placeholder="Ej.: https://meet.google.com/abc-defg-hij"
              className={`${claseCampo} ${campoError("enlace")}`}
            />
            {mostrar("enlace") ? (
              <span className="text-sm font-bold text-red-700">{errores.enlace}</span>
            ) : (
              <span className="text-sm font-semibold text-ink-500">Solo lo verán los estudiantes inscritos.</span>
            )}
          </label>
        )}

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {v.modalidad !== "Virtual" && (
            <label className="flex flex-col gap-1.5 font-extrabold">
              {v.modalidad === "Hibrida" ? "Lugar presencial" : "Lugar"}
              <input value={v.lugar} onChange={set("lugar")} list="lugares-eventos" placeholder="Ej.: Auditorio Sede Norte" className={claseCampo} />
              <datalist id="lugares-eventos">
                {lugares.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </label>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="font-extrabold" id="cupos-etiqueta">
              Cupos
            </span>
            <div className="flex items-center gap-2" role="group" aria-labelledby="cupos-etiqueta">
              <button
                type="button"
                aria-label="Cinco cupos menos"
                onClick={() => setV((x) => ({ ...x, cupos: Math.max(1, Number(x.cupos) - 5) }))}
                className="w-12 h-12 rounded-xl border-[1.5px] border-[#D3DBE8] text-primary text-xl font-extrabold hover:border-primary"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                value={v.cupos}
                onChange={set("cupos")}
                aria-label="Cupos"
                className={`${claseCampo} text-center font-extrabold tabular-nums`}
              />
              <button
                type="button"
                aria-label="Cinco cupos más"
                onClick={() => setV((x) => ({ ...x, cupos: Number(x.cupos) + 5 }))}
                className="w-12 h-12 rounded-xl border-[1.5px] border-[#D3DBE8] text-primary text-xl font-extrabold hover:border-primary"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div>
          <p className="m-0 mb-2 font-extrabold">Las inscripciones cierran</p>
          <div role="group" aria-label="Cierre de inscripciones" className="flex gap-2 flex-wrap">
            {[
              ["antes", "Un día antes"],
              ["mismo", "El mismo día"],
              ["otra", "Otra fecha"],
            ].map(([k, t]) => (
              <button key={k} type="button" aria-pressed={v.cierre === k} onClick={() => setV((x) => ({ ...x, cierre: k }))} className={chip(v.cierre === k)}>
                {t}
              </button>
            ))}
          </div>
          {v.cierre === "otra" && (
            <input
              type="date"
              value={v.fechaLimiteInscripcion}
              onChange={set("fechaLimiteInscripcion")}
              aria-label="Fecha de cierre de inscripciones"
              className={`${claseCampo} mt-2 max-w-[240px]`}
            />
          )}
          {mostrar("limite") && <p className="mt-1.5 mb-0 text-sm font-bold text-red-700">{errores.limite}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="m-0 font-extrabold">
            Foto del evento <span className="font-medium text-sm text-ink-500">(opcional)</span>
          </p>
          {foto.vista ? (
            <div className="flex items-center gap-4 flex-wrap">
              <img src={foto.vista} alt="Foto elegida para el evento" className="w-[168px] h-[104px] object-cover rounded-xl border border-gray-200" />
              <div className="flex gap-2 flex-wrap">
                <label className={`${botonSecundario} cursor-pointer`}>
                  Cambiar foto
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => elegirFoto(e.target.files?.[0])} />
                </label>
                <button
                  type="button"
                  onClick={() => setFoto({ archivo: null, vista: null, quitar: true })}
                  className="min-h-[44px] px-4 rounded-full font-bold text-red-700 hover:bg-red-50"
                >
                  Quitar foto
                </button>
              </div>
            </div>
          ) : (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                elegirFoto(e.dataTransfer.files?.[0]);
              }}
              className={`cursor-pointer flex items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-4 transition-colors ${
                arrastrando ? "border-primary bg-primary-light" : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
              }`}
            >
              <span className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0">
                <Icono nombre="imagen" size={24} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-primary">Elige una foto o arrástrala aquí</span>
                <span className="block text-sm text-ink-500">JPG, PNG o WEBP, hasta 5 MB. Si no subes ninguna, usamos una foto de la universidad.</span>
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => elegirFoto(e.target.files?.[0])} />
            </label>
          )}
          {errorFoto && <p className="m-0 text-sm font-bold text-red-700">{errorFoto}</p>}
        </div>

        <label className="flex flex-col gap-1.5 font-extrabold">
          Descripción
          <span className="font-medium text-sm text-ink-500">Qué van a hacer y a quién va dirigido. Dos o tres frases bastan.</span>
          <textarea rows={3} value={v.descripcion} onChange={set("descripcion")} className={`${claseCampo} py-3 resize-y`} />
        </label>

        {error && <Aviso>{error}</Aviso>}
        {intentado && Object.keys(errores).length > 0 && <Aviso>Revisa los campos marcados en rojo para continuar.</Aviso>}

        <aside aria-label="Vista previa">
          <p className="m-0 mb-2 text-[11px] font-bold tracking-[0.08em] uppercase text-ink-500">Así lo verán los estudiantes</p>
          <div className="rounded-xl border border-dashed border-gray-300 bg-cream/60 p-4 flex flex-col gap-2.5">
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-[#E4EAF4] text-primary-dark">{v.modalidad === "Hibrida" ? "Híbrida" : v.modalidad}</span>
              <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-[#E3F4F1] text-[#0B6B61]">Cupos disponibles</span>
            </div>
            {foto.vista && <img src={foto.vista} alt="" className="w-full h-[88px] object-cover rounded-lg" />}
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-xl bg-primary-dark text-white flex flex-col items-center justify-center shrink-0 leading-none">
                <b className="text-base">{v.fecha ? Number(v.fecha.slice(8)) : "—"}</b>
                <span className="text-[9px] font-bold uppercase">{v.fecha ? ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."][Number(v.fecha.slice(5, 7)) - 1] : ""}</span>
              </span>
              <b className="text-ink-900">{v.nombre.trim() || "Nombre del evento"}</b>
            </div>
            <p className="m-0 text-sm text-ink-500 inline-flex items-center gap-1.5">
              <Icono nombre="ubicacion" size={14} />
              {v.modalidad === "Virtual" ? "Virtual" : v.lugar || "Lugar por definir"}
              {v.fecha ? ` · ${horaTexto(v.horaInicio)} a ${horaTexto(v.horaFin)}` : ""}
            </p>
            <div className="h-1.5 rounded-full bg-white overflow-hidden"><div className="h-full bg-teal" style={{ width: "0%" }} /></div>
            <span className="text-xs text-ink-500">0 de {v.cupos || 0} cupos</span>
            {limite && <p className="m-0 text-xs text-ink-500">Inscripciones hasta el {fechaLarga(limite).toLowerCase()}.</p>}
          </div>
        </aside>

        <div className="flex flex-col gap-2 pt-1.5 border-t border-[#EEF2F7]">
          {modo === "editar" ? (
            <>
              <button type="button" onClick={() => guardar()} disabled={!!enviando} className={`${botonPrimario} w-full`}>
                {enviando ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="button" onClick={alCancelar} className={`${botonSecundario} w-full`}>Cancelar</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => guardar("Publicado")} disabled={!!enviando} className={`${botonPrimario} w-full`}>
                {enviando === "Publicado" ? "Publicando…" : "Publicar ahora"}
              </button>
              <button type="button" onClick={() => guardar("Borrador")} disabled={!!enviando} className={`${botonSecundario} w-full`}>
                {enviando === "Borrador" ? "Guardando…" : "Guardar como borrador"}
              </button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}


const MESES_CORTOS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];
const BADGE = {
  Publicado: ["bg-[#E3F4F1] text-[#0B6B61]", "Publicado"],
  Borrador: ["bg-gray-100 text-ink-600", "Borrador"],
  Cerrado: ["bg-red-50 text-red-700", "Inscripciones cerradas"],
  Cancelado: ["bg-gray-100 text-ink-600", "Cancelado"],
};

function cajaFecha(iso) {
  const d = new Date(iso);
  return { dia: d.getUTCDate(), mes: MESES_CORTOS[d.getUTCMonth()] };
}

function FilaEvento({ evento, ocupado, onEstado, onEditar, onDuplicar, onEliminar }) {
  const inscritos = evento._count?.inscripciones ?? 0;
  const resumen = evento.asistenciaResumen || { asistieron: 0, noAsistieron: 0, sinRegistrar: 0 };
  const principal = ACCION_PRINCIPAL[evento.estado];
  const porcentaje = Math.min(100, Math.round((inscritos / Math.max(1, evento.cupos)) * 100));
  const quedan = Math.max(0, evento.cupos - inscritos);
  const fecha = cajaFecha(evento.fecha);
  const pasado = fechaInputUTC(evento.fecha) < hoyLocal();
  const badge = BADGE[evento.estado] || ["bg-gray-100 text-ink-600", evento.estado];
  const lugar = evento.modalidad === "Virtual" ? "Virtual" : `${evento.lugar || "Lugar por definir"}${evento.modalidad === "Hibrida" ? " y virtual" : ""}`;
  const cierre = pasado
    ? resumen.sinRegistrar
      ? `Evento realizado · ${resumen.sinRegistrar} ${resumen.sinRegistrar === 1 ? "asistencia" : "asistencias"} por registrar`
      : "Evento realizado"
    : evento.fechaLimiteInscripcion
      ? `Inscripciones hasta el ${fechaLarga(evento.fechaLimiteInscripcion).toLowerCase()}`
      : "";
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 grid gap-3 sm:grid-cols-[64px_minmax(0,1fr)_200px] sm:items-center">
      <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center leading-none ${evento.estado === "Publicado" ? "bg-primary-dark text-white" : "bg-gray-100 text-ink-600"}`}>
        <b className="text-xl">{fecha.dia}</b>
        <span className="text-[10px] font-bold uppercase tracking-wide mt-1">{fecha.mes}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <strong className="text-ink-900">{evento.nombre}</strong>
          <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${badge[0]}`}>{badge[1]}</span>
        </div>
        <p className="m-0 mt-1 text-sm text-ink-500">
          {fechaLarga(evento.fecha)} · {formatearHora(evento.horaInicio)} a {formatearHora(evento.horaFin)} · {lugar}
        </p>
        {cierre && <p className="m-0 mt-0.5 text-xs text-ink-500">{cierre}</p>}
      </div>
      <div className="min-w-0">
        <p className="m-0 text-sm"><b>{inscritos}</b> de {evento.cupos} inscritos</p>
        <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full ${quedan <= 6 && inscritos > 0 ? "bg-accent" : "bg-teal"}`} style={{ width: `${porcentaje}%` }} />
        </div>
      </div>
      <div className="sm:col-span-2 sm:col-start-2 flex items-center gap-2 flex-wrap border-t border-dashed border-gray-200 pt-3">
        <Link to={`/admin/eventos/${evento.id}/inscritos`} className={botonSecundario}>
          <Icono nombre="usuarios" size={15} strokeWidth={2} />
          Ver inscritos
        </Link>
        {evento.estado !== "Cancelado" && (
          <button type="button" onClick={() => onEditar(evento)} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full text-sm font-bold text-primary hover:bg-primary-light">
            <Icono nombre="editar" size={15} strokeWidth={2} />
            Editar
          </button>
        )}
        {principal && (
          <button type="button" onClick={() => onEstado(evento, principal.estado)} disabled={ocupado} className={evento.estado === "Borrador" ? botonPrimario : "inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full text-sm font-bold text-primary hover:bg-primary-light disabled:opacity-50"}>
            {evento.estado === "Publicado" && <Icono nombre="alerta" size={15} strokeWidth={2} />}
            {principal.label === "Publicar" ? "Publicar ahora" : principal.label}
          </button>
        )}
        <details className="relative">
          <summary className="list-none cursor-pointer inline-flex items-center gap-1 min-h-[40px] px-3 rounded-full text-sm font-bold text-primary hover:bg-primary-light">
            Más
            <Icono nombre="derecha" size={14} strokeWidth={2.2} className="rotate-90" />
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-56 bg-white rounded-xl shadow-[0_16px_40px_rgba(11,35,71,0.18)] p-1.5 flex flex-col">
            <button type="button" onClick={() => onDuplicar(evento)} className="text-left min-h-[40px] px-3 rounded-lg font-bold hover:bg-cream">Duplicar para otra fecha</button>
            {evento.estado === "Publicado" && (
              <button type="button" onClick={() => onEstado(evento, "Borrador")} className="text-left min-h-[40px] px-3 rounded-lg font-bold hover:bg-cream">Volver a borrador</button>
            )}
            {evento.estado !== "Cancelado" && (
              <button type="button" onClick={() => onEstado(evento, "Cancelado")} className="text-left min-h-[40px] px-3 rounded-lg font-bold hover:bg-cream">Cancelar evento</button>
            )}
            <button type="button" onClick={() => onEliminar(evento)} className="text-left min-h-[40px] px-3 rounded-lg font-bold text-red-700 hover:bg-red-50">Eliminar</button>
          </div>
        </details>
      </div>
    </article>
  );
}

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function GestionEventosPage() {
  const [params, setParams] = useSearchParams();
  const [eventos, setEventos] = useState(null);
  const [formulario, setFormulario] = useState({ modo: "crear", inicial: { ...VACIO }, clave: "nuevo" });
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [accionando, setAccionando] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [q, setQ] = useState("");
  const formRef = useRef(null);

  function cargarEventos() {
    return http
      .get("/admin/eventos")
      .then((res) => setEventos(res.data.eventos))
      .catch(() => setError("No pudimos cargar los eventos. Revisa tu conexión e intenta de nuevo."));
  }

  useEffect(() => {
    cargarEventos();
    if (params.get("nuevo") === "1") {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrir(modo, inicial) {
    setMensaje("");
    setFormulario({ modo, inicial, clave: `${modo}-${inicial.id || "nuevo"}-${Date.now()}` });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const cerrarFormulario = useCallback(() => {
    setFormulario({ modo: "crear", inicial: { ...VACIO }, clave: `nuevo-${Date.now()}` });
    if (params.get("nuevo")) setParams({}, { replace: true });
  }, [params, setParams]);

  function editar(e) {
    const fecha = fechaInputUTC(e.fecha);
    const limite = fechaInputUTC(e.fechaLimiteInscripcion);
    abrir("editar", {
      id: e.id,
      nombre: e.nombre,
      descripcion: e.descripcion || "",
      lugar: e.lugar || "",
      modalidad: e.modalidad || "Presencial",
      enlaceReunion: e.enlaceReunion || "",
      fecha,
      horaInicio: horaInputUTC(e.horaInicio),
      horaFin: horaInputUTC(e.horaFin),
      cupos: e.cupos,
      cierre: limite === fecha ? "mismo" : limite === restarDia(fecha) ? "antes" : "otra",
      fechaLimiteInscripcion: limite,
      imagenUrl: e.imagenUrl || null,
    });
  }

  function duplicar(e) {
    abrir("crear", {
      ...VACIO,
      nombre: e.nombre,
      descripcion: e.descripcion || "",
      lugar: e.lugar || "",
      modalidad: e.modalidad || "Presencial",
      enlaceReunion: e.enlaceReunion || "",
      horaInicio: horaInputUTC(e.horaInicio),
      horaFin: horaInputUTC(e.horaFin),
      cupos: e.cupos,
    });
  }

  async function ejecutar(id, accion, mensajeError, exito) {
    setError("");
    setMensaje("");
    setAccionando(id);
    try {
      await accion();
      await cargarEventos();
      if (exito) setMensaje(exito);
    } catch (err) {
      setError(err.response?.data?.message || mensajeError);
    } finally {
      setAccionando(null);
    }
  }

  function cambiarEstado(evento, estado) {
    if (estado === "Cancelado" && !window.confirm(`¿Cancelar el evento "${evento.nombre}"? No se podrá reactivar.`)) return;
    const textos = {
      Publicado: "Publicado: los estudiantes ya lo ven.",
      Cerrado: "Se cerraron las inscripciones.",
      Borrador: "El evento volvió a borrador y dejó de verse.",
      Cancelado: "Evento cancelado.",
    };
    ejecutar(evento.id, () => http.patch(`/admin/eventos/${evento.id}/estado`, { estado }), "No pudimos cambiar el estado del evento.", textos[estado]);
  }

  async function eliminar(evento) {
    if (!window.confirm(`¿Eliminar el evento "${evento.nombre}"? Esta acción no se puede deshacer.`)) return;
    setError("");
    setAccionando(evento.id);
    try {
      await http.delete(`/admin/eventos/${evento.id}`);
      await cargarEventos();
      setMensaje("Evento eliminado.");
    } catch (err) {
      const msj = err.response?.data?.message || "";
      if (err.response?.status === 409 && window.confirm(`${msj}\n\n¿Deseas eliminarlo de todas formas?`)) {
        try {
          await http.delete(`/admin/eventos/${evento.id}`, { params: { confirmar: true } });
          await cargarEventos();
          setMensaje("Evento eliminado.");
        } catch (err2) {
          setError(err2.response?.data?.message || "No pudimos eliminar el evento.");
        }
      } else if (err.response?.status !== 409) {
        setError(msj || "No pudimos eliminar el evento.");
      }
    } finally {
      setAccionando(null);
    }
  }

  const lista = eventos || [];
  const publicados = lista.filter((e) => e.estado === "Publicado");
  const borradores = lista.filter((e) => e.estado === "Borrador");
  const abiertos = publicados.reduce((a, e) => a + (e._count?.inscripciones ?? 0), 0);
  const cuposAbiertos = publicados.reduce((a, e) => a + (e.cupos || 0), 0);
  const cerrados = lista.filter((e) => e.estado === "Cerrado");
  const baseAsist = cerrados.reduce((a, e) => a + ((e.asistenciaResumen?.asistieron || 0) + (e.asistenciaResumen?.noAsistieron || 0)), 0);
  const asistOk = cerrados.reduce((a, e) => a + (e.asistenciaResumen?.asistieron || 0), 0);
  const promedio = baseAsist ? Math.round((asistOk / baseAsist) * 100) : null;
  const texto = q.trim().toLowerCase();
  const visibles = lista
    .filter((e) => !filtro || e.estado === filtro)
    .filter((e) => !texto || `${e.nombre} ${e.lugar || ""}`.toLowerCase().includes(texto))
    .sort((a, b) => {
      const fa = fechaInputUTC(a.fecha);
      const fb = fechaInputUTC(b.fecha);
      const hoy = hoyLocal();
      const pa = fa < hoy;
      const pb = fb < hoy;
      if (pa !== pb) return pa ? 1 : -1;
      return pa ? fb.localeCompare(fa) : fa.localeCompare(fb);
    });

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
      <div className="flex justify-between items-end gap-4 flex-wrap mb-6">
        <div>
          <p className="m-0 mb-1 text-[11px] font-bold tracking-[0.14em] uppercase text-accent">Panel del personal · Desarrollo Humano</p>
          <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">Talleres y eventos</h1>
          <p className="mt-1 mb-0 text-ink-500">Crea talleres, publícalos y revisa quién se inscribió.</p>
        </div>
        <button type="button" onClick={() => { cerrarFormulario(); formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className={botonPrimario}>
          <Icono nombre="mas" size={16} strokeWidth={2.4} />
          Nuevo evento
        </button>
      </div>

      {mensaje && <div className="mb-4" role="status"><Aviso tono="verde">{mensaje}</Aviso></div>}
      {error && <div className="mb-4 whitespace-pre-line"><Aviso>{error}</Aviso></div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <Kpi titulo="Publicados" valor={publicados.length} detalle="Visibles para los estudiantes" />
        <Kpi titulo="Borradores" valor={borradores.length} detalle="Aún no visibles" />
        <Kpi titulo="Inscritos en eventos abiertos" valor={abiertos} detalle={`de ${cuposAbiertos} cupos`} />
        <Kpi titulo="Asistencia promedio" valor={promedio === null ? "—" : `${promedio} %`} detalle="Eventos cerrados del periodo" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] items-start">
        <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <Segmentos
              etiqueta="Filtrar eventos"
              valor={filtro}
              alCambiar={setFiltro}
              opciones={[["", "Todos"], ["Publicado", "Publicados"], ["Borrador", "Borradores"], ["Cerrado", "Cerrados"]]}
              conteos={{ "": lista.length, Publicado: publicados.length, Borrador: borradores.length, Cerrado: cerrados.length }}
            />
            <label className={`${claseCampo} !w-[240px] inline-flex items-center gap-2 !px-3`}>
              <Icono nombre="buscar" size={16} className="text-ink-500 shrink-0" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar evento" aria-label="Buscar evento" className="w-full bg-transparent outline-none text-[15px]" />
            </label>
          </div>
          {!eventos && !error && <p className="m-0 text-ink-500">Cargando eventos…</p>}
          {eventos && visibles.length === 0 && (
            <div className="py-10 text-center">
              <p className="m-0 font-extrabold text-ink-900">{lista.length === 0 ? "Todavía no hay talleres ni eventos" : "Ningún evento coincide con ese filtro"}</p>
              <p className="m-0 mt-1 text-sm text-ink-500">{lista.length === 0 ? "Crea el primero; puedes guardarlo como borrador y publicarlo cuando esté listo." : "Prueba con otro estado o borra la búsqueda."}</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {visibles.map((e) => (
              <FilaEvento key={e.id} evento={e} ocupado={accionando === e.id} onEstado={cambiarEstado} onEditar={editar} onDuplicar={duplicar} onEliminar={eliminar} />
            ))}
          </div>
        </section>

        <aside ref={formRef} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 xl:sticky xl:top-4">
          <h2 className="m-0 text-lg font-extrabold">{formulario.modo === "editar" ? "Editar evento" : "Nuevo taller o evento"}</h2>
          <p className="mt-1 mb-4 text-sm text-ink-500">Completa lo básico; puedes guardarlo como borrador.</p>
          <Formulario
            key={formulario.clave}
            enVentana
            modo={formulario.modo}
            inicial={formulario.inicial}
            eventos={eventos}
            alCancelar={cerrarFormulario}
            alGuardar={async (textoAviso) => {
              cerrarFormulario();
              await cargarEventos();
              setMensaje(textoAviso);
            }}
          />
        </aside>
      </div>
    </main>
  );
}

function Kpi({ titulo, valor, detalle }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="m-0 text-[13px] text-ink-500">{titulo}</p>
      <p className="mt-1 mb-0 text-[32px] leading-none font-extrabold tabular-nums text-ink-900">{valor}</p>
      {detalle && <p className="mt-2 mb-0 text-xs text-ink-500">{detalle}</p>}
    </div>
  );
}
