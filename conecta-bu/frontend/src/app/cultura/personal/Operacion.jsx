import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { mensajeError } from "../comun/formato";

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

const campo = "border rounded-xl px-3 py-2 min-h-[44px]";

export function RedesPersonal() {
  const [lista, setLista] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ red: "ASIES", nombre: "", modalidad: "", fecha: "", grupoId: "", posicion: "", participantes: "" });
  function cargar() {
    http.get("/cultura/admin/representaciones").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar las representaciones."));
    http.get("/cultura/admin/grupos").then((r) => setGrupos(r.data)).catch(() => {});
  }
  useEffect(cargar, []);
  async function crear(e) {
    e.preventDefault();
    setError("");
    const participantes = form.participantes.split(/[\s,;]+/).filter(Boolean);
    try {
      await http.post("/cultura/admin/representaciones", { ...form, participantes });
      setForm({ ...form, nombre: "", modalidad: "", posicion: "", participantes: "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar la representación."));
    }
  }
  return (
    <Marco titulo="Redes ASIES y ASCUN" texto="Vincula la delegación a la convocatoria y deja el reconocimiento obtenido. El histórico queda por estudiante y por grupo.">
      {error && <Aviso>{error}</Aviso>}
      <form onSubmit={crear} className="bg-white border rounded-2xl p-4 grid gap-3 sm:grid-cols-2 mb-8">
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
        <label className="text-sm font-semibold sm:col-span-2">Correos institucionales de la delegación, separados por coma
          <input className={`${campo} w-full mt-1`} value={form.participantes} onChange={(e) => setForm({ ...form, participantes: e.target.value })} required />
        </label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Registrar delegación</button>
      </form>
      <ul className="list-none m-0 p-0 grid gap-2">
        {lista.map((f) => (
          <li key={f.id} className="bg-white border rounded-2xl px-4 py-3">
            <strong>{f.red} · {f.nombre}</strong>
            <p className="m-0 text-sm text-ink-500">{f.fecha}{f.modalidad ? ` · ${f.modalidad}` : ""}{f.grupo ? ` · ${f.grupo}` : ""}{f.posicion ? ` · ${f.posicion}` : ""}</p>
            <p className="m-0 text-sm">{f.participantes.map((p) => p.nombre).join(", ")}</p>
          </li>
        ))}
      </ul>
    </Marco>
  );
}

export function ItinerantePersonal() {
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
      setForm({ fecha: "", lugar: "", tecnica: "", impactoEstimado: 0 });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar la pausa."));
    }
  }
  return (
    <Marco titulo="Arte itinerante" texto="Registra la pausa creativa con la fecha, el lugar, la técnica y cuántas personas se estima que participaron. La foto queda como evidencia.">
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <form onSubmit={crear} className="bg-white border rounded-2xl p-4 grid gap-3 sm:grid-cols-2 mb-8">
        <label className="text-sm font-semibold">Fecha<input type="date" className={`${campo} w-full mt-1`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Lugar<input className={`${campo} w-full mt-1`} placeholder="Cafetería" value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Técnica<input className={`${campo} w-full mt-1`} placeholder="Origami" value={form.tecnica} onChange={(e) => setForm({ ...form, tecnica: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Estudiantes impactados<input type="number" min="0" className={`${campo} w-full mt-1`} value={form.impactoEstimado} onChange={(e) => setForm({ ...form, impactoEstimado: e.target.value })} required /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Registrar pausa</button>
      </form>
      <ul className="list-none m-0 p-0 grid gap-2">
        {lista.map((p) => (
          <li key={p.id} className="bg-white border rounded-2xl px-4 py-3">
            <strong>{p.tecnica}</strong>
            <p className="m-0 text-sm text-ink-500">{p.fecha} · {p.lugar} · {p.impactoEstimado} personas · {p.evidencias} evidencias</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 text-sm"
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
          </li>
        ))}
      </ul>
    </Marco>
  );
}

export function ApoyoPersonal() {
  const [lista, setLista] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ lugarDestino: "", fecha: "", hora: "09:00", grupoId: "", detalle: "", personalAsignado: "" });
  function cargar() {
    http.get("/cultura/admin/apoyo").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar las solicitudes."));
    http.get("/cultura/admin/grupos").then((r) => setGrupos(r.data)).catch(() => {});
  }
  useEffect(cargar, []);
  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/apoyo", form);
      setForm({ ...form, lugarDestino: "", detalle: "", personalAsignado: "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar la solicitud."));
    }
  }
  return (
    <Marco titulo="Apoyo a promoción" texto="Colegio o feria, fecha, hora y grupo. Después queda el personal que asistió: docentes, monitores o el grupo.">
      {error && <Aviso>{error}</Aviso>}
      <form onSubmit={crear} className="bg-white border rounded-2xl p-4 grid gap-3 sm:grid-cols-2 mb-8">
        <label className="text-sm font-semibold">Destino<input className={`${campo} w-full mt-1`} value={form.lugarDestino} onChange={(e) => setForm({ ...form, lugarDestino: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Fecha<input type="date" className={`${campo} w-full mt-1`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Hora<input type="time" className={`${campo} w-full mt-1`} value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Grupo
          <select className={`${campo} w-full mt-1`} value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })}>
            <option value="">Sin grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">Personal que asiste<input className={`${campo} w-full mt-1`} value={form.personalAsignado} onChange={(e) => setForm({ ...form, personalAsignado: e.target.value })} /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Registrar solicitud</button>
      </form>
      <ul className="list-none m-0 p-0 grid gap-2">
        {lista.map((s) => (
          <li key={s.id} className="bg-white border rounded-2xl px-4 py-3 text-sm">
            <strong>{s.lugarDestino}</strong> · {s.fecha} · {s.hora} · {s.grupo || "sin grupo"} · {s.estado}
            {s.personalAsignado && <p className="m-0 text-ink-500">Personal: {s.personalAsignado}</p>}
          </li>
        ))}
      </ul>
    </Marco>
  );
}

