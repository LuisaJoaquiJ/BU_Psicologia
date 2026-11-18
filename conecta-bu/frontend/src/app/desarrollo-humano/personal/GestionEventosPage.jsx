import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { fechaInputUTC, fechaLarga, formatearHora, horaInputUTC } from "../comunes/lib/format";
import { imagenDeEvento, respaldoDeFoto, imagenParaEvento, urlDelServidor } from "../comunes/lib/imagenes";
import { Aviso, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";
import { BotonFlotante, Ventana } from "../comunes/componentes/Ventana";

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

// Color del borde izquierdo de cada fila según el estado.
const ESTADO_BORDE = {
  Publicado: "border-l-[#0B6B61]",
  Cerrado: "border-l-amber-400",
  Borrador: "border-l-gray-300",
  Cancelado: "border-l-red-400",
};

// Base común de las acciones: centrado real del texto y feedback al presionar.
const BASE_ACCION =
  "inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 rounded-full text-sm font-bold whitespace-nowrap cursor-pointer transition-all duration-150 active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed";

// Publicar, reabrir y guardar: verde, activan o confirman algo.
const ACCION_ACTIVAR = `${BASE_ACCION} border-[1.5px] border-[#0B6B61] text-[#0B6B61] bg-[#D5EFEA] hover:bg-[#BFE7E0] hover:shadow-sm`;

// Cerrar inscripciones: ámbar, oculta el evento a los estudiantes.
const ACCION_CERRAR = `${BASE_ACCION} border-[1.5px] border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 hover:shadow-sm`;

// Crear algo nuevo: azul sólido, igual que "Agregar horario".
const ACCION_CREAR = `${BASE_ACCION} border-[1.5px] border-primary bg-primary text-white hover:shadow-md`;

// Neutra: ver inscritos, abrir menú, descartar.
const ACCION_NEUTRA = `${BASE_ACCION} border-[1.5px] border-gray-300 text-ink-700 bg-white hover:bg-gray-50 hover:border-gray-400`;

const ACCION_MENU = "text-left min-h-[44px] px-3 rounded-lg font-bold cursor-pointer transition-colors hover:bg-gray-100";

// Estado del evento: solo lectura, gris neutro.
const ETIQUETA_INFO =
  "inline-flex items-center gap-2 text-xs font-bold rounded-full px-3 py-1 bg-gray-100 text-ink-600 border border-gray-200 select-none pointer-events-none";

const PUNTO = "inline-block h-1.5 w-1.5 rounded-full bg-gray-400";

// ---------- Hooks y componentes locales ----------

// Navegación entre pestañas: neutra, no es una acción.
function PestanasVista({ valor, alCambiar, opciones }) {
  return (
    <div role="tablist" className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
      {opciones.map(([id, texto, cantidad]) => {
        const activa = valor === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => alCambiar(id)}
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg px-3.5 text-sm font-bold transition-all duration-150 ${
              activa ? "bg-white text-ink-900 shadow-sm ring-1 ring-gray-200" : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {texto}
            <span className="rounded-full bg-gray-100 px-2 text-xs tabular-nums text-ink-600">{cantidad}</span>
          </button>
        );
      })}
    </div>
  );
}

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
  `inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border-[1.5px] font-bold text-sm cursor-pointer transition-all duration-150 active:translate-y-px ${
    activo
      ? "border-[#19407B] bg-[#EBF2FA] text-[#19407B]"
      : "border-transparent bg-[#F4F6F9] text-ink-600 hover:bg-[#EAEFF5] hover:text-ink-900"
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
      className={`flex gap-7 flex-wrap items-start ${enVentana ? "" : "mb-10"}`}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          guardar(modo === "editar" ? undefined : "Publicado");
        }}
        className="flex-[999_1_540px] min-w-0 bg-white rounded-2xl p-5 sm:p-7 flex flex-col gap-[18px]"
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

        <div className="flex gap-2.5 flex-wrap justify-end pt-1.5 border-t border-gray-100">
          {modo === "editar" ? (
            <button type="button" onClick={() => guardar()} disabled={!!enviando} className={ACCION_ACTIVAR}>
              {enviando ? "Guardando…" : "Guardar cambios"}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => guardar("Borrador")} disabled={!!enviando} className={ACCION_NEUTRA}>
                {enviando === "Borrador" ? "Guardando…" : "Guardar como borrador"}
              </button>
              <button type="button" onClick={() => guardar("Publicado")} disabled={!!enviando} className={ACCION_CREAR}>
                {enviando === "Publicado" ? "Publicando…" : "Publicar ahora"}
              </button>
            </>
          )}
        </div>
      </form>

      {/* Vista previa en vivo */}
      <aside aria-label="Vista previa" className="flex-[1_1_340px] min-w-0 lg:sticky lg:top-4">
        <p className="m-0 mb-2.5 text-sm font-extrabold text-ink-600">Así lo verán los estudiantes</p>
        <article className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-[0_16px_40px_rgba(11,35,71,0.12)]">
          <img src={foto.vista || imagenParaEvento(inicial.id || "nuevo-evento").src} alt="" className="w-full h-[180px] object-cover" />
          <div className="p-5 flex flex-col gap-2">
            <p className="m-0 text-sm font-extrabold text-primary tabular-nums">
              {v.fecha ? `${fechaLarga(v.fecha)} · ${horaTexto(v.horaInicio)} a ${horaTexto(v.horaFin)}` : "Elige una fecha"}
            </p>
            <h3 className="m-0 text-[22px] font-extrabold tracking-tight text-primary-dark">{v.nombre.trim() || "Nombre del evento"}</h3>
            <p className="m-0 text-ink-500">
              {v.modalidad === "Virtual" ? "Virtual" : `${v.lugar || "Lugar por definir"}${v.modalidad === "Hibrida" ? " y virtual" : ""}`} ·{" "}
              <span className="tabular-nums">{v.cupos}</span> cupos
            </p>
            <p className="m-0 text-ink-600 whitespace-pre-line">{v.descripcion.trim() || "Aquí aparecerá la descripción."}</p>
            {limite && <p className="mt-1 mb-0 text-sm text-ink-500">Inscripciones abiertas hasta el {fechaLarga(limite).toLowerCase()}.</p>}
            <span
              aria-hidden="true"
              className="mt-1.5 inline-flex justify-center items-center min-h-[46px] rounded-full boton-liquido font-extrabold pointer-events-none select-none"
            >
              Inscribirme
            </span>
          </div>
        </article>
      </aside>
    </section>
  );
}

// Bloque de fecha tipo calendario: día grande y mes abreviado.
function BloqueFecha({ fecha, pasado }) {
  const iso = fechaInputUTC(fecha);
  const [anio, mes, dia] = iso.split("-").map(Number);
  const nombreMes = new Date(anio, mes - 1, 1).toLocaleDateString("es", { month: "short" }).replace(".", "");
  return (
    <div className={`w-14 shrink-0 rounded-2xl border border-gray-200 bg-white py-1.5 text-center ${pasado ? "opacity-60" : ""}`}>
      <p className="m-0 text-[22px] font-extrabold leading-none text-ink-900 tabular-nums">{dia}</p>
      <p className="m-0 mt-1 text-[11px] font-bold uppercase tracking-wide text-ink-500">{nombreMes}</p>
    </div>
  );
}

function FilaEvento({ evento, ocupado, pasado, onEstado, onEditar, onDuplicar, onEliminar }) {
  const inscritos = evento._count?.inscripciones ?? 0;
  const principal = ACCION_PRINCIPAL[evento.estado];
  const porcentaje = Math.min(100, Math.round((inscritos / Math.max(1, evento.cupos)) * 100));
  const llena = inscritos >= evento.cupos;

  return (
    <li
      className={`border-l-4 ${ESTADO_BORDE[evento.estado] || "border-l-gray-300"} px-5 ${pasado ? "py-3" : "py-4"} flex items-center justify-between flex-wrap gap-x-6 gap-y-3 transition-colors ${
        pasado ? "bg-gray-50/50" : "hover:bg-gray-50/60"
      }`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-[1_1_320px]">
        <BloqueFecha fecha={evento.fecha} pasado={pasado} />

        {!pasado && (
          <img
            src={imagenDeEvento(evento).src}
            alt=""
            onError={respaldoDeFoto(evento)}
            className="hidden md:block w-[72px] h-[56px] object-cover rounded-xl shrink-0"
          />
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className={`text-base ${pasado ? "text-ink-500" : "text-ink-900"}`}>{evento.nombre}</strong>
            <span className={ETIQUETA_INFO}>
              <span className={PUNTO} />
              {evento.estado}
            </span>
          </div>
          <p className="m-0 mt-1 text-sm text-ink-500 tabular-nums">
            {formatearHora(evento.horaInicio)} a {formatearHora(evento.horaFin)}
            {evento.modalidad === "Virtual" ? " · Virtual" : evento.lugar ? ` · ${evento.lugar}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-2.5 max-w-[360px]">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
              <div className={`h-full ${llena ? "bg-[#0B6B61]" : "bg-gray-400"}`} style={{ width: `${porcentaje}%` }} />
            </div>
            <span className="text-[13px] font-semibold text-ink-500 tabular-nums whitespace-nowrap">
              {inscritos}/{evento.cupos} · {porcentaje}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Link to={`/admin/eventos/${evento.id}/inscritos`} className={ACCION_NEUTRA}>
          Inscritos y asistencia
        </Link>
        {!pasado && principal && (
          <button
            onClick={() => onEstado(evento, principal.estado)}
            disabled={ocupado}
            className={principal.estado === "Cerrado" ? ACCION_CERRAR : ACCION_ACTIVAR}
          >
            {principal.label}
          </button>
        )}
        {!pasado && (
          <details className="relative">
            <summary className={`${ACCION_NEUTRA} list-none`}>
              Más
              <Icono nombre="derecha" size={16} strokeWidth={2.2} className="rotate-90" />
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-56 bg-white rounded-2xl border border-gray-200 shadow-[0_16px_40px_rgba(11,35,71,0.18)] p-1.5 flex flex-col">
              {evento.estado !== "Cancelado" && (
                <button onClick={() => onEditar(evento)} className={ACCION_MENU}>
                  Editar
                </button>
              )}
              <button onClick={() => onDuplicar(evento)} className={ACCION_MENU}>
                Duplicar para otra fecha
              </button>
              {evento.estado === "Publicado" && (
                <button onClick={() => onEstado(evento, "Borrador")} className={ACCION_MENU}>
                  Volver a borrador
                </button>
              )}
              {evento.estado !== "Cancelado" && (
                <button onClick={() => onEstado(evento, "Cancelado")} className={ACCION_MENU}>
                  Cancelar evento
                </button>
              )}
              <div className="my-1 border-t border-gray-100" />
              <button onClick={() => onEliminar(evento)} className={`${ACCION_MENU} text-red-700 hover:bg-red-50`}>
                Eliminar
              </button>
            </div>
          </details>
        )}
      </div>
    </li>
  );
}

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function GestionEventosPage() {
  const [params, setParams] = useSearchParams();
  const [eventos, setEventos] = useState(null);
  const [formulario, setFormulario] = useState(params.get("nuevo") ? { modo: "crear", inicial: { ...VACIO } } : null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [accionando, setAccionando] = useState(null);
  const [pestana, setPestana] = useState("proximos");
  const [buscar, setBuscar] = useState("");
  const arriba = useRef(null);

  function cargarEventos() {
    return http
      .get("/admin/eventos")
      .then((res) => setEventos(res.data.eventos))
      .catch(() => setError("No pudimos cargar los eventos. Revisa tu conexión e intenta de nuevo."));
  }

  useEffect(() => {
    cargarEventos();
  }, []);

  function abrir(modo, inicial) {
    setMensaje("");
    setFormulario({ modo, inicial, clave: Date.now() });
  }

  const cerrarFormulario = useCallback(() => {
    setFormulario(null);
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
      // RF-009, flujo alternativo: con inscripciones activas el backend pide confirmación.
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

  const hoy = hoyLocal();
  const todos = eventos || [];
  const proximos = useMemo(
    () => todos.filter((e) => fechaInputUTC(e.fecha) >= hoy).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    [todos, hoy],
  );
  const anteriores = useMemo(
    () => todos.filter((e) => fechaInputUTC(e.fecha) < hoy).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))),
    [todos, hoy],
  );
  const inscritosTotal = todos.reduce((s, e) => s + (e._count?.inscripciones ?? 0), 0);
  const llenos = todos.filter((e) => (e._count?.inscripciones ?? 0) >= e.cupos).length;

  const termino = buscar.trim().toLowerCase();
  const lista = (pestana === "proximos" ? proximos : anteriores).filter((e) => !termino || e.nombre.toLowerCase().includes(termino));
  const pasado = pestana === "anteriores";

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-32" ref={arriba}>
      <header className="mb-7">
        <p className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">Desarrollo Humano · Eventos</p>
        <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold text-ink-900">Talleres y eventos</h1>
        <p className="mt-2 mb-0 text-ink-500 max-w-[46em] leading-relaxed">
          Tus talleres y eventos con sus inscripciones. Para crear uno, usa el botón <strong className="text-ink-900">Nuevo evento</strong>.
        </p>
      </header>

      {mensaje && (
        <div className="mb-5" role="status">
          <Aviso tono="verde">{mensaje}</Aviso>
        </div>
      )}
      {error && (
        <div className="mb-5 whitespace-pre-line">
          <Aviso>{error}</Aviso>
        </div>
      )}

      {formulario && (
        <Ventana titulo={formulario.modo === "editar" ? "Editar evento" : "Nuevo taller o evento"} alCerrar={cerrarFormulario}>
          <Formulario
            key={formulario.clave}
            enVentana
            modo={formulario.modo}
            inicial={formulario.inicial}
            eventos={eventos}
            alCancelar={cerrarFormulario}
            alGuardar={async (texto) => {
              cerrarFormulario();
              await cargarEventos();
              setMensaje(texto);
            }}
          />
        </Ventana>
      )}

      {!formulario && <BotonFlotante onClick={() => abrir("crear", { ...VACIO })}>Nuevo evento</BotonFlotante>}

      {!eventos && !error && <p className="text-ink-500">Cargando eventos…</p>}

      {eventos && eventos.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-14 text-center flex flex-col items-center gap-3">
          <span className="w-16 h-16 rounded-2xl bg-primary-light text-primary flex items-center justify-center">
            <Icono nombre="estrella" size={28} strokeWidth={2} />
          </span>
          <p className="m-0 text-lg font-extrabold text-ink-900">Todavía no hay talleres ni eventos</p>
          <p className="m-0 text-ink-500 max-w-[36em]">Crea el primero; puedes guardarlo como borrador y publicarlo cuando esté listo.</p>
          <button type="button" onClick={() => abrir("crear", { ...VACIO })} className={`${ACCION_CREAR} mt-2`}>
            Nuevo evento
          </button>
        </div>
      )}

      {eventos && eventos.length > 0 && (
        <>
          {/* Resumen */}
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            {[
              ["Próximos", proximos.length, "eventos por venir"],
              ["Inscritos", inscritosTotal, "en todos los eventos"],
              ["Llenos", llenos, "sin cupos disponibles"],
            ].map(([titulo, n, sub]) => (
              <div key={titulo} className="rounded-2xl bg-white/70 backdrop-blur border border-white/80 shadow-sm px-5 py-4">
                <p className="m-0 text-xs font-bold uppercase tracking-wide text-ink-500">{titulo}</p>
                <p className="m-0 mt-1 text-3xl font-extrabold text-ink-900 tabular-nums">{n}</p>
                <p className="m-0 text-sm text-ink-500">{sub}</p>
              </div>
            ))}
          </div>

          {/* Pestañas y buscador */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 bg-white/60 backdrop-blur rounded-2xl border border-white/80 shadow-sm px-3 py-2.5">
            <PestanasVista
              valor={pestana}
              alCambiar={setPestana}
              opciones={[
                ["proximos", "Próximos", proximos.length],
                ["anteriores", "Anteriores", anteriores.length],
              ]}
            />
            <input
              type="search"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar evento"
              aria-label="Buscar evento"
              className={`${claseCampo} w-[240px] max-w-full rounded-full`}
            />
          </div>

          {lista.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-10 text-center">
              <p className="m-0 text-lg font-extrabold text-ink-900">
                {termino ? "Ningún evento coincide con la búsqueda" : pasado ? "No hay eventos anteriores" : "No hay eventos próximos"}
              </p>
              {termino && (
                <button type="button" onClick={() => setBuscar("")} className={`${ACCION_NEUTRA} mt-3`}>
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <ul
               className="list-none m-0 p-0 bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100"
            >
              {lista.map((e) => (
                <FilaEvento
                  key={e.id}
                  evento={e}
                  pasado={pasado}
                  ocupado={accionando === e.id}
                  onEstado={cambiarEstado}
                  onEditar={editar}
                  onDuplicar={duplicar}
                  onEliminar={eliminar}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}