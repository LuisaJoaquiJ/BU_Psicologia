import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { mensajeError } from "../comun/formato";
import { Icono } from "../comunes/componentes/Iconos";
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
        placeholder="Buscar por convocatoria, modalidad, grupo o estudiante"
        selectores={[{ etiqueta: "Año", valor: anio, alCambiar: setAnio, opciones: [["", "Todos"], ...opcionesDe(lista, (f) => String(f.fecha).slice(0, 4)).reverse().map((a) => [a, a])] }]}
        pastillas={[
          { etiqueta: "Red", valor: red, alCambiar: setRed, opciones: [["", "Todas"], ["ASIES", "ASIES"], ["ASCUN", "ASCUN"]] },
          { etiqueta: "Reconocimiento", valor: premio, alCambiar: setPremio, opciones: [["", "Todos"], ["si", "Con reconocimiento"], ["no", "Sin reconocimiento"]] },
          { etiqueta: "Oficio", valor: oficio, alCambiar: setOficio, opciones: [["", "Todos"], ["con", "Con oficio"], ["sin", "Sin oficio"]] },
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
  const [form, setForm] = useState({ fecha: "", lugar: "", tecnica: "", impactoEstimado: 0 });
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
      setForm({ fecha: "", lugar: "", tecnica: "", impactoEstimado: 0 });
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
        <label className="text-sm font-semibold">Lugar<input className={`${campo} w-full mt-1`} placeholder="Cafetería" value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Técnica<input className={`${campo} w-full mt-1`} placeholder="Origami" value={form.tecnica} onChange={(e) => setForm({ ...form, tecnica: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Estudiantes impactados<input type="number" min="0" className={`${campo} w-full mt-1`} value={form.impactoEstimado} onChange={(e) => setForm({ ...form, impactoEstimado: e.target.value })} required /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Registrar pausa</button>
      </form>
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar por técnica o lugar"
        selectores={[{ etiqueta: "Mes", valor: mes, alCambiar: setMes, opciones: [["", "Todos"], ...opcionesDe(lista, (p) => String(p.fecha).slice(0, 7)).reverse().map((m) => [m, m])] }]}
        pastillas={[{ etiqueta: "Evidencia", valor: foto, alCambiar: setFoto, opciones: [["", "Todas"], ["con", "Con foto"], ["sin", "Sin foto"]] }]}
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
          <li key={p.id} className="vidrio-panel rounded-[22px] px-4 py-3">
            <strong>{p.tecnica}</strong>
            <p className="m-0 text-sm text-ink-500">{p.fecha} · {p.lugar} · {p.impactoEstimado} personas · {p.evidencias} evidencias</p>
            <label className="mt-2 inline-flex items-center min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm cursor-pointer">
              Subir foto
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
        placeholder="Buscar por destino, grupo o personal"
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

export function InformesPersonal() {
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
    <Marco titulo="Informes" texto="Elige el periodo y, si te lo piden, un programa. El Excel SNIES trae una hoja con el código de la actividad, la cédula del responsable, el código del tipo de persona (1 estudiante, 2 docente, 3 administrativo, 4 egresado) y la cantidad de personas sin repetir.">
      {error && <Aviso>{error}</Aviso>}
      <section className="vidrio-panel rounded-[22px] p-4 mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {rangos().map(([nombre, d, h]) => (
            <button
              key={nombre}
              type="button"
              aria-pressed={desde === d && hasta === h}
              onClick={() => {
                setDesde(d);
                setHasta(h);
              }}
              className={`min-h-[40px] px-4 rounded-full text-sm font-bold ${desde === d && hasta === h ? "boton-liquido" : "burbuja text-primary-dark"}`}
            >
              {nombre}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold">Desde<input type="date" className={`${campo} w-full mt-1`} value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="text-sm font-semibold">Hasta<input type="date" className={`${campo} w-full mt-1`} value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          <label className="text-sm font-semibold">
            Programa (registro calificado)
            <input list="programas-cultura" className={`${campo} w-full mt-1`} value={programa} onChange={(e) => setPrograma(e.target.value)} placeholder="Todos" />
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
    </Marco>
  );
}

// Datos de otros anos (2023 a 2026-1): se cargan desde los listados en papel
// como un evento con sus conteos, y entran al SNIES de ese periodo.
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
      <form onSubmit={buscar} className="vidrio-panel rounded-[22px] p-4 flex flex-wrap gap-2 mb-6">
        <input className={campo} placeholder="Año" value={filtro.anio} onChange={(e) => setFiltro({ ...filtro, anio: e.target.value })} />
        <input className={campo} placeholder="Semestre" value={filtro.periodo} onChange={(e) => setFiltro({ ...filtro, periodo: e.target.value })} />
        <input className={`${campo} flex-1`} placeholder="Nombre" value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} />
        <button className="boton-liquido min-h-[44px] px-4 rounded-full font-bold">Buscar</button>
      </form>
      {datos && ["grupos", "eventos", "pausas", "representaciones"].map((clave) => (
        <section key={clave} className="mb-6">
          <h2 className="text-lg font-extrabold capitalize">{clave}</h2>
          <ul className="list-none m-0 p-0 grid gap-1">
            {datos[clave].map((f) => (
              <li key={f.id} className="burbuja rounded-xl px-3 py-2 text-sm flex justify-between gap-2">
                <span>{f.nombre || f.tecnica} {f.periodo || f.fecha || ""} {f.posicion || ""} {f.evidencias ? `· ${f.evidencias} evidencias` : ""}</span>
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

export function EquipoPersonal() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [buscar, setBuscar] = useState("");
  const [rol, setRol] = useState("");
  const limpiar = () => {
    setBuscar("");
    setRol("");
  };
  const visibles = lista.filter((p) => coincide(buscar, p.email) && (!rol || p.rol === rol));
  function cargar() {
    http.get("/cultura/admin/equipo").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar el equipo. Esta vista es del administrador del área."));
  }
  useEffect(cargar, []);
  async function cambiar(email, rol) {
    setError("");
    try {
      await http.put("/cultura/admin/equipo", { email, rol });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible cambiar el rol."));
    }
  }
  return (
    <Marco titulo="Equipo del área" texto="El superadministrador decide quién entra. Aquí se distingue al administrador del área, al docente del taller y al monitor.">
      {error && <Aviso>{error}</Aviso>}
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar por correo"
        pastillas={[{ etiqueta: "Rol", valor: rol, alCambiar: setRol, opciones: [["", "Todos"], ["administrador", "Administradores"], ["docente", "Docentes"], ["monitor", "Monitores"]] }]}
        total={lista.length}
        visibles={visibles.length}
        alLimpiar={limpiar}
      />
      <ul className="list-none m-0 p-0 grid gap-2">
        {visibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="Nadie tiene acceso a Cultura todavía. Pide al superadministrador que asigne los correos." alLimpiar={limpiar} />}
        {visibles.map((p) => (
          <li key={p.email} className="vidrio-panel rounded-[22px] px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
            <span>{p.email}</span>
            <select className={campo} value={p.rol} onChange={(e) => cambiar(p.email, e.target.value)}>
              <option value="administrador">Administrador del área</option>
              <option value="docente">Docente de taller</option>
              <option value="monitor">Monitor operativo</option>
            </select>
          </li>
        ))}
      </ul>
    </Marco>
  );
}