export function InformesPersonal() {
  const [programa, setPrograma] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [lista, setLista] = useState([]);
  const [inclusion, setInclusion] = useState([]);
  const [error, setError] = useState("");
  async function consultar(e) {
    e.preventDefault();
    setError("");
    try {
      const params = { programa, desde, hasta };
      const [personas, poblacion] = await Promise.all([
        http.get("/cultura/admin/registro-calificado", { params }),
        http.get("/cultura/admin/inclusion", { params }),
      ]);
      setLista(personas.data);
      setInclusion(poblacion.data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible consultar."));
    }
  }
  async function descargar(formato) {
    const r = await http.get("/cultura/admin/informe", { params: { desde, hasta, formato }, responseType: formato === "csv" ? "text" : "blob" });
    const blob = formato === "csv" ? new Blob([r.data], { type: "text/csv" }) : r.data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = formato === "csv" ? "SNIES-cultura.csv" : "SNIES-cultura.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Marco titulo="Informes SNIES y registro calificado" texto="Los códigos de esta ficha son 1 estudiante, 2 docente, 3 administrativo y 4 egresado. El Excel trae asistencia, totales, programa y caracterización.">
      {error && <Aviso>{error}</Aviso>}
      <form onSubmit={consultar} className="bg-white border rounded-2xl p-4 grid gap-3 sm:grid-cols-3 mb-6">
        <label className="text-sm font-semibold">Programa<input className={`${campo} w-full mt-1`} value={programa} onChange={(e) => setPrograma(e.target.value)} placeholder="Derecho" /></label>
        <label className="text-sm font-semibold">Desde<input type="date" className={`${campo} w-full mt-1`} value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label className="text-sm font-semibold">Hasta<input type="date" className={`${campo} w-full mt-1`} value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Consultar</button>
      </form>
      <div className="flex gap-2 mb-6">
        <button type="button" onClick={() => descargar("xlsx")} className="min-h-[44px] px-4 rounded-full border font-bold">Descargar Excel</button>
        <button type="button" onClick={() => descargar("csv")} className="min-h-[44px] px-4 rounded-full border font-bold">Descargar CSV</button>
      </div>
      {inclusion.length > 0 && <p className="text-sm">{inclusion.map((f) => `${f.caracterizacion}: ${f.personas}`).join(" · ")}</p>}
      <ul className="list-none m-0 p-0 grid gap-1">
        {lista.map((p) => (
          <li key={p.usuarioId} className="bg-white border rounded-xl px-3 py-2 text-sm">{p.nombre} · {p.programa} · {p.asistencias} asistencias confirmadas · {p.caracterizacion}</li>
        ))}
      </ul>
    </Marco>
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
      <form onSubmit={buscar} className="bg-white border rounded-2xl p-4 flex flex-wrap gap-2 mb-6">
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
              <li key={f.id} className="bg-white border rounded-xl px-3 py-2 text-sm flex justify-between gap-2">
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
            <article key={f.id} className="bg-white border rounded-2xl p-3">
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
      <ul className="list-none m-0 p-0 grid gap-2">
        {lista.map((p) => (
          <li key={p.email} className="bg-white border rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
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
