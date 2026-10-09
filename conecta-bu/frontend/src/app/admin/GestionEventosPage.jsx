import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { fechaInputUTC, fechaLarga, formatearHora, horaInputUTC } from "../../lib/format";
import { imagenDeEvento, respaldoDeFoto, imagenParaEvento, urlDelServidor } from "../../lib/imagenes";
import { Aviso, Estado, Vacio, botonPrimario, botonSecundario, claseCampo } from "../../components/ui";
import { Icono } from "../../components/Iconos";
import { BotonFlotante, Ventana } from "../../components/Ventana";

// RF-009: talleres y eventos de Desarrollo Humano. Un solo formulario sirve
// para crear, duplicar y editar, con vista previa en vivo de cómo lo verán
// los estudiantes. Desde cada evento se va a inscritos y asistencia (RF-011).

const VACIO = {
  nombre: "",
  descripcion: "",
  lugar: "",
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
  const lim = limiteDe(v);
  if (v.cierre === "otra" && !lim) e.limite = "Elige hasta cuándo hay inscripciones.";
  else if (lim && v.fecha && lim > v.fecha) e.limite = "Las inscripciones no pueden cerrar después del evento.";
  return e;
}

const chip = (activo) =>
  `min-h-[44px] px-4 rounded-full border-[1.5px] font-extrabold transition-colors ${
    activo ? "border-primary bg-primary text-white" : "border-[#D3DBE8] bg-white text-primary hover:border-primary"
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
      lugar: v.lugar,
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
        className="flex-[999_1_540px] min-w-0 bg-white rounded-[18px] p-5 sm:p-7 flex flex-col gap-[18px]"
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

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 font-extrabold">
            Lugar
            <input value={v.lugar} onChange={set("lugar")} list="lugares-eventos" placeholder="Ej.: Auditorio Sede Norte" className={claseCampo} />
            <datalist id="lugares-eventos">
              {lugares.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </label>
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

        <div className="flex gap-2.5 flex-wrap justify-end pt-1.5 border-t border-[#EEF2F7]">
          {modo === "editar" ? (
            <button type="button" onClick={() => guardar()} disabled={!!enviando} className={botonPrimario}>
              {enviando ? "Guardando…" : "Guardar cambios"}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => guardar("Borrador")} disabled={!!enviando} className={botonSecundario}>
                {enviando === "Borrador" ? "Guardando…" : "Guardar como borrador"}
              </button>
              <button type="button" onClick={() => guardar("Publicado")} disabled={!!enviando} className={botonPrimario}>
                {enviando === "Publicado" ? "Publicando…" : "Publicar ahora"}
              </button>
            </>
          )}
        </div>
      </form>

      {/* Vista previa en vivo */}
      <aside aria-label="Vista previa" className="flex-[1_1_340px] min-w-0 lg:sticky lg:top-4">
        <p className="m-0 mb-2.5 text-sm font-extrabold text-ink-600">Así lo verán los estudiantes</p>
        <article className="bg-white rounded-[18px] overflow-hidden shadow-[0_16px_40px_rgba(11,35,71,0.12)]">
          <img src={foto.vista || imagenParaEvento(inicial.id || "nuevo-evento").src} alt="" className="w-full h-[180px] object-cover" />
          <div className="p-5 flex flex-col gap-2">
            <p className="m-0 text-sm font-extrabold text-primary tabular-nums">
              {v.fecha ? `${fechaLarga(v.fecha)} · ${horaTexto(v.horaInicio)} a ${horaTexto(v.horaFin)}` : "Elige una fecha"}
            </p>
            <h3 className="m-0 text-[22px] font-extrabold tracking-tight text-primary-dark">{v.nombre.trim() || "Nombre del evento"}</h3>
            <p className="m-0 text-ink-500">
              {v.lugar || "Lugar por definir"} · <span className="tabular-nums">{v.cupos}</span> cupos
            </p>
            <p className="m-0 text-ink-600 whitespace-pre-line">{v.descripcion.trim() || "Aquí aparecerá la descripción."}</p>
            {limite && <p className="mt-1 mb-0 text-sm text-ink-500">Inscripciones abiertas hasta el {fechaLarga(limite).toLowerCase()}.</p>}
            <span className="mt-1.5 inline-flex justify-center items-center min-h-[46px] rounded-full bg-primary text-white font-extrabold">Inscribirme</span>
          </div>
        </article>
      </aside>
    </section>
  );
}

function FilaEvento({ evento, ocupado, onEstado, onEditar, onDuplicar, onEliminar }) {
  const inscritos = evento._count?.inscripciones ?? 0;
  const principal = ACCION_PRINCIPAL[evento.estado];
  const porcentaje = Math.min(100, Math.round((inscritos / Math.max(1, evento.cupos)) * 100));
  return (
    <li className="px-5 py-4 flex items-center justify-between flex-wrap gap-x-6 gap-y-3">
      <img src={imagenDeEvento(evento).src} alt="" onError={respaldoDeFoto(evento)} className="hidden sm:block w-[88px] h-[64px] object-cover rounded-xl shrink-0" />
      <div className="min-w-0 flex-[1_1_320px]">
        <div className="flex items-center gap-2 flex-wrap">
          <strong className="text-ink-900">{evento.nombre}</strong>
          <Estado estado={evento.estado} />
        </div>
        <p className="m-0 text-sm text-ink-500 tabular-nums">
          {fechaLarga(evento.fecha)} · {formatearHora(evento.horaInicio)} a {formatearHora(evento.horaFin)}
          {evento.lugar ? ` · ${evento.lugar}` : ""}
        </p>
        <div className="mt-2 flex items-center gap-2.5 max-w-[360px]">
          <div className="flex-1 h-1.5 rounded-full bg-primary-light overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${porcentaje}%` }} />
          </div>
          <span className="text-[13px] font-bold text-ink-600 tabular-nums whitespace-nowrap">
            {inscritos} de {evento.cupos} inscritos
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={`/admin/eventos/${evento.id}/inscritos`} className={botonSecundario}>
          Inscritos y asistencia
        </Link>
        {principal && (
          <button onClick={() => onEstado(evento, principal.estado)} disabled={ocupado} className={botonPrimario}>
            {principal.label}
          </button>
        )}
        <details className="relative">
          <summary className="list-none cursor-pointer inline-flex items-center gap-1 min-h-[44px] px-3.5 rounded-full font-bold text-primary hover:bg-primary-light">
            Más
            <Icono nombre="derecha" size={16} strokeWidth={2.2} className="rotate-90" />
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-56 bg-white rounded-xl shadow-[0_16px_40px_rgba(11,35,71,0.18)] p-1.5 flex flex-col">
            {evento.estado !== "Cancelado" && (
              <button onClick={() => onEditar(evento)} className="text-left min-h-[44px] px-3 rounded-lg font-bold hover:bg-cream">
                Editar
              </button>
            )}
            <button onClick={() => onDuplicar(evento)} className="text-left min-h-[44px] px-3 rounded-lg font-bold hover:bg-cream">
              Duplicar para otra fecha
            </button>
            {evento.estado === "Publicado" && (
              <button onClick={() => onEstado(evento, "Borrador")} className="text-left min-h-[44px] px-3 rounded-lg font-bold hover:bg-cream">
                Volver a borrador
              </button>
            )}
            {evento.estado !== "Cancelado" && (
              <button onClick={() => onEstado(evento, "Cancelado")} className="text-left min-h-[44px] px-3 rounded-lg font-bold hover:bg-cream">
                Cancelar evento
              </button>
            )}
            <button onClick={() => onEliminar(evento)} className="text-left min-h-[44px] px-3 rounded-lg font-bold text-red-700 hover:bg-red-50">
              Eliminar
            </button>
          </div>
        </details>
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

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-32" ref={arriba}>
      <div className="flex justify-between items-end gap-4 flex-wrap mb-6">
        <div>
          <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">Talleres y eventos</h1>
          <p className="mt-1 mb-0 text-ink-500">
            Tus talleres y eventos con sus inscripciones. Para crear uno, usa el botón <strong className="text-ink-700">Nuevo evento</strong>.
          </p>
        </div>
      </div>

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
        <div className="bg-white rounded-[22px] border border-gray-200 px-6 py-12 text-center flex flex-col items-center gap-3">
          <span className="w-14 h-14 rounded-2xl bg-primary-light text-primary flex items-center justify-center">
            <Icono nombre="estrella" size={28} strokeWidth={2} />
          </span>
          <p className="m-0 text-lg font-extrabold text-ink-900">Todavía no hay talleres ni eventos</p>
          <p className="m-0 text-ink-500 max-w-[36em]">Crea el primero; puedes guardarlo como borrador y publicarlo cuando esté listo.</p>
          <button type="button" onClick={() => abrir("crear", { ...VACIO })} className={`${botonPrimario} mt-2`}>
            Nuevo evento
          </button>
        </div>
      )}
      {eventos &&
        eventos.length > 0 &&
        [
          ["Próximos", eventos.filter((e) => fechaInputUTC(e.fecha) >= hoyLocal()).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))],
          ["Anteriores", eventos.filter((e) => fechaInputUTC(e.fecha) < hoyLocal()).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))],
        ].map(([titulo, lista]) =>
          lista.length ? (
            <section key={titulo} aria-label={titulo} className="mb-8">
              <h2 className="m-0 mb-3 text-xl font-extrabold">
                {titulo} <span className="text-base font-semibold text-ink-500">({lista.length})</span>
              </h2>
              <ul className="list-none m-0 p-0 bg-white rounded-[18px] border border-gray-200 divide-y divide-[#EEF2F7]">
                {lista.map((e) => (
                  <FilaEvento
                    key={e.id}
                    evento={e}
                    ocupado={accionando === e.id}
                    onEstado={cambiarEstado}
                    onEditar={editar}
                    onDuplicar={duplicar}
                    onEliminar={eliminar}
                  />
                ))}
              </ul>
            </section>
          ) : null,
        )}
    </main>
  );
}
