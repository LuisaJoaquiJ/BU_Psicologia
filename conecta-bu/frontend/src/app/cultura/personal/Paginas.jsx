import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { DIAS, horarioTexto, mensajeError } from "../comun/formato";

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

export function InicioPersonal() {
  const [grupos, setGrupos] = useState([]);
  const [eventos, setEventos] = useState([]);
  useEffect(() => {
    http.get("/cultura/admin/grupos").then((r) => setGrupos(r.data)).catch(() => {});
    http.get("/cultura/admin/agenda").then((r) => setEventos(r.data)).catch(() => {});
  }, []);
  const inscritos = grupos.reduce((s, g) => s + (g.inscritos?.length || 0), 0);
  return (
    <Marco titulo="Panel de Arte y Cultura" texto="Publica grupos del periodo, la agenda y las convocatorias. La asistencia guarda usuario, hora e IP. El Excel sirve de apoyo al informe SNIES.">
      <button
        type="button"
        className="boton-liquido min-h-[44px] px-5 rounded-full font-bold mb-6"
        onClick={async () => {
          const r = await http.get("/cultura/admin/informe", { responseType: "blob" });
          const url = URL.createObjectURL(r.data);
          const a = document.createElement("a");
          a.href = url;
          a.download = "SNIES-cultura.xlsx";
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Descargar informe SNIES
      </button>
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="bg-white border rounded-2xl p-5">
          <p className="m-0 text-sm text-ink-500">Grupos</p>
          <p className="m-0 text-2xl font-extrabold">{grupos.length}</p>
        </article>
        <article className="bg-white border rounded-2xl p-5">
          <p className="m-0 text-sm text-ink-500">Inscripciones activas</p>
          <p className="m-0 text-2xl font-extrabold">{inscritos}</p>
        </article>
        <article className="bg-white border rounded-2xl p-5">
          <p className="m-0 text-sm text-ink-500">Eventos</p>
          <p className="m-0 text-2xl font-extrabold">{eventos.length}</p>
        </article>
      </div>
    </Marco>
  );
}

export function GruposPersonal() {
  const [areas, setAreas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [form, setForm] = useState({ areaId: "", nombre: "", director: "", lugar: "", cupo: 20, inicio: "14:00", fin: "16:00", dias: [2, 4] });
  const [asistencia, setAsistencia] = useState({});
  function cargar() {
    http.get("/cultura/admin/areas").then((r) => {
      setAreas(r.data);
      setForm((f) => ({ ...f, areaId: f.areaId || r.data[0]?.id || "" }));
    }).catch(() => setError("No fue posible cargar las áreas."));
    http.get("/cultura/admin/grupos").then((r) => setGrupos(r.data)).catch(() => setError("No fue posible cargar los grupos."));
  }
  useEffect(cargar, []);

  function cambiarDia(dia) {
    setForm((f) => ({ ...f, dias: f.dias.includes(dia) ? f.dias.filter((d) => d !== dia) : [...f.dias, dia] }));
  }

  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/grupos", {
        areaId: form.areaId,
        nombre: form.nombre,
        director: form.director,
        lugar: form.lugar,
        cupo: Number(form.cupo),
        horario: [...form.dias].sort().map((dia) => ({ dia, inicio: form.inicio, fin: form.fin })),
      });
      setForm({ ...form, nombre: "", director: "", lugar: "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible crear el grupo."));
    }
  }

  async function guardarAsistencia(grupo) {
    const marca = asistencia[grupo.id] || { fecha: new Date().toISOString().slice(0, 10), presentes: [] };
    setError("");
    try {
      await http.post(`/cultura/admin/grupos/${grupo.id}/asistencia`, marca);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar la asistencia."));
    }
  }

  return (
    <Marco titulo="Grupos artísticos" texto="Cada grupo pertenece a un área y a un periodo. El estudiante se inscribe si hay cupo y el horario no se cruza.">
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <form onSubmit={crear} className="bg-white border rounded-2xl p-4 grid gap-3 sm:grid-cols-2 mb-8">
        <label className="text-sm font-semibold">
          Área
          <select className={`${campo} w-full mt-1`} value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Nombre
          <input className={`${campo} w-full mt-1`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
        </label>
        <label className="text-sm font-semibold">
          Director
          <input className={`${campo} w-full mt-1`} value={form.director} onChange={(e) => setForm({ ...form, director: e.target.value })} />
        </label>
        <label className="text-sm font-semibold">
          Lugar
          <input className={`${campo} w-full mt-1`} value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} />
        </label>
        <label className="text-sm font-semibold">
          Cupo
          <input type="number" min="1" className={`${campo} w-full mt-1`} value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value })} />
        </label>
        <div className="flex gap-2">
          <label className="text-sm font-semibold flex-1">
            Inicio
            <input type="time" className={`${campo} w-full mt-1`} value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
          </label>
          <label className="text-sm font-semibold flex-1">
            Fin
            <input type="time" className={`${campo} w-full mt-1`} value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} />
          </label>
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {DIAS.slice(1).map((nombre, i) => (
            <label key={nombre} className="text-sm inline-flex items-center gap-1">
              <input type="checkbox" checked={form.dias.includes(i + 1)} onChange={() => cambiarDia(i + 1)} />
              {nombre}
            </label>
          ))}
        </div>
        <button type="submit" className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">
          Publicar grupo
        </button>
      </form>
      <div className="grid gap-4">
        {grupos.map((grupo) => {
          const marca = asistencia[grupo.id] || { fecha: new Date().toISOString().slice(0, 10), presentes: [] };
          return (
            <article key={grupo.id} className="bg-white border rounded-2xl p-4">
              <h2 className="m-0 font-extrabold">{grupo.nombre}</h2>
              <p className="m-0 mt-1 text-sm text-ink-500">
                {grupo.area} · {grupo.periodo} · {horarioTexto(grupo.horario)} · {grupo.inscritos.length} inscritos
              </p>
              {grupo.inscritos.length > 0 && (
                <div className="mt-3">
                  <label className="text-sm font-semibold">
                    Fecha de asistencia
                    <input type="date" className={`${campo} ml-2`} value={marca.fecha} onChange={(e) => setAsistencia({ ...asistencia, [grupo.id]: { ...marca, fecha: e.target.value } })} />
                  </label>
                  <ul className="list-none m-0 mt-2 p-0 flex flex-col gap-1">
                    {grupo.inscritos.map((p) => (
                      <li key={p.usuarioId}>
                        <label className="text-sm inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={marca.presentes.includes(p.usuarioId)}
                            onChange={() => {
                              const presentes = marca.presentes.includes(p.usuarioId) ? marca.presentes.filter((id) => id !== p.usuarioId) : [...marca.presentes, p.usuarioId];
                              setAsistencia({ ...asistencia, [grupo.id]: { ...marca, presentes } });
                            }}
                          />
                          {p.nombre} · {p.email}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => guardarAsistencia(grupo)} className="mt-3 min-h-[40px] px-4 rounded-full border font-bold">
                    Guardar asistencia
                  </button>
                  <label className="mt-3 flex flex-col gap-1 text-sm font-semibold">
                    Planilla física (JPG, PNG, WEBP o PDF)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={async (e) => {
                        const archivo = e.target.files?.[0];
                        if (!archivo) return;
                        const datos = new FormData();
                        datos.append("evidencia", archivo);
                        datos.append("grupoId", grupo.id);
                        setError("");
                        setAviso("");
                        try {
                          await http.post("/cultura/admin/evidencias", datos);
                          setAviso("Quedó guardada la planilla como evidencia.");
                        } catch (err) {
                          setError(mensajeError(err, "No fue posible subir la planilla."));
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </Marco>
  );
}

export function AgendaPersonal() {
  const [eventos, setEventos] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", descripcion: "", fecha: "", horaInicio: "18:00", horaFin: "20:00", lugar: "", cupo: 40, fechaLimite: "", estado: "Publicado" });
  function cargar() {
    http.get("/cultura/admin/agenda").then((r) => setEventos(r.data)).catch(() => setError("No fue posible cargar la agenda."));
  }
  useEffect(cargar, []);
  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/agenda", { ...form, cupo: Number(form.cupo) });
      setForm({ ...form, nombre: "", descripcion: "", lugar: "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible publicar el evento."));
    }
  }
  return (
    <Marco titulo="Agenda cultural" texto="Un evento en borrador no lo ve el estudiante. Al publicarlo puede inscribirse hasta la fecha límite.">
      {error && <Aviso>{error}</Aviso>}
      <form onSubmit={crear} className="bg-white border rounded-2xl p-4 grid gap-3 sm:grid-cols-2 mb-8">
        <label className="text-sm font-semibold sm:col-span-2">
          Nombre
          <input className={`${campo} w-full mt-1`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Descripción
          <textarea className={`${campo} w-full mt-1`} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </label>
        <label className="text-sm font-semibold">Fecha<input type="date" className={`${campo} w-full mt-1`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Límite de inscripción<input type="date" className={`${campo} w-full mt-1`} value={form.fechaLimite} onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Inicio<input type="time" className={`${campo} w-full mt-1`} value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} /></label>
        <label className="text-sm font-semibold">Fin<input type="time" className={`${campo} w-full mt-1`} value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} /></label>
        <label className="text-sm font-semibold">Lugar<input className={`${campo} w-full mt-1`} value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} /></label>
        <label className="text-sm font-semibold">Cupo<input type="number" min="1" className={`${campo} w-full mt-1`} value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value })} /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Publicar en la agenda</button>
      </form>
      <ul className="list-none m-0 p-0 grid gap-2">
        {eventos.map((e) => (
          <li key={e.id} className="bg-white border rounded-2xl px-4 py-3">
            <strong>{e.nombre}</strong>
            <span className="text-sm text-ink-500"> · {e.fecha} · {e.horaInicio}–{e.horaFin}{e.lugar ? ` · ${e.lugar}` : ""} · {e.estado} · {e.inscritos} inscritos</span>
            {e.descripcion && <p className="m-0 mt-1 text-sm text-ink-500">{e.descripcion}</p>}
          </li>
        ))}
      </ul>
    </Marco>
  );
}

export function ConvocatoriasPersonal() {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ titulo: "", descripcion: "", cierra: "", cupo: "" });
  function cargar() {
    http.get("/cultura/admin/convocatorias").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar las convocatorias."));
  }
  useEffect(cargar, []);
  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/convocatorias", { ...form, cupo: form.cupo === "" ? null : Number(form.cupo) });
      setForm({ titulo: "", descripcion: "", cierra: "", cupo: "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible crear la convocatoria."));
    }
  }
  async function resolver(id, estado) {
    setError("");
    try {
      await http.patch(`/cultura/admin/postulaciones/${id}`, { estado });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible actualizar la postulación."));
    }
  }
  return (
    <Marco titulo="Convocatorias" texto="Quien se postula queda en estado Recibida hasta que el área acepte o rechace.">
      {error && <Aviso>{error}</Aviso>}
      <form onSubmit={crear} className="bg-white border rounded-2xl p-4 grid gap-3 mb-8">
        <label className="text-sm font-semibold">Título<input className={`${campo} w-full mt-1`} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Descripción<textarea className={`${campo} w-full mt-1`} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></label>
        <label className="text-sm font-semibold">Cierra<input type="date" className={`${campo} w-full mt-1`} value={form.cierra} onChange={(e) => setForm({ ...form, cierra: e.target.value })} required /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Abrir convocatoria</button>
      </form>
      <div className="grid gap-4">
        {lista.map((c) => (
          <article key={c.id} className="bg-white border rounded-2xl p-4">
            <h2 className="m-0 font-extrabold">{c.titulo}</h2>
            <p className="m-0 text-sm text-ink-500">Cierra {c.cierra} · {c.estado}</p>
            <ul className="list-none m-0 mt-3 p-0 flex flex-col gap-2">
              {c.postulaciones.map((p) => (
                <li key={p.id} className="border rounded-xl p-3">
                  <p className="m-0 font-bold">{p.nombre} · {p.estado}</p>
                  <p className="m-0 text-sm">{p.motivacion}</p>
                  {p.estado === "Recibida" && (
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => resolver(p.id, "Aceptada")} className="min-h-[40px] px-3 rounded-full border font-bold">Aceptar</button>
                      <button type="button" onClick={() => resolver(p.id, "Rechazada")} className="min-h-[40px] px-3 rounded-full border font-bold">Rechazar</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Marco>
  );
}
