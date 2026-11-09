import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { hoyISO, mensajeError } from "../comun/formato";
import { Icono } from "../comunes/componentes/Iconos";
import { useConfirmar } from "../comunes/componentes/Confirmar";
import { ROLES_EQUIPO } from "./rol";
import { Segmentos } from "../comunes/componentes/ui";
import { InformeGestionCultura } from "./InformeGestionCultura";
import { Aviso, BuscarPersona, Desplegable, Filtros, Marco, SinResultados, campo, coincide, opcionesDe, useVentana } from "./Marco";

export function RedesPersonal() {
  const nuevo = useVentana();
  const [buscar, setBuscar] = useState("");
  const [red, setRed] = useState("");
  const [anio, setAnio] = useState("");
  const [premio, setPremio] = useState("");
  const limpiar = () => {
    setBuscar("");
    setRed("");
    setAnio("");
    setPremio("");
    setOficio("");
  };
  const [lista, setLista] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [delegacion, setDelegacion] = useState([]);
  const [form, setForm] = useState({ red: "ASIES", nombre: "", modalidad: "", fecha: "", grupoId: "", posicion: "" });
  function cargar() {
    http.get("/cultura/admin/representaciones").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar las representaciones."));
    http.get("/cultura/admin/grupos").then((r) => setGrupos(r.data)).catch(() => {});
  }
  useEffect(cargar, []);
  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/representaciones", { ...form, participantes: delegacion.map((p) => p.usuarioId) });
      setAviso(`Quedó registrada la delegación a ${form.nombre}.`);
      nuevo.cerrar();
      setForm({ ...form, nombre: "", modalidad: "", posicion: "" });
      setDelegacion([]);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar la representación."));
    }
  }
  // El oficio de invitacion (o cualquier soporte) queda pegado a la delegacion.
  async function adjuntarOficio(f, archivo) {
    if (!archivo) return;
    const datos = new FormData();
    datos.append("evidencia", archivo);
    datos.append("representacionId", f.id);
    datos.append("tipo", "oficio");
    setError("");
    try {
      await http.post("/cultura/admin/evidencias", datos);
      setAviso(`Quedó el oficio de ${f.nombre}.`);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible subir el oficio."));
    }
  }
  async function abrirDocumento(d) {
    setError("");
    const ventana = window.open("", "_blank");
    try {
      const r = await http.get(`/cultura/admin/evidencias/${d.id}/archivo`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      if (ventana) ventana.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      if (ventana) ventana.close();
      setError(mensajeError(err, "No fue posible abrir el documento."));
    }
  }
  const [oficio, setOficio] = useState("");
  const visibles = lista.filter(
    (f) =>
      coincide(buscar, f.nombre, f.modalidad, f.grupo, f.posicion, ...f.participantes.map((p) => p.nombre)) &&
      (!oficio || (oficio === "con" ? f.documentos?.length : !f.documentos?.length)) &&
      (!red || f.red === red) &&
      (!anio || String(f.fecha).startsWith(anio)) &&
      (!premio || (premio === "si" ? f.posicion : !f.posicion))
  );
  return (
    <Marco titulo="Redes ASIES y ASCUN" texto="Vincula la delegación a la convocatoria y deja el reconocimiento obtenido. El histórico queda por estudiante y por grupo.">
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <Desplegable titulo="Registrar una invitación o delegación" boton="Nueva delegación" control={nuevo} error={error}>
      <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Red
          <select className={`${campo} w-full mt-1`} value={form.red} onChange={(e) => setForm({ ...form, red: e.target.value })}>
            <option>ASIES</option>
            <option>ASCUN</option>
          </select>
        </label>
        <label className="text-sm font-semibold">Convocatoria<input className={`${campo} w-full mt-1`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Modalidad<input className={`${campo} w-full mt-1`} placeholder="Canción inédita, solista, oralidad" value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value })} /></label>
        <label className="text-sm font-semibold">Fecha<input type="date" className={`${campo} w-full mt-1`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Grupo
          <select className={`${campo} w-full mt-1`} value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })}>
            <option value="">Sin grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Reconocimiento<input className={`${campo} w-full mt-1`} placeholder="Ej. 3.er lugar en intérprete solista" value={form.posicion} onChange={(e) => setForm({ ...form, posicion: e.target.value })} /></label>
        <div className="sm:col-span-2 flex flex-col gap-2">
          <BuscarPersona etiqueta="Agrega a quienes van (nombre, correo o cédula)" alElegir={(p) => setDelegacion((l) => (l.some((x) => x.usuarioId === p.usuarioId) ? l : [...l, p]))} />
          {delegacion.length > 0 && (
            <ul className="list-none m-0 p-0 flex flex-wrap gap-2">
              {delegacion.map((p) => (
                <li key={p.usuarioId} className="burbuja rounded-full pl-3 pr-1 py-1 text-sm inline-flex items-center gap-2">
                  {p.nombre}
                  <button type="button" aria-label={`Quitar a ${p.nombre}`} onClick={() => setDelegacion((l) => l.filter((x) => x.usuarioId !== p.usuarioId))} className="w-8 h-8 rounded-full hover:bg-white">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button disabled={!delegacion.length} className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit disabled:opacity-60">Registrar delegación</button>
      </form>
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar delegación"
        selectores={[{ etiqueta: "Año", valor: anio, alCambiar: setAnio, opciones: [["", "Todos"], ...opcionesDe(lista, (f) => String(f.fecha).slice(0, 4)).reverse().map((a) => [a, a])] }]}
        pastillas={[
          { etiqueta: "Red", valor: red, alCambiar: setRed, opciones: [["", "Todas"], ["ASIES", "ASIES"], ["ASCUN", "ASCUN"]] },
          { etiqueta: "Reconocimiento", valor: premio, alCambiar: setPremio, opciones: [["", "Todos"], ["si", "Con"], ["no", "Sin"]] },
          { etiqueta: "Oficio", valor: oficio, alCambiar: setOficio, opciones: [["", "Todos"], ["con", "Con"], ["sin", "Sin"]] },
        ]}
        total={lista.length}
        visibles={visibles.length}
        alLimpiar={limpiar}
      />
      <ul className="list-none m-0 p-0 grid gap-2">
        {visibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="Todavía no hay delegaciones registradas." alLimpiar={limpiar} />}
        {visibles.map((f) => (
          <li key={f.id} className="vidrio-panel rounded-[22px] px-4 py-3">
            <strong>{f.red} · {f.nombre}</strong>
            <p className="m-0 text-sm text-ink-500">{f.fecha}{f.modalidad ? ` · ${f.modalidad}` : ""}{f.grupo ? ` · ${f.grupo}` : ""}{f.posicion ? ` · ${f.posicion}` : ""}</p>
            <p className="m-0 text-sm">{f.participantes.map((p) => p.nombre).join(", ")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(f.documentos || []).map((d) => (
                <button key={d.id} type="button" onClick={() => abrirDocumento(d)} className="min-h-[38px] max-w-full px-3 rounded-full bg-white/80 text-sm font-semibold text-primary-dark hover:bg-white inline-flex items-center gap-1.5">
                  <Icono nombre="archivo" size={15} strokeWidth={2} />
                  <span className="truncate">{d.tipo === "oficio" ? "Oficio" : "Soporte"}: {d.nombreOriginal}</span>
                </button>
              ))}
              <label className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm cursor-pointer">
                <Icono nombre="subir" size={15} strokeWidth={2} />
                {f.documentos?.length ? "Agregar otro oficio" : "Adjuntar oficio"}
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { adjuntarOficio(f, e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
          </li>
        ))}
      </ul>
    </Marco>
  );
}

// Foto privada (evidencia): se pide con la sesion y se muestra como blob.
function FotoPrivada({ id, alt = "", className = "" }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let vigente = true;
    let creada = "";
    http
      .get(`/cultura/admin/evidencias/${id}/archivo`, { responseType: "blob" })
      .then((r) => {
        creada = URL.createObjectURL(r.data);
        if (vigente) setUrl(creada);
      })
      .catch(() => {});
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [id]);
  return url ? <img src={url} alt={alt} className={`object-cover ${className}`} /> : <span aria-hidden="true" className={`block bg-primary-light animate-pulse ${className}`} />;
}

// Portada grande y miniaturas: tocar una miniatura la pone en grande.
function FotosPausa({ pausa }) {
  const [elegida, setElegida] = useState(0);
  const fotos = pausa.fotos || [];
  if (!fotos.length) {
    return (
      <div className="shrink-0 w-full sm:w-[220px] h-[150px] rounded-[18px] bg-primary-light/70 border border-dashed border-primary/30 flex flex-col items-center justify-center gap-1 text-primary text-center px-4">
        <Icono nombre="imagen" size={28} strokeWidth={1.8} />
        <span className="text-xs font-bold">Sin fotos todavía</span>
        <span className="text-[11px] text-ink-500">Súbelas como evidencia de la pausa</span>
      </div>
    );
  }
  const portada = fotos[Math.min(elegida, fotos.length - 1)];
  return (
    <div className="shrink-0 w-full sm:w-[220px] flex flex-col gap-2">
      <FotoPrivada key={portada.id} id={portada.id} alt={`Foto de la pausa ${pausa.tecnica}`} className="w-full h-[150px] rounded-[18px]" />
      {fotos.length > 1 && (
        <ul className="list-none m-0 p-0 flex gap-1.5 flex-wrap">
          {fotos.slice(0, 5).map((f, i) => (
            <li key={f.id}>
              <button type="button" onClick={() => setElegida(i)} aria-label={`Ver foto ${i + 1}`} aria-pressed={i === elegida} className={`block rounded-lg overflow-hidden ring-2 ${i === elegida ? "ring-primary" : "ring-transparent hover:ring-primary/40"}`}>
                <FotoPrivada id={f.id} className="w-10 h-10" />
              </button>
            </li>
          ))}
          {fotos.length > 5 && <li className="w-10 h-10 rounded-lg bg-white/80 text-xs font-bold text-ink-600 grid place-items-center">+{fotos.length - 5}</li>}
        </ul>
      )}
    </div>
  );
}

export function ItinerantePersonal() {
  const nuevo = useVentana();
  const [buscar, setBuscar] = useState("");
  const [mes, setMes] = useState("");
  const [foto, setFoto] = useState("");
  const limpiar = () => {
    setBuscar("");
    setMes("");
    setFoto("");
  };
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [form, setForm] = useState({ fecha: "", horaInicio: "10:00", horaFin: "11:00", lugar: "", tecnica: "", impactoEstimado: 0 });
  function cargar() {
    http.get("/cultura/admin/pausas").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar las pausas."));
  }
  useEffect(cargar, []);
  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/pausas", { ...form, impactoEstimado: Number(form.impactoEstimado) });
      setAviso("Quedó registrada la pausa. Cuenta en el SNIES como estudiantes.");
      nuevo.cerrar();
      setForm({ ...form, fecha: "", lugar: "", tecnica: "", impactoEstimado: 0 });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar la pausa."));
    }
  }
  const visibles = lista.filter(
    (p) => coincide(buscar, p.tecnica, p.lugar) && (!mes || String(p.fecha).startsWith(mes)) && (!foto || (foto === "con" ? p.evidencias > 0 : p.evidencias === 0))
  );
  const impacto = visibles.reduce((n, p) => n + (p.impactoEstimado || 0), 0);
  return (
    <Marco titulo="Arte itinerante" texto="Registra la pausa creativa con la fecha, el lugar, la técnica y cuántas personas se estima que participaron. La foto queda como evidencia.">
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <Desplegable titulo="Registrar una pausa creativa" boton="Nueva pausa" control={nuevo} error={error}>
      <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Fecha<input type="date" className={`${campo} w-full mt-1`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></label>
        <div className="flex gap-2">
          <label className="text-sm font-semibold flex-1">Inicio<input type="time" className={`${campo} w-full mt-1`} value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} required /></label>
          <label className="text-sm font-semibold flex-1">Fin<input type="time" min={form.horaInicio} className={`${campo} w-full mt-1`} value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} required /></label>
        </div>
        <label className="text-sm font-semibold">Lugar<input className={`${campo} w-full mt-1`} placeholder="Cafetería" value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Técnica<input className={`${campo} w-full mt-1`} placeholder="Origami" value={form.tecnica} onChange={(e) => setForm({ ...form, tecnica: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Estudiantes impactados<input type="number" min="0" className={`${campo} w-full mt-1`} value={form.impactoEstimado} onChange={(e) => setForm({ ...form, impactoEstimado: e.target.value })} required /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Registrar pausa</button>
      </form>
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar pausa"
        selectores={[{ etiqueta: "Mes", valor: mes, alCambiar: setMes, opciones: [["", "Todos"], ...opcionesDe(lista, (p) => String(p.fecha).slice(0, 7)).reverse().map((m) => [m, m])] }]}
        pastillas={[{ etiqueta: "Fotos", valor: foto, alCambiar: setFoto, opciones: [["", "Todas"], ["con", "Con"], ["sin", "Sin"]] }]}
        total={lista.length}
        visibles={visibles.length}
        alLimpiar={limpiar}
      />
      <ul className="list-none m-0 p-0 grid gap-2">
        {visibles.length > 0 && (
          <li className="text-sm text-ink-500 px-1">
            Estas pausas llegaron a <strong className="text-ink-900 tabular-nums">{impacto}</strong> personas.
          </li>
        )}
        {visibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="Todavía no hay pausas creativas registradas." alLimpiar={limpiar} />}
        {visibles.map((p) => (
          <li key={p.id} className="vidrio-panel rounded-[22px] p-4 flex flex-col sm:flex-row gap-4">
            <FotosPausa pausa={p} />
            <div className="min-w-0 flex-1 flex flex-col gap-1">
            <strong className="text-lg">{p.tecnica}</strong>
            <p className="m-0 text-sm text-ink-500">
              {p.fecha}
              {p.horaInicio ? ` · ${p.horaInicio}–${p.horaFin}` : ""} · {p.lugar}
            </p>
            <p className="m-0 text-sm">
              <strong className="tabular-nums">{p.impactoEstimado}</strong> personas · {p.fotos?.length || 0} {(p.fotos?.length || 0) === 1 ? "foto" : "fotos"}
            </p>
            <label className="mt-2 self-start inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm cursor-pointer">
              <Icono nombre="subir" size={15} strokeWidth={2} />
              {p.fotos?.length ? "Agregar otra foto" : "Subir foto"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={async (e) => {
                const archivo = e.target.files?.[0];
                if (!archivo) return;
                const datos = new FormData();
                datos.append("evidencia", archivo);
                datos.append("pausaId", p.id);
                datos.append("tipo", "fotografia");
                setError("");
                try {
                  await http.post("/cultura/admin/evidencias", datos);
                  setAviso("Quedó la foto de la pausa.");
                  cargar();
                } catch (err) {
                  setError(mensajeError(err, "No fue posible subir la foto."));
                }
              }}
            />
            </label>
            </div>
          </li>
        ))}
      </ul>
    </Marco>
  );
}

export function ApoyoPersonal() {
  const nuevo = useVentana();
  const [buscar, setBuscar] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [cuando, setCuando] = useState("");
  const limpiar = () => {
    setBuscar("");
    setEstadoFiltro("");
    setCuando("");
  };
  const [lista, setLista] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ lugarDestino: "", fecha: "", hora: "09:00", grupoId: "", detalle: "", personalAsignado: "" });
  function cargar() {
    http.get("/cultura/admin/apoyo").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar las solicitudes."));
    http.get("/cultura/admin/grupos").then((r) => setGrupos(r.data)).catch(() => {});
  }
  useEffect(cargar, []);
  async function actualizar(s, cambios) {
    setError("");
    try {
      await http.patch(`/cultura/admin/apoyo/${s.id}`, cambios);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible actualizar la solicitud."));
    }
  }
  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/apoyo", form);
      nuevo.cerrar();
      setForm({ ...form, lugarDestino: "", detalle: "", personalAsignado: "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar la solicitud."));
    }
  }
  const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const visibles = lista.filter(
    (s) =>
      coincide(buscar, s.lugarDestino, s.grupo, s.personalAsignado, s.detalle) &&
      (!estadoFiltro || s.estado === estadoFiltro) &&
      (!cuando || (cuando === "proximas" ? s.fecha >= hoy : s.fecha < hoy))
  );
  return (
    <Marco titulo="Apoyo a promoción" texto="Colegio o feria, fecha, hora y grupo. Después queda el personal que asistió: docentes, monitores o el grupo.">
      {error && <Aviso>{error}</Aviso>}
      <Desplegable titulo="Registrar una solicitud (por ejemplo, de Mercadeo)" boton="Nueva solicitud" control={nuevo} error={error}>
      <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Destino<input className={`${campo} w-full mt-1`} value={form.lugarDestino} onChange={(e) => setForm({ ...form, lugarDestino: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Fecha<input type="date" className={`${campo} w-full mt-1`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Hora<input type="time" className={`${campo} w-full mt-1`} value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Grupo
          <select className={`${campo} w-full mt-1`} value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })}>
            <option value="">Sin grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">Detalle<textarea className={`${campo} w-full mt-1`} value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Personal que asiste<input className={`${campo} w-full mt-1`} value={form.personalAsignado} onChange={(e) => setForm({ ...form, personalAsignado: e.target.value })} /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Registrar solicitud</button>
      </form>
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar solicitud"
        pastillas={[
          { etiqueta: "Estado", valor: estadoFiltro, alCambiar: setEstadoFiltro, opciones: [["", "Todas"], ["Recibida", "Recibidas"], ["Programada", "Programadas"], ["Realizada", "Realizadas"]] },
          { etiqueta: "Cuándo", valor: cuando, alCambiar: setCuando, opciones: [["", "Todas"], ["proximas", "Próximas"], ["pasadas", "Pasadas"]] },
        ]}
        total={lista.length}
        visibles={visibles.length}
        alLimpiar={limpiar}
      />
      <ul className="list-none m-0 p-0 grid gap-2">
        {visibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="Todavía no hay solicitudes de apoyo." alLimpiar={limpiar} />}
        {visibles.map((s) => (
          <li key={s.id} className="vidrio-panel rounded-[22px] px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
            <span>
              <strong>{s.lugarDestino}</strong> · {s.fecha} · {s.hora} · {s.grupo || "sin grupo"}
              {s.personalAsignado && <span className="block text-ink-500">Personal: {s.personalAsignado}</span>}
            </span>
            <select aria-label={`Estado de ${s.lugarDestino}`} className={campo} value={s.estado} onChange={(e) => actualizar(s, { estado: e.target.value })}>
              <option>Recibida</option>
              <option>Programada</option>
              <option>Realizada</option>
            </select>
          </li>
        ))}
      </ul>
    </Marco>
  );
}

const hoyTexto = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
// Rangos de un toque: el mes, el mes pasado, el semestre y el ano.
function rangos() {
  const hoy = hoyTexto();
  const [a, m] = hoy.split("-").map(Number);
  const fin = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  const mm = (n) => String(n).padStart(2, "0");
  const anterior = m === 1 ? [a - 1, 12] : [a, m - 1];
  return [
    ["Este mes", `${a}-${mm(m)}-01`, hoy],
    ["Mes pasado", `${anterior[0]}-${mm(anterior[1])}-01`, fin(anterior[0], anterior[1])],
    ["Este semestre", m <= 6 ? `${a}-01-01` : `${a}-07-01`, hoy],
    ["Este año", `${a}-01-01`, hoy],
    ["Año pasado", `${a - 1}-01-01`, `${a - 1}-12-31`],
  ];
}

function ReportesSnies() {
  const [programa, setPrograma] = useState("");
  const [desde, setDesde] = useState(rangos()[3][1]);
  const [hasta, setHasta] = useState(hoyTexto());
  const [programas, setProgramas] = useState([]);
  const [lista, setLista] = useState(null);
  const [inclusion, setInclusion] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    http.get("/cultura/admin/programas").then((r) => setProgramas(r.data)).catch(() => {});
  }, []);

  // Se consulta solo al cambiar el filtro: no hace falta un boton.
  useEffect(() => {
    const espera = setTimeout(async () => {
      setError("");
      try {
        const params = { programa, desde, hasta };
        const [personas, poblacion] = await Promise.all([http.get("/cultura/admin/registro-calificado", { params }), http.get("/cultura/admin/inclusion", { params })]);
        setLista(personas.data);
        setInclusion(poblacion.data);
      } catch (err) {
        setError(mensajeError(err, "No fue posible consultar."));
      }
    }, 300);
    return () => clearTimeout(espera);
  }, [programa, desde, hasta]);

  async function descargar(formato) {
    try {
      const r = await http.get("/cultura/admin/informe", { params: { desde, hasta, formato }, responseType: formato === "csv" ? "text" : "blob" });
      const blob = formato === "csv" ? new Blob([r.data], { type: "text/csv" }) : r.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SNIES-cultura-${desde}-a-${hasta}.${formato}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No fue posible descargar el informe.");
    }
  }

  const total = lista?.length || 0;
  return (
    <>
      <p className="mt-0 mb-5 text-ink-500 max-w-[760px]">Elige el periodo y, si te lo piden, un programa. El Excel SNIES trae una hoja con el código de la actividad, la cédula del responsable, el código del tipo de persona (1 estudiante, 2 docente, 3 administrativo, 4 egresado) y la cantidad de personas sin repetir.</p>
      {error && <Aviso>{error}</Aviso>}
      <section className="mb-6 flex flex-col gap-3">
        <Segmentos
          className="self-start"
          etiqueta="Rango de fechas"
          opciones={rangos().map(([n]) => [n, n])}
          valor={(rangos().find(([, d, h]) => desde === d && hasta === h) || [])[0]}
          alCambiar={(n) => {
            const [, d, h] = rangos().find(([x]) => x === n);
            setDesde(d);
            setHasta(h);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold inline-flex items-center gap-2">Desde<input type="date" className="min-h-[42px] rounded-full bg-white/90 border border-white px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-[0_4px_14px_-8px_rgba(11,35,71,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 w-[160px]" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="text-sm font-semibold inline-flex items-center gap-2">Hasta<input type="date" className="min-h-[42px] rounded-full bg-white/90 border border-white px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-[0_4px_14px_-8px_rgba(11,35,71,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 w-[160px]" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          <label className="text-sm font-semibold inline-flex items-center gap-2">
            Programa
            <input list="programas-cultura" className="min-h-[42px] rounded-full bg-white/90 border border-white px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-[0_4px_14px_-8px_rgba(11,35,71,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 w-[200px]" value={programa} onChange={(e) => setPrograma(e.target.value)} placeholder="Todos" />
            <datalist id="programas-cultura">
              {programas.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => descargar("xlsx")} className="boton-liquido min-h-[44px] px-5 rounded-full font-bold">Descargar Excel SNIES</button>
          <button type="button" onClick={() => descargar("csv")} className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold">Descargar CSV</button>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="vidrio-panel rounded-[22px] p-5">
          <p className="m-0 text-sm text-ink-500">{programa ? `Personas de ${programa}` : "Personas que participaron"}</p>
          <p className="m-0 mt-1 text-[36px] font-semibold tabular-nums">{lista ? total : "…"}</p>
          <p className="m-0 text-sm text-ink-500">Talleres, grupos, eventos y delegaciones, sin repetir</p>
        </div>
        <div className="vidrio-panel rounded-[22px] p-5">
          <p className="m-0 text-sm text-ink-500">Caracterización</p>
          {inclusion.length ? (
            <ul className="list-none m-0 mt-2 p-0 flex flex-wrap gap-1.5">
              {inclusion.map((f) => (
                <li key={f.caracterizacion} className="burbuja rounded-full px-3 py-1 text-sm">{f.caracterizacion}: <strong>{f.personas}</strong></li>
              ))}
            </ul>
          ) : (
            <p className="m-0 mt-2 text-sm text-ink-500">Sin datos en este periodo.</p>
          )}
        </div>
      </div>
      {lista && lista.length > 0 && (
        <div className="vidrio-panel rounded-[22px] p-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="px-3 py-2 font-semibold">Nombre</th>
                <th className="px-3 py-2 font-semibold">Programa</th>
                <th className="px-3 py-2 font-semibold text-right">Asistencias</th>
                <th className="px-3 py-2 font-semibold">Caracterización</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.usuarioId} className="border-t border-white/80">
                  <td className="px-3 py-2">{p.nombre}<span className="block text-ink-500">{p.email}</span></td>
                  <td className="px-3 py-2">{p.programa}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.asistencias}</td>
                  <td className="px-3 py-2">{p.caracterizacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lista && lista.length === 0 && <p className="text-ink-500">No hay participación registrada con este filtro.</p>}
    </>
  );
}

// Datos de otros anos (2023 a 2026-1): se cargan desde los listados en papel
// como un evento con sus conteos, y entran al SNIES de ese periodo.
// Informes del area: el informe de gestion (se envia al superadministrador) y los exportes SNIES.
export function InformesPersonal() {
  const [vista, setVista] = useState("gestion");
  return (
    <Marco titulo="Informes">
      <Segmentos className="mb-6" etiqueta="Tipo de informe" opciones={[["gestion", "Informe de gestión"], ["snies", "Reportes SNIES"]]} valor={vista} alCambiar={setVista} />
      {vista === "gestion" ? <InformeGestionCultura /> : <ReportesSnies />}
    </Marco>
  );
}

function CargaHistorica() {
  const nuevo = useVentana();
  const vacio = { nombre: "", categoria: "especial", fecha: "", lugar: "", codigoSnies: "", documentoResponsable: "", conteoEstudiantes: 0, conteoDocentes: 0, conteoAdministrativos: 0, conteoEgresados: 0 };
  const [form, setForm] = useState(vacio);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  async function guardar(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    try {
      await http.post("/cultura/admin/agenda", { ...form, fechaLimite: form.fecha, horaInicio: "08:00", horaFin: "17:00", cupo: 1, estado: "Publicado" });
      setAviso(`Quedó cargada ${form.nombre}. Sube el listado escaneado desde Agenda.`);
      nuevo.cerrar();
      setForm(vacio);
    } catch (err) {
      setError(mensajeError(err, "No fue posible cargar la actividad."));
    }
  }
  const numero = (clave, texto) => (
    <label className="text-sm font-semibold">{texto}<input type="number" min="0" className={`${campo} w-full mt-1`} value={form[clave]} onChange={(e) => setForm({ ...form, [clave]: e.target.value })} /></label>
  );
  return (
    <>
    {aviso && <Aviso tono="verde">{aviso}</Aviso>}
    <Desplegable titulo="Cargar una actividad de años anteriores" boton="Cargar año anterior" control={nuevo} error={error}>
      <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Actividad<input className={`${campo} w-full mt-1`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Halloween 2024" required /></label>
        <label className="text-sm font-semibold">Fecha<input type="date" className={`${campo} w-full mt-1`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Código SNIES<input className={`${campo} w-full mt-1`} value={form.codigoSnies} onChange={(e) => setForm({ ...form, codigoSnies: e.target.value })} /></label>
        <label className="text-sm font-semibold">Cédula del responsable<input className={`${campo} w-full mt-1`} value={form.documentoResponsable} onChange={(e) => setForm({ ...form, documentoResponsable: e.target.value })} /></label>
        {numero("conteoEstudiantes", "Estudiantes")}
        {numero("conteoDocentes", "Docentes")}
        {numero("conteoAdministrativos", "Administrativos")}
        {numero("conteoEgresados", "Egresados")}
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Cargar actividad</button>
      </form>
    </Desplegable>
    </>
  );
}

export function HistoricoPersonal() {
  const [filtro, setFiltro] = useState({ anio: "", periodo: "", q: "" });
  const [datos, setDatos] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [error, setError] = useState("");
  async function buscar(e) {
    e.preventDefault();
    setError("");
    try {
      const r = await http.get("/cultura/admin/historico", { params: filtro });
      setDatos(r.data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible consultar el histórico."));
    }
  }
  async function verEvidencias(params) {
    const r = await http.get("/cultura/admin/evidencias", { params });
    const vistas = [];
    for (const fila of r.data) {
      if (!fila.mime.startsWith("image/")) {
        vistas.push({ ...fila, url: "" });
        continue;
      }
      const archivo = await http.get(`/cultura/admin/evidencias/${fila.id}/archivo`, { responseType: "blob" });
      vistas.push({ ...fila, url: URL.createObjectURL(archivo.data) });
    }
    setFotos(vistas);
  }
  return (
    <Marco titulo="Histórico" texto="Busca por año, semestre (2026-1 o 2026-2) o nombre. Desde cada actividad se abren las fotos y las planillas.">
      {error && <Aviso>{error}</Aviso>}
      <CargaHistorica />
      <form onSubmit={buscar} className="flex flex-wrap items-center gap-2 mb-6">
        <input aria-label="Año" inputMode="numeric" className="min-h-[42px] rounded-full bg-white/90 border border-white px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-[0_4px_14px_-8px_rgba(11,35,71,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 w-[90px]" placeholder="Año" value={filtro.anio} onChange={(e) => setFiltro({ ...filtro, anio: e.target.value })} />
        <input aria-label="Semestre" className="min-h-[42px] rounded-full bg-white/90 border border-white px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-[0_4px_14px_-8px_rgba(11,35,71,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 w-[120px]" placeholder="2026-2" value={filtro.periodo} onChange={(e) => setFiltro({ ...filtro, periodo: e.target.value })} />
        <input aria-label="Nombre" className="min-h-[42px] rounded-full bg-white/90 border border-white px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-[0_4px_14px_-8px_rgba(11,35,71,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 flex-[1_1_180px] max-w-[320px]" placeholder="Nombre" value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} />
        <button className="boton-liquido min-h-[42px] px-5 rounded-full font-bold text-sm">Buscar</button>
      </form>
      {datos && ["grupos", "eventos", "pausas", "representaciones"].map((clave) => (
        <section key={clave} className="mb-6">
          <h2 className="text-lg font-extrabold capitalize">{clave}</h2>
          <ul className="list-none m-0 p-0 grid gap-1">
            {datos[clave].map((f) => (
              <li key={f.id} className="burbuja rounded-xl px-3 py-2 text-sm flex justify-between gap-2">
                <span>{f.nombre || f.tecnica} {f.periodo || f.fecha || ""}{f.horaInicio ? ` · ${f.horaInicio}–${f.horaFin}` : ""} {f.posicion || ""} {f.evidencias ? `· ${f.evidencias} evidencias` : ""}</span>
                {f.evidencias > 0 && (
                  <button type="button" className="font-bold text-primary" onClick={() => verEvidencias(clave === "grupos" ? { grupoId: f.id } : clave === "eventos" ? { eventoId: f.id } : { pausaId: f.id })}>Ver</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {fotos.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {fotos.map((f) => (
            <article key={f.id} className="vidrio-panel rounded-[22px] p-3">
              <p className="m-0 text-sm font-semibold">{f.tipo === "planilla" ? "Planilla física" : "Fotografía"} · {f.nombreOriginal}</p>
              {f.url && <img src={f.url} alt={f.nombreOriginal} className="mt-2 w-full rounded-xl" />}
            </article>
          ))}
        </div>
      )}
    </Marco>
  );
}

const NOMBRE_ROL = { administrador: "Coordinación", docente: "Docente", monitor: "Monitor" };
const fechaCorta = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(".", "");

// Etiqueta de lo que una persona tiene a cargo, con una x para quitarla (si se puede).
function Asignacion({ funcion, texto, alQuitar, etiquetaQuitar, noSePuedeQuitar }) {
  const estilos = funcion === "dirige" ? "bg-primary text-white" : funcion === "ayuda" ? "bg-primary-light text-primary-dark" : "bg-gold-light text-[#7A5405]";
  return (
    <li className="inline-flex items-center gap-1.5 text-[13px] rounded-md bg-white/70 border border-gray-200 pl-1 pr-1 py-0.5">
      <span className={`text-[11px] font-bold rounded px-1.5 py-0.5 select-none ${estilos}`}>{funcion === "dirige" ? "Dirige" : funcion === "ayuda" ? "Ayuda" : "Evento"}</span>
      <span className="font-semibold text-ink-700">{texto}</span>
      {alQuitar && (
        <button
          type="button"
          onClick={alQuitar}
          disabled={noSePuedeQuitar}
          aria-label={etiquetaQuitar}
          title={noSePuedeQuitar || etiquetaQuitar}
          className="w-6 h-6 -mr-0.5 inline-flex items-center justify-center rounded text-ink-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink-500 disabled:cursor-not-allowed"
        >
          <Icono nombre="cerrar" size={14} strokeWidth={2.6} />
        </button>
      )}
    </li>
  );
}

// Lista para sumar a alguien: al elegir una opcion se asigna de una vez y la lista vuelve a su inicio.
function AsignarA({ etiqueta, grupos, alElegir }) {
  const hay = grupos.some((g) => g.opciones.length > 0);
  if (!hay) return null;
  return (
    <select
      aria-label={etiqueta}
      value=""
      onChange={(e) => e.target.value && alElegir(e.target.value)}
      className="min-h-[36px] rounded-lg border border-dashed border-primary/40 bg-white/60 px-2.5 text-[13px] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <option value="">+ {etiqueta}</option>
      {grupos.map((g) =>
        g.opciones.length ? (
          <optgroup key={g.titulo} label={g.titulo}>
            {g.opciones.map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </optgroup>
        ) : null
      )}
    </select>
  );
}

export function EquipoPersonal() {
  const confirmar = useConfirmar();
  const [lista, setLista] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [buscar, setBuscar] = useState("");
  const [rol, setRol] = useState("");
  const [vista, setVista] = useState("personas");
  const [nueva, setNueva] = useState({ email: "", rol: "monitor" });
  const [agregando, setAgregando] = useState(false);
  const limpiar = () => {
    setBuscar("");
    setRol("");
  };
  const visibles = lista.filter((p) => coincide(buscar, p.email, p.nombre) && (!rol || p.rol === rol));
  function cargar() {
    http.get("/cultura/admin/equipo").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar el equipo. Esta vista es del administrador del área."));
    http.get("/cultura/admin/grupos").then((r) => setGrupos(r.data)).catch(() => {});
    http.get("/cultura/admin/agenda").then((r) => setEventos(r.data)).catch(() => {});
  }
  useEffect(cargar, []);

  const nombreDe = (email) => lista.find((m) => m.email === email)?.nombre || email;
  const hoy = hoyISO();
  const proximos = eventos.filter((e) => String(e.fecha).slice(0, 10) >= hoy);
  const gruposSinNadie = grupos.filter((g) => !g.docenteEmail && !(g.monitoresEmails || []).length);
  const eventosConEquipo = proximos.filter((e) => (e.responsablesEmails || []).length || e.grupoId).length;
  const cuenta = (r) => lista.filter((p) => p.rol === r).length;
  const ayudantesDe = (g) => g.monitoresEmails || [];
  const responsablesDe = (e) => e.responsablesEmails || [];

  // --- Cambios de equipo en un grupo o evento (se guardan al momento) ---
  async function guardar(ruta, cuerpo, ok, falla) {
    setError("");
    setAviso("");
    try {
      await http.put(ruta, cuerpo);
      setAviso(ok);
      cargar();
    } catch (err) {
      setError(mensajeError(err, falla));
    }
  }
  const guardarGrupo = (g, cambios, ok) =>
    guardar(`/cultura/admin/grupos/${g.id}/responsables`, { docenteEmail: g.docenteEmail || null, monitoresEmails: ayudantesDe(g), ...cambios }, ok, "No fue posible cambiar el equipo del grupo.");
  const guardarEvento = (e, responsablesEmails, ok) => guardar(`/cultura/admin/agenda/${e.id}/responsables`, { responsablesEmails }, ok, "No fue posible cambiar el equipo del evento.");

  const quitarDeGrupo = (g, email) =>
    guardarGrupo(g, g.docenteEmail === email ? { docenteEmail: null } : { monitoresEmails: ayudantesDe(g).filter((m) => m !== email) }, `${nombreDe(email)} ya no está en ${g.nombre}.`);
  const asignarAGrupo = (g, email, funcion) =>
    funcion === "dirige"
      ? guardarGrupo(g, { docenteEmail: email, monitoresEmails: ayudantesDe(g).filter((m) => m !== email) }, `${nombreDe(email)} ahora dirige ${g.nombre}.`)
      : guardarGrupo(g, { docenteEmail: g.docenteEmail === email ? null : g.docenteEmail || null, monitoresEmails: [...new Set([...ayudantesDe(g), email])] }, `${nombreDe(email)} ayuda en ${g.nombre}.`);
  const quitarDeEvento = (e, email) => guardarEvento(e, responsablesDe(e).filter((m) => m !== email), `${nombreDe(email)} ya no está a cargo de ${e.nombre}.`);
  const asignarAEvento = (e, email) => guardarEvento(e, [...new Set([...responsablesDe(e), email])], `${nombreDe(email)} quedó a cargo de ${e.nombre}.`);

  // Un grupo siempre necesita a alguien: no se puede quitar a la unica persona.
  const esLaUnica = (g) => (g.docenteEmail ? 1 : 0) + ayudantesDe(g).length <= 1;
  const AVISO_UNICA = "Un grupo necesita al menos una persona a cargo. Asigna a otra antes de quitar a esta.";

  // Opciones para sumar personas a un grupo o a un evento.
  const opcionesParaGrupo = (g) => [
    { titulo: "Que dirija", opciones: lista.filter((m) => (m.rol === "docente" || m.rol === "administrador") && m.email !== g.docenteEmail).map((m) => [`dirige|${m.email}`, `${m.nombre || m.email} · ${NOMBRE_ROL[m.rol]}`]) },
    { titulo: "Que ayude", opciones: lista.filter((m) => (m.rol === "docente" || m.rol === "monitor") && m.email !== g.docenteEmail && !ayudantesDe(g).includes(m.email)).map((m) => [`ayuda|${m.email}`, `${m.nombre || m.email} · ${NOMBRE_ROL[m.rol]}`]) },
  ];
  const opcionesParaEvento = (e) => [{ titulo: "A cargo del evento", opciones: lista.filter((m) => !responsablesDe(e).includes(m.email)).map((m) => [m.email, `${m.nombre || m.email} · ${NOMBRE_ROL[m.rol]}`]) }];
  // Opciones para sumar a una persona a un grupo o evento (desde su tarjeta).
  const opcionesParaPersona = (p) => {
    const dirige = p.rol === "docente" || p.rol === "administrador";
    const ayuda = p.rol === "docente" || p.rol === "monitor";
    return [
      { titulo: "Que dirija el grupo", opciones: dirige ? grupos.filter((g) => g.docenteEmail !== p.email).map((g) => [`g|dirige|${g.id}`, g.nombre]) : [] },
      { titulo: "Que ayude en el grupo", opciones: ayuda ? grupos.filter((g) => g.docenteEmail !== p.email && !ayudantesDe(g).includes(p.email)).map((g) => [`g|ayuda|${g.id}`, g.nombre]) : [] },
      { titulo: "A cargo del evento", opciones: proximos.filter((e) => !responsablesDe(e).includes(p.email)).map((e) => [`e|${e.id}`, `${e.nombre} · ${fechaCorta(e.fecha)}`]) },
    ];
  };
  function asignarDesdePersona(p, valor) {
    const [tipo, a, b] = valor.split("|");
    if (tipo === "g") return asignarAGrupo(grupos.find((g) => g.id === b), p.email, a);
    return asignarAEvento(proximos.find((e) => e.id === a), p.email);
  }

  async function agregar(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    setAgregando(true);
    try {
      await http.post("/cultura/admin/equipo", nueva);
      setAviso(`${nueva.email.trim().toLowerCase()} quedó en el equipo como ${ROLES_EQUIPO.find((r) => r.id === nueva.rol).nombre.toLowerCase()}.`);
      setNueva({ email: "", rol: nueva.rol });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible agregar a la persona."));
    } finally {
      setAgregando(false);
    }
  }
  async function cambiar(email, nuevoRol) {
    setError("");
    setAviso("");
    try {
      await http.put("/cultura/admin/equipo", { email, rol: nuevoRol });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible cambiar el rol."));
    }
  }
  async function quitar(p) {
    setError("");
    setAviso("");
    const ok = await confirmar({
      titulo: `¿Quitar a ${p.nombre || p.email} del equipo?`,
      mensaje: "Pierde el acceso a Arte y Cultura. Podrás volver a agregarla cuando quieras.",
      detalle: p.grupos.length > 0 ? `También saldrá de los grupos a su cargo: ${p.grupos.map((g) => g.nombre).join(", ")}.` : undefined,
      boton: "Quitar del equipo",
      peligro: true,
    });
    if (!ok) return;
    try {
      await http.delete(`/cultura/admin/equipo/${encodeURIComponent(p.email)}`);
      setAviso(`${p.nombre || p.email} ya no está en el equipo.`);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible quitar a la persona."));
    }
  }

  const resumen = [
    { titulo: "Personas en el equipo", valor: lista.length, detalle: `${cuenta("administrador")} coordinación · ${cuenta("docente")} docentes · ${cuenta("monitor")} monitores` },
    { titulo: "Grupos con alguien a cargo", valor: `${grupos.length - gruposSinNadie.length} de ${grupos.length}`, detalle: gruposSinNadie.length ? `${gruposSinNadie.length} sin nadie` : "Todos cubiertos", alerta: gruposSinNadie.length > 0 },
    { titulo: "Eventos próximos", valor: proximos.length, detalle: `${eventosConEquipo} con equipo asignado · el resto, la coordinación` },
  ];

  return (
    <Marco titulo="Equipo del área" texto="Quién trabaja en Arte y Cultura, qué puede hacer y qué grupos y eventos tiene a su cargo. Aquí mismo puedes asignar y quitar.">
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}

      <ul className="list-none m-0 mb-4 p-0 grid gap-3 sm:grid-cols-3" aria-label="Resumen del equipo">
        {resumen.map((r) => (
          <li key={r.titulo} className={`vidrio-panel rounded-[22px] px-4 py-3 ${r.alerta ? "ring-1 ring-amber-300" : ""}`}>
            <p className="m-0 text-[13px] font-semibold text-ink-500">{r.titulo}</p>
            <p className="m-0 text-2xl font-extrabold text-primary-dark tabular-nums">{r.valor}</p>
            <p className={`m-0 text-[13px] ${r.alerta ? "font-bold text-[#7A5405]" : "text-ink-600"}`}>{r.detalle}</p>
          </li>
        ))}
      </ul>

      {gruposSinNadie.length > 0 && (
        <Aviso tono="dorado">
          <strong>Sin nadie a cargo:</strong> {gruposSinNadie.map((g) => g.nombre).join(", ")}. Asígnales a alguien desde la vista Por grupo y evento.
        </Aviso>
      )}

      <form onSubmit={agregar} className="vidrio-panel rounded-[22px] p-4 my-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] items-end">
        <label className="text-sm font-semibold">
          Agregar a una persona
          <input type="email" required placeholder="nombre@uniautonoma.edu.co" className={`${campo} w-full mt-1`} value={nueva.email} onChange={(e) => setNueva({ ...nueva, email: e.target.value })} />
        </label>
        <label className="text-sm font-semibold">
          Rol
          <select className={`${campo} w-full mt-1`} value={nueva.rol} onChange={(e) => setNueva({ ...nueva, rol: e.target.value })}>
            {ROLES_EQUIPO.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
        <button disabled={agregando} className="boton-liquido min-h-[44px] px-5 rounded-full font-bold disabled:opacity-60">
          {agregando ? "Agregando…" : "Agregar al equipo"}
        </button>
        <p className="m-0 text-sm text-ink-500 sm:col-span-3">Debe ser un correo institucional. Si la persona ya ingresó como estudiante, pasa a ser parte del equipo con el rol que elijas.</p>
      </form>

      <details className="vidrio-panel rounded-[22px] px-4 py-1 mb-4">
        <summary className="min-h-[44px] flex items-center text-sm font-extrabold text-primary-dark cursor-pointer">¿Qué puede hacer cada rol?</summary>
        <ul className="list-none m-0 mb-3 p-0 grid gap-2 md:grid-cols-3">
          {ROLES_EQUIPO.map((r) => (
            <li key={r.id} className="rounded-xl bg-white/70 px-3 py-2.5">
              <p className="m-0 text-sm font-extrabold text-primary-dark">{r.nombre}</p>
              <p className="m-0 mt-1 text-[13px] text-ink-600">{r.detalle}</p>
            </li>
          ))}
        </ul>
      </details>

      <div className="mb-4">
        <Segmentos etiqueta="Ver el equipo" opciones={[["personas", "Por persona", "usuarios"], ["grupos", "Por grupo y evento", "musica"]]} valor={vista} alCambiar={setVista} />
      </div>

      {vista === "personas" && (
        <>
          <Filtros
            buscar={buscar}
            alBuscar={setBuscar}
            placeholder="Buscar por nombre o correo"
            pastillas={[{ etiqueta: "Rol", valor: rol, alCambiar: setRol, opciones: [["", "Todos"], ["administrador", "Coordinación"], ["docente", "Docentes"], ["monitor", "Monitores"]] }]}
            total={lista.length}
            visibles={visibles.length}
            alLimpiar={limpiar}
          />
          <ul className="list-none m-0 p-0 grid gap-2">
            {visibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="Todavía no hay nadie en el equipo. Agrega a la primera persona arriba." alLimpiar={limpiar} />}
            {visibles.map((p) => {
              const sinNada = !p.dirige.length && !p.ayuda.length && !p.eventos.length;
              const nombre = p.nombre || p.email;
              return (
                <li key={p.email} className="vidrio-panel rounded-[22px] px-4 py-3">
                  <div className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="min-w-0">
                      <p className="m-0 font-extrabold text-primary-dark truncate">
                        {nombre} <span className="ml-1 align-middle text-[11px] font-bold rounded-md bg-primary-light text-primary-dark px-1.5 py-0.5 select-none">{NOMBRE_ROL[p.rol]}</span>
                      </p>
                      {p.nombre && <p className="m-0 text-sm text-ink-500 truncate">{p.email}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select className={campo} aria-label={`Rol de ${nombre}`} value={p.rol} onChange={(e) => cambiar(p.email, e.target.value)}>
                        {ROLES_EQUIPO.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => quitar(p)} className="min-h-[44px] px-4 rounded-full border border-red-300 text-red-700 bg-white/70 font-bold text-sm hover:bg-red-50">
                        Quitar del equipo
                      </button>
                    </div>
                  </div>
                  <ul className="list-none m-0 mt-2 p-0 flex flex-wrap items-center gap-1.5" aria-label={`A cargo de ${nombre}`}>
                    {p.dirige.map((g) => {
                      const grupo = grupos.find((x) => x.id === g.id);
                      return <Asignacion key={`d-${g.id}`} funcion="dirige" texto={g.nombre} alQuitar={grupo && (() => quitarDeGrupo(grupo, p.email))} etiquetaQuitar={`Quitar a ${nombre} de ${g.nombre}`} noSePuedeQuitar={grupo && esLaUnica(grupo) ? AVISO_UNICA : ""} />;
                    })}
                    {p.ayuda.map((g) => {
                      const grupo = grupos.find((x) => x.id === g.id);
                      return <Asignacion key={`a-${g.id}`} funcion="ayuda" texto={g.nombre} alQuitar={grupo && (() => quitarDeGrupo(grupo, p.email))} etiquetaQuitar={`Quitar a ${nombre} de ${g.nombre}`} noSePuedeQuitar={grupo && esLaUnica(grupo) ? AVISO_UNICA : ""} />;
                    })}
                    {p.eventos.map((ev) => {
                      const evento = eventos.find((x) => x.id === ev.id);
                      return <Asignacion key={`e-${ev.id}`} funcion="evento" texto={`${ev.nombre} · ${fechaCorta(ev.fecha)}`} alQuitar={evento && (() => quitarDeEvento(evento, p.email))} etiquetaQuitar={`Quitar a ${nombre} de ${ev.nombre}`} />;
                    })}
                    <li>
                      <AsignarA etiqueta="Asignar a un grupo o evento" grupos={opcionesParaPersona(p)} alElegir={(v) => asignarDesdePersona(p, v)} />
                    </li>
                  </ul>
                  {sinNada && <p className="m-0 mt-1.5 text-[13px] text-ink-600">{p.rol === "administrador" ? "Ve y administra todos los grupos y eventos." : "Sin grupos ni eventos a cargo todavía."}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {vista === "grupos" && (
        <div className="grid gap-4">
          <section aria-labelledby="equipo-grupos">
            <h2 id="equipo-grupos" className="m-0 mb-2 text-lg font-extrabold text-primary-dark">Grupos y talleres</h2>
            <ul className="list-none m-0 p-0 grid gap-2">
              {grupos.length === 0 && <li className="vidrio-panel rounded-[22px] px-4 py-3 text-sm text-ink-500">Todavía no hay grupos.</li>}
              {grupos.map((g) => {
                const sinNadie = !g.docenteEmail && ayudantesDe(g).length === 0;
                return (
                  <li key={g.id} className={`vidrio-panel rounded-[22px] px-4 py-3 ${sinNadie ? "ring-1 ring-amber-300" : ""}`}>
                    <p className="m-0 font-extrabold text-primary-dark">
                      {g.nombre} <span className="ml-1 text-sm font-normal text-ink-500">{g.area}</span>
                    </p>
                    {sinNadie && <p className="m-0 mt-1 text-[13px] font-bold text-[#7A5405]">Sin nadie a cargo. Asigna a alguien aquí:</p>}
                    <ul className="list-none m-0 mt-2 p-0 flex flex-wrap items-center gap-1.5" aria-label={`Equipo de ${g.nombre}`}>
                      {g.docenteEmail && <Asignacion funcion="dirige" texto={nombreDe(g.docenteEmail)} alQuitar={() => quitarDeGrupo(g, g.docenteEmail)} etiquetaQuitar={`Quitar a ${nombreDe(g.docenteEmail)} de ${g.nombre}`} noSePuedeQuitar={esLaUnica(g) ? AVISO_UNICA : ""} />}
                      {ayudantesDe(g).map((m) => (
                        <Asignacion key={m} funcion="ayuda" texto={nombreDe(m)} alQuitar={() => quitarDeGrupo(g, m)} etiquetaQuitar={`Quitar a ${nombreDe(m)} de ${g.nombre}`} noSePuedeQuitar={esLaUnica(g) ? AVISO_UNICA : ""} />
                      ))}
                      <li>
                        <AsignarA etiqueta="Asignar a alguien" grupos={opcionesParaGrupo(g)} alElegir={(v) => asignarAGrupo(g, v.split("|")[1], v.split("|")[0])} />
                      </li>
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
          <section aria-labelledby="equipo-eventos">
            <h2 id="equipo-eventos" className="m-0 mb-2 text-lg font-extrabold text-primary-dark">Eventos próximos</h2>
            <ul className="list-none m-0 p-0 grid gap-2">
              {proximos.length === 0 && <li className="vidrio-panel rounded-[22px] px-4 py-3 text-sm text-ink-500">No hay eventos próximos.</li>}
              {proximos.map((e) => {
                const delGrupo = grupos.find((g) => g.id === e.grupoId);
                const responsables = responsablesDe(e);
                return (
                  <li key={e.id} className="vidrio-panel rounded-[22px] px-4 py-3">
                    <p className="m-0 font-extrabold text-primary-dark">
                      {e.nombre} <span className="ml-1 text-sm font-normal text-ink-500">{fechaCorta(e.fecha)}{delGrupo ? ` · de ${delGrupo.nombre}` : ""}</span>
                    </p>
                    {responsables.length === 0 && !delGrupo && <p className="m-0 mt-1 text-[13px] text-ink-600">Lo maneja la coordinación. Puedes asignar a alguien aquí:</p>}
                    <ul className="list-none m-0 mt-2 p-0 flex flex-wrap items-center gap-1.5" aria-label={`Equipo de ${e.nombre}`}>
                      {responsables.map((m) => (
                        <Asignacion key={m} funcion="evento" texto={nombreDe(m)} alQuitar={() => quitarDeEvento(e, m)} etiquetaQuitar={`Quitar a ${nombreDe(m)} de ${e.nombre}`} />
                      ))}
                      {delGrupo?.docenteEmail && <Asignacion funcion="dirige" texto={`${nombreDe(delGrupo.docenteEmail)} (grupo)`} />}
                      <li>
                        <AsignarA etiqueta="Asignar a alguien" grupos={opcionesParaEvento(e)} alElegir={(v) => asignarAEvento(e, v)} />
                      </li>
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </Marco>
  );
}
