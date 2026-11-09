import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { DIAS, horarioTexto, hoyISO, mensajeError } from "../comun/formato";
import { ControlAsistencia } from "./ControlAsistencia";
import { useRolCultura } from "./rol";
import { useAuth } from "../../../lib/auth/AuthContext";
import { ResponsablesEvento } from "./ResponsablesEvento";
import { ResponsablesGrupo } from "./ResponsablesGrupo";
import { SelectorUbicacion } from "./SelectorUbicacion";
import { CampoLugar } from "./CampoLugar";
import { FotoEvento } from "./FotoEvento";
import { IMAGENES } from "../../../lib/imagenes";
import { Aviso, Desplegable, Filtros, Marco, ResumenTipos, SinResultados, campo, coincide, opcionesDe, useVentana } from "./Marco";

// Horario de un grupo: cada dia marcado lleva su propia hora de inicio y fin.
const HORARIO_INICIAL = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, { activo: d === 2 || d === 4, inicio: "14:00", fin: "16:00" }]));
const horarioDe = (franjas) =>
  Object.entries(franjas)
    .filter(([, f]) => f.activo)
    .map(([dia, f]) => ({ dia: Number(dia), inicio: f.inicio, fin: f.fin }))
    .sort((a, b) => a.dia - b.dia);

function HorarioPorDia({ valor, alCambiar }) {
  const cambiar = (dia, cambios) => alCambiar({ ...valor, [dia]: { ...valor[dia], ...cambios } });
  return (
    <fieldset className="sm:col-span-2 m-0 p-0 border-0">
      <legend className="text-sm font-semibold mb-1">Horario</legend>
      <p className="m-0 mb-2 text-sm text-ink-500">Marca los días y ponle a cada uno su hora. Si un día es distinto, cámbiale solo ese.</p>
      <ul className="list-none m-0 p-0 grid gap-1.5">
        {DIAS.slice(1).map((nombre, i) => {
          const dia = i + 1;
          const f = valor[dia];
          return (
            <li key={nombre} className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-1.5 ${f.activo ? "bg-white/80" : ""}`}>
              <label className="text-sm inline-flex items-center gap-2 w-[120px] min-h-[40px] cursor-pointer">
                <input type="checkbox" checked={f.activo} onChange={() => cambiar(dia, { activo: !f.activo })} className="w-4 h-4 accent-primary" />
                {nombre}
              </label>
              {f.activo && (
                <span className="inline-flex items-center gap-2 text-sm">
                  <input type="time" aria-label={`Inicio del ${nombre}`} className={`${campo} w-[130px]`} value={f.inicio} onChange={(e) => cambiar(dia, { inicio: e.target.value })} />
                  a
                  <input type="time" aria-label={`Fin del ${nombre}`} className={`${campo} w-[130px]`} value={f.fin} onChange={(e) => cambiar(dia, { fin: e.target.value })} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

// Casilla del SNIES con el codigo y la cedula; si no se reporta, se ocultan.
function CamposSnies({ form, setForm, ayudaInterno }) {
  return (
    <>
      <label className="sm:col-span-2 text-sm font-semibold inline-flex items-center gap-2 min-h-[40px] cursor-pointer">
        <input type="checkbox" checked={form.reportaSnies} onChange={(e) => setForm({ ...form, reportaSnies: e.target.checked })} className="w-4 h-4 accent-primary" />
        Se reporta al SNIES
      </label>
      {form.reportaSnies ? (
        <>
          <label className="text-sm font-semibold">
            Código SNIES de la actividad
            <input className={`${campo} w-full mt-1`} value={form.codigoSnies} onChange={(e) => setForm({ ...form, codigoSnies: e.target.value })} />
          </label>
          <label className="text-sm font-semibold">
            Cédula del responsable
            <input className={`${campo} w-full mt-1`} value={form.documentoResponsable} onChange={(e) => setForm({ ...form, documentoResponsable: e.target.value })} />
          </label>
        </>
      ) : (
        <p className="m-0 sm:col-span-2 text-sm rounded-xl bg-primary-light/70 text-primary-dark px-4 py-3">{ayudaInterno}</p>
      )}
    </>
  );
}

const fechaCorta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

export function GruposPersonal() {
  const rol = useRolCultura();
  const esAdmin = rol === "administrador";
  const { usuario } = useAuth();
  const miCorreo = String(usuario?.emailInstitucional || "").toLowerCase();
  const [equipo, setEquipo] = useState([]);
  const nuevo = useVentana();
  const [buscar, setBuscar] = useState("");
  const [area, setArea] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [estado, setEstado] = useState("");
  const limpiar = () => {
    setBuscar("");
    setArea("");
    setPeriodo("");
    setEstado("");
  };
  const [areas, setAreas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [hallados, setHallados] = useState([]);
  const [form, setForm] = useState({ areaId: "", nombre: "", director: "", docenteEmail: miCorreo, monitoresEmails: [], lugar: "", cupo: 20, franjas: HORARIO_INICIAL, fechaInicio: "", fechaFin: "", reportaSnies: true, codigoSnies: "", documentoResponsable: "" });
  const [asistencia, setAsistencia] = useState({});
  function cargar() {
    http.get("/cultura/admin/areas").then((r) => {
      // Un grupo pertenece a un taller o a un grupo representativo; las fechas
      // especiales, las pausas y la promocion se registran en sus propias paginas.
      const deGrupos = r.data.filter((a) => a.categoria === "taller" || a.categoria === "representativo");
      setAreas(deGrupos);
      setForm((f) => ({ ...f, areaId: deGrupos.some((a) => a.id === f.areaId) ? f.areaId : deGrupos[0]?.id || "" }));
    }).catch(() => setError("No fue posible cargar las áreas."));
    http.get("/cultura/admin/grupos").then((r) => setGrupos(r.data)).catch(() => setError("No fue posible cargar los grupos."));
    if (esAdmin) http.get("/cultura/admin/equipo").then((r) => setEquipo(r.data)).catch(() => {});
  }
  useEffect(cargar, []);

  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      const docente = equipo.find((m) => m.email === form.docenteEmail);
      if (!form.docenteEmail && form.monitoresEmails.length === 0) {
        setError("Elige al menos una persona a cargo del grupo.");
        return;
      }
      await http.post("/cultura/admin/grupos", {
        areaId: form.areaId,
        nombre: form.nombre,
        director: docente?.nombre || form.director,
        docenteEmail: form.docenteEmail || null,
        monitoresEmails: form.monitoresEmails,
        lugar: form.lugar,
        cupo: Number(form.cupo),
        horario: horarioDe(form.franjas),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        reportaSnies: form.reportaSnies,
        codigoSnies: form.reportaSnies ? form.codigoSnies : "",
        documentoResponsable: form.reportaSnies ? form.documentoResponsable : "",
      });
      setAviso(`Quedó publicado ${form.nombre}.`);
      nuevo.cerrar();
      setForm({ ...form, nombre: "", director: "", docenteEmail: miCorreo, monitoresEmails: [], lugar: "", fechaInicio: "", fechaFin: "", codigoSnies: "", documentoResponsable: "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible crear el grupo."));
    }
  }

  async function editar(grupo, cambios, listo) {
    setError("");
    setAviso("");
    try {
      await http.patch(`/cultura/admin/grupos/${grupo.id}`, cambios);
      if (listo) setAviso(listo);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible actualizar el grupo."));
    }
  }

  async function guardarAsistencia(grupo) {
    const marca = asistencia[grupo.id] || { fecha: hoyISO(), presentes: [] };
    setError("");
    try {
      await http.post(`/cultura/admin/grupos/${grupo.id}/asistencia`, marca);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar la asistencia."));
    }
  }

  const gruposVisibles = grupos.filter(
    (g) =>
      coincide(buscar, g.nombre, g.area, g.director, g.lugar) &&
      (!area || g.area === area) &&
      (!periodo || g.periodo === periodo) &&
      (!estado ||
        (estado === "abiertas" && g.inscripcionesAbiertas) ||
        (estado === "cerradas" && !g.inscripcionesAbiertas) ||
        (estado === "cupos" && g.inscritos.length < g.cupo) ||
        (estado === "llenos" && g.inscritos.length >= g.cupo))
  );
  return (
    <Marco titulo="Grupos artísticos" texto="Cada grupo pertenece a un área y a un periodo. El estudiante se inscribe si hay cupo y el horario no se cruza.">
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <form
        className="flex flex-wrap items-center gap-2 mb-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const r = await http.get("/cultura/admin/inscritos", { params: { q: busqueda } });
            setHallados(r.data);
          } catch (err) {
            setError(mensajeError(err, "No fue posible buscar."));
          }
        }}
      >
        <input aria-label="Buscar inscrito por cédula, correo o nombre" className="min-h-[42px] rounded-full bg-white/90 border border-white px-4 text-sm text-ink-900 placeholder:text-ink-400 shadow-[0_4px_14px_-8px_rgba(11,35,71,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 flex-[1_1_200px] max-w-[320px]" placeholder="Buscar inscrito" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <button className="min-h-[42px] px-4 rounded-full bg-white/90 border border-white text-primary-dark font-bold text-sm hover:bg-white">Buscar</button>
      </form>
      {hallados.length > 0 && (
        <ul className="list-none m-0 mb-6 p-0 grid gap-1">
          {hallados.map((p) => (
            <li key={p.usuarioId} className="text-sm burbuja rounded-xl px-3 py-2">{p.nombre} · {p.email} · {p.documento || "sin cédula"} · {p.programa || "sin programa"}</li>
          ))}
        </ul>
      )}
      <Desplegable titulo="Publicar un grupo o taller" boton="Nuevo grupo" control={nuevo} error={error} visible={esAdmin}>
      <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Área
          <select className={`${campo} w-full mt-1`} value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
            {[["taller", "Talleres de formación"], ["representativo", "Grupos representativos"]].map(([categoria, etiqueta]) => (
              <optgroup key={categoria} label={etiqueta}>
                {areas.filter((a) => a.categoria === categoria).map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Nombre
          <input className={`${campo} w-full mt-1`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
        </label>
        <label className="text-sm font-semibold">
          Quién dirige el grupo
          <select className={`${campo} w-full mt-1`} value={form.docenteEmail} onChange={(e) => setForm({ ...form, docenteEmail: e.target.value })}>
            <option value="">Nadie (deben ayudar otras personas)</option>
            {equipo.filter((m) => m.rol === "docente" || m.rol === "administrador").map((m) => (
              <option key={m.email} value={m.email}>
                {m.nombre || m.email} · {m.rol === "administrador" ? "Coordinación" : "Docente"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Lugar
          <input className={`${campo} w-full mt-1`} value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} />
        </label>
        {equipo.some((m) => (m.rol === "monitor" || m.rol === "docente") && m.email !== form.docenteEmail) && (
          <fieldset className="sm:col-span-2 m-0 p-0 border-0">
            <legend className="text-sm font-semibold mb-1">Quiénes ayudan (opcional)</legend>
            <ul className="list-none m-0 p-0 flex flex-wrap gap-x-4 gap-y-1">
              {equipo.filter((m) => (m.rol === "monitor" || m.rol === "docente") && m.email !== form.docenteEmail).map((m) => (
                <li key={m.email}>
                  <label className="inline-flex items-center gap-2 min-h-[36px] text-sm">
                    <input type="checkbox" checked={form.monitoresEmails.includes(m.email)} onChange={() => setForm((f) => ({ ...f, monitoresEmails: f.monitoresEmails.includes(m.email) ? f.monitoresEmails.filter((x) => x !== m.email) : [...f.monitoresEmails, m.email] }))} />
                    {m.nombre || m.email}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        <label className="text-sm font-semibold">
          Cupo
          <input type="number" min="1" className={`${campo} w-full mt-1`} value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value })} />
        </label>
        <div className="flex gap-2">
          <label className="text-sm font-semibold flex-1">
            Desde <span className="font-normal text-ink-500">(opcional)</span>
            <input type="date" className={`${campo} w-full mt-1`} value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
          </label>
          <label className="text-sm font-semibold flex-1">
            Hasta <span className="font-normal text-ink-500">(opcional)</span>
            <input type="date" min={form.fechaInicio || undefined} className={`${campo} w-full mt-1`} value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
          </label>
        </div>
        <p className="m-0 sm:col-span-2 -mt-1 text-sm text-ink-500">Deja las fechas vacías si el taller dura todo el periodo.</p>
        <HorarioPorDia valor={form.franjas} alCambiar={(franjas) => setForm({ ...form, franjas })} />
        <CamposSnies form={form} setForm={setForm} ayudaInterno="Actividad interna: no sale en el informe SNIES. La asistencia sí cuenta en el informe de gestión, el histórico y el registro calificado." />
        <button type="submit" disabled={!horarioDe(form.franjas).length} className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit disabled:opacity-60">
          Publicar grupo
        </button>
      </form>
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar grupo"
        selectores={[
          { etiqueta: "Área", valor: area, alCambiar: setArea, opciones: [["", "Todas"], ...opcionesDe(grupos, "area").map((a) => [a, a])] },
          { etiqueta: "Periodo", valor: periodo, alCambiar: setPeriodo, opciones: [["", "Todos"], ...opcionesDe(grupos, "periodo").map((p) => [p, p])] },
        ]}
        pastillas={[{ etiqueta: "Inscripciones", valor: estado, alCambiar: setEstado, opciones: [["", "Todos"], ["abiertas", "Abiertas"], ["cerradas", "Cerradas"], ["cupos", "Con cupo"], ["llenos", "Llenos"]] }]}
        total={grupos.length}
        visibles={gruposVisibles.length}
        alLimpiar={limpiar}
      />
      <div className="grid gap-4">
        {gruposVisibles.length === 0 && <SinResultados hayDatos={grupos.length > 0} vacio="Todavía no hay grupos. Publica el primero con el botón Nuevo grupo." alLimpiar={limpiar} />}
        {gruposVisibles.map((grupo) => {
          const marca = asistencia[grupo.id] || { fecha: hoyISO(), presentes: [] };
          return (
            <article key={grupo.id} className="vidrio-panel rounded-[22px] p-4 flex flex-col sm:flex-row gap-4">
              <FotoEvento evento={grupo} ruta={`/cultura/admin/grupos/${grupo.id}/imagen`} respaldo={grupo.area?.toLowerCase().includes("danza") ? IMAGENES.integracion : IMAGENES.auditorio} alCambiar={cargar} />
              <div className="min-w-0 flex-1">
              <h2 className="m-0 font-extrabold">{grupo.nombre}</h2>
              <p className="m-0 mt-1 text-sm text-ink-500">
                {grupo.area} · {grupo.periodo} · {horarioTexto(grupo.horario)}
                {grupo.fechaInicio || grupo.fechaFin ? ` · ${grupo.fechaInicio ? `del ${fechaCorta(String(grupo.fechaInicio).slice(0, 10))}` : ""}${grupo.fechaFin ? ` al ${fechaCorta(String(grupo.fechaFin).slice(0, 10))}` : ""}` : ""}
                {` · ${grupo.inscritos.length} de ${grupo.cupo} cupos`}
                {grupo.reportaSnies !== false && grupo.codigoSnies ? ` · SNIES ${grupo.codigoSnies}` : ""}
              </p>
              {grupo.reportaSnies === false && <span className="inline-block mt-2 text-xs font-bold rounded-full px-2.5 py-1 bg-gray-100 text-ink-600">No se reporta al SNIES</span>}
              <ResumenTipos porTipo={grupo.porTipo} />
              <div className={`mt-3 flex-wrap items-center gap-2 ${esAdmin ? "flex" : "hidden"}`}>
                <button
                  type="button"
                  onClick={() => editar(grupo, { inscripcionesAbiertas: !grupo.inscripcionesAbiertas }, grupo.inscripcionesAbiertas ? "Se cerraron las inscripciones." : "Se abrieron las inscripciones.")}
                  className="min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm"
                >
                  {grupo.inscripcionesAbiertas ? "Cerrar inscripciones" : "Abrir inscripciones"}
                </button>
                <label className="text-sm font-semibold inline-flex items-center gap-2">
                  Cupo
                  <input
                    type="number"
                    min="1"
                    defaultValue={grupo.cupo}
                    onBlur={(e) => Number(e.target.value) !== grupo.cupo && editar(grupo, { cupo: Number(e.target.value) }, "Cupo actualizado.")}
                    className={`${campo} w-24`}
                  />
                </label>
              </div>
              <ControlAsistencia ruta={`/cultura/admin/grupos/${grupo.id}`} fecha={marca.fecha} horario={grupo.horario || []} fechaInicio={grupo.fechaInicio} fechaFin={grupo.fechaFin} ubicacion={grupo} alCambiar={cargar} evidencia={{ grupoId: grupo.id }} puedeUbicar={rol !== "monitor"} puedeEvidencia={rol !== "monitor"} />
              {esAdmin && <ResponsablesGrupo grupo={grupo} equipo={equipo} alGuardar={cargar} />}
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
                  <button type="button" onClick={() => guardarAsistencia(grupo)} className="mt-3 min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold">
                    Guardar asistencia
                  </button>
                </div>
              )}
              </div>
            </article>
          );
        })}
      </div>
    </Marco>
  );
}

export function AgendaPersonal() {
  const rol = useRolCultura();
  const esAdmin = rol === "administrador";
  const { usuario } = useAuth();
  const miCorreo = String(usuario?.emailInstitucional || "").toLowerCase();
  const [equipo, setEquipo] = useState([]);
  const nuevo = useVentana();
  const [buscar, setBuscar] = useState("");
  const [cuando, setCuando] = useState("proximos");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [categoria, setCategoria] = useState("");
  const limpiar = () => {
    setBuscar("");
    setCuando("proximos");
    setEstadoFiltro("");
    setCategoria("");
  };
  const [eventos, setEventos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [grupos, setGrupos] = useState([]);
  const [form, setForm] = useState({ nombre: "", descripcion: "", representacion: "", categoria: "especial", grupoId: "", fecha: "", horaInicio: "18:00", horaFin: "20:00", lugar: "", cupo: 40, fechaLimite: "", estado: "Publicado", reportaSnies: true, codigoSnies: "", documentoResponsable: "", latitud: null, longitud: null, radioM: 100, responsablesEmails: [] });
  function cargar() {
    http.get("/cultura/admin/agenda").then((r) => setEventos(r.data)).catch(() => setError("No fue posible cargar la agenda."));
    if (esAdmin) http.get("/cultura/admin/equipo").then((r) => setEquipo(r.data)).catch(() => {});
    http.get("/cultura/admin/grupos").then((r) => setGrupos(r.data)).catch(() => {});
  }
  async function cambiarEstado(e) {
    setError("");
    setAviso("");
    try {
      await http.patch(`/cultura/admin/agenda/${e.id}`, { estado: e.estado === "Publicado" ? "Borrador" : "Publicado" });
      setAviso(e.estado === "Publicado" ? `${e.nombre} pasó a borrador.` : `${e.nombre} quedó publicado.`);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible cambiar el estado."));
    }
  }
  useEffect(cargar, []);
  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/agenda", {
        ...form,
        fechaLimite: form.fechaLimite || form.fecha,
        cupo: Number(form.cupo),
        codigoSnies: form.reportaSnies ? form.codigoSnies : "",
        documentoResponsable: form.reportaSnies ? form.documentoResponsable : "",
      });
      setAviso(`Quedó en la agenda: ${form.nombre}.`);
      nuevo.cerrar();
      setForm({ ...form, nombre: "", descripcion: "", lugar: "", representacion: "", codigoSnies: "", latitud: null, longitud: null, responsablesEmails: [] });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible publicar el evento."));
    }
  }
  const hoy = hoyISO();
  const eventosVisibles = eventos.filter(
    (e) =>
      coincide(buscar, e.nombre, e.lugar, e.descripcion, e.representacion) &&
      (cuando === "todos" || (cuando === "proximos" ? e.fecha >= hoy : e.fecha < hoy)) &&
      (!estadoFiltro || e.estado === estadoFiltro) &&
      (!categoria || e.categoria === categoria)
  );
  return (
    <Marco titulo="Agenda cultural" texto="Un evento en borrador no lo ve el estudiante. Al publicarlo puede inscribirse hasta la fecha límite.">
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <Desplegable titulo="Publicar un evento" boton="Nuevo evento" control={nuevo} error={error} visible={esAdmin}>
      <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">
          Nombre
          <input className={`${campo} w-full mt-1`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Descripción
          <textarea className={`${campo} w-full mt-1`} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Representación artística
          <input className={`${campo} w-full mt-1`} placeholder="Ej. Museo de Changó, grupo de teatro" value={form.representacion} onChange={(e) => setForm({ ...form, representacion: e.target.value })} />
        </label>
        <label className="text-sm font-semibold">
          Tipo de actividad
          <select className={`${campo} w-full mt-1`} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value, reportaSnies: e.target.value !== "promocion" })}>
            <option value="especial">Fecha especial</option>
            <option value="promocion">Evento interno o promoción</option>
            <option value="representativo">Presentación de un grupo representativo</option>
            <option value="taller">Muestra de taller</option>
            <option value="itinerante">Arte itinerante</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Grupo que se presenta
          <select className={`${campo} w-full mt-1`} value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })}>
            <option value="">Ninguno</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
        </label>
        <CamposSnies form={form} setForm={setForm} ayudaInterno="Evento interno (por ejemplo, una promoción que pide Mercadeo): no sale en el informe SNIES. La asistencia sí cuenta en el informe de gestión y el histórico." />
        <p className="m-0 sm:col-span-2 text-sm text-ink-500">Para otra franja del mismo día, publica otro evento con su hora de inicio y fin. Si dejas vacío el límite de inscripción, es el mismo día del evento.</p>
        <label className="text-sm font-semibold">Fecha<input type="date" className={`${campo} w-full mt-1`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Límite de inscripción<input type="date" className={`${campo} w-full mt-1`} value={form.fechaLimite} onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} /></label>
        <label className="text-sm font-semibold">Inicio<input type="time" className={`${campo} w-full mt-1`} value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} /></label>
        <label className="text-sm font-semibold">Fin<input type="time" className={`${campo} w-full mt-1`} value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} /></label>
        <CampoLugar valor={form.lugar} alCambiar={(lugar) => setForm((f) => ({ ...f, lugar }))} alElegir={(r) => setForm((f) => ({ ...f, lugar: r.nombre, latitud: r.latitud, longitud: r.longitud }))} />
        <label className="text-sm font-semibold">Cupo<input type="number" min="1" className={`${campo} w-full mt-1`} value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value })} /></label>
        <fieldset className="sm:col-span-2 m-0 p-0 border-0">
          <legend className="text-sm font-semibold mb-1">A cargo del evento (opcional)</legend>
          <ul className="list-none m-0 p-0 flex flex-wrap gap-x-4 gap-y-1">
            {equipo.map((m) => (
              <li key={m.email}>
                <label className="inline-flex items-center gap-2 min-h-[36px] text-sm">
                  <input type="checkbox" checked={form.responsablesEmails.includes(m.email)} onChange={() => setForm((f) => ({ ...f, responsablesEmails: f.responsablesEmails.includes(m.email) ? f.responsablesEmails.filter((x) => x !== m.email) : [...f.responsablesEmails, m.email] }))} />
                  {m.nombre || m.email} <span className="text-ink-500">· {m.rol === "administrador" ? "Coordinación" : m.rol === "docente" ? "Docente" : "Monitor"}</span>
                </label>
              </li>
            ))}
          </ul>
          <span className="block mt-1 text-[13px] text-ink-500">Quienes elijas podrán tomar la asistencia del evento. Si no eliges a nadie, lo maneja la coordinación. Si es de un grupo, también cuenta el equipo del grupo.</span>
        </fieldset>
        <div className="sm:col-span-2">
          <p className="m-0 mb-1 text-sm font-semibold">Dónde se toma la asistencia</p>
          <SelectorUbicacion valor={{ latitud: form.latitud, longitud: form.longitud, radioM: form.radioM }} alCambiar={(u) => setForm((f) => ({ ...f, ...u }))} />
        </div>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Publicar en la agenda</button>
      </form>
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar evento"
        selectores={[
          {
            etiqueta: "Tipo",
            valor: categoria,
            alCambiar: setCategoria,
            opciones: [["", "Todos"], ["especial", "Fecha especial"], ["promocion", "Evento interno"], ["representativo", "Grupo representativo"], ["taller", "Muestra de taller"], ["itinerante", "Arte itinerante"]],
          },
        ]}
        pastillas={[
          { etiqueta: "Cuándo", valor: cuando, alCambiar: setCuando, opciones: [["proximos", "Próximos"], ["pasados", "Pasados"], ["todos", "Todos"]] },
          { etiqueta: "Estado", valor: estadoFiltro, alCambiar: setEstadoFiltro, opciones: [["", "Todos"], ["Publicado", "Publicados"], ["Borrador", "Borradores"]] },
        ]}
        total={eventos.length}
        visibles={eventosVisibles.length}
        alLimpiar={limpiar}
      />
      <ul className="list-none m-0 p-0 grid gap-2">
        {eventosVisibles.length === 0 && <SinResultados hayDatos={eventos.length > 0} vacio="Todavía no hay eventos. Publica el primero con el botón Nuevo evento." alLimpiar={limpiar} />}
        {eventosVisibles.map((e) => (
          <li key={e.id} className="vidrio-panel rounded-[22px] px-4 py-3 flex flex-col sm:flex-row gap-4">
            <FotoEvento evento={e} alCambiar={cargar} />
            <div className="min-w-0 flex-1">
            <strong>{e.nombre}</strong>
            <span className="text-sm text-ink-500"> · {e.fecha} · {e.horaInicio}–{e.horaFin}{e.lugar ? ` · ${e.lugar}` : ""} · {e.inscritos} de {e.cupo} cupos · {e.asistentes} asistieron</span>
            {e.descripcion && <p className="m-0 mt-1 text-sm text-ink-500">{e.descripcion}</p>}
            <ResumenTipos porTipo={e.porTipo} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`text-xs font-bold rounded-md px-2 py-0.5 select-none cursor-default ${e.estado === "Publicado" ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-ink-600"}`}>{e.estado}</span>
              {e.reportaSnies === false && <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-gray-100 text-ink-600">No se reporta al SNIES</span>}
              <button type="button" onClick={() => cambiarEstado(e)} className={`min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm ${esAdmin ? "" : "hidden"}`}>
                {e.estado === "Publicado" ? "Pasar a borrador" : "Publicar"}
              </button>
            </div>
            {e.puedeOperar !== false && <ControlAsistencia ruta={`/cultura/admin/agenda/${e.id}`} fecha={e.fecha} horaInicio={e.horaInicio} horaFin={e.horaFin} ubicacion={e} alCambiar={cargar} evidencia={{ eventoId: e.id }} puedeUbicar={esAdmin} puedeEvidencia={rol !== "monitor"} />}
            {esAdmin && <ResponsablesEvento evento={e} equipo={equipo} alGuardar={cargar} />}
            </div>
          </li>
        ))}
      </ul>
    </Marco>
  );
}

export function ConvocatoriasPersonal() {
  const rol = useRolCultura();
  const esAdmin = rol === "administrador";
  const nuevo = useVentana();
  const [buscar, setBuscar] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const limpiar = () => {
    setBuscar("");
    setEstadoFiltro("");
  };
  const [lista, setLista] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [form, setForm] = useState({ titulo: "", descripcion: "", cierra: "", cupo: "", grupoId: "" });
  const [representativos, setRepresentativos] = useState([]);
  async function alternar(c) {
    setError("");
    try {
      await http.patch(`/cultura/admin/convocatorias/${c.id}`, { estado: c.estado === "Abierta" ? "Cerrada" : "Abierta" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible cambiar la convocatoria."));
    }
  }
  function cargar() {
    http.get("/cultura/admin/convocatorias").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar las convocatorias."));
    // Grupos representativos: a ellos se entra por audicion (esta convocatoria).
    Promise.all([http.get("/cultura/admin/areas"), http.get("/cultura/admin/grupos")])
      .then(([areas, grupos]) => {
        const deAudicion = new Set(areas.data.filter((a) => a.categoria === "representativo").map((a) => a.id));
        setRepresentativos(grupos.data.filter((g) => deAudicion.has(g.areaId)));
      })
      .catch(() => {});
  }
  useEffect(cargar, []);
  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/convocatorias", { ...form, cupo: form.cupo === "" ? null : Number(form.cupo), grupoId: form.grupoId || null });
      setAviso(`Quedó abierta la convocatoria ${form.titulo}.`);
      nuevo.cerrar();
      setForm({ titulo: "", descripcion: "", cierra: "", cupo: "", grupoId: "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible crear la convocatoria."));
    }
  }
  const [citando, setCitando] = useState(null); // { id, fecha, hora, lugar }
  const [notas, setNotas] = useState({});
  async function citar(e) {
    e.preventDefault();
    setError("");
    try {
      await http.patch(`/cultura/admin/postulaciones/${citando.id}/audicion`, { fecha: citando.fecha, hora: citando.hora, lugar: citando.lugar });
      setCitando(null);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible agendar la audición."));
    }
  }
  async function resolver(id, estado) {
    setError("");
    try {
      await http.patch(`/cultura/admin/postulaciones/${id}`, { estado, observacion: notas[id] || "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible actualizar la postulación."));
    }
  }
  const convocatoriasVisibles = lista.filter(
    (c) =>
      coincide(buscar, c.titulo, c.descripcion) &&
      (!estadoFiltro || (estadoFiltro === "revisar" ? c.postulaciones.some((p) => p.estado === "Recibida" || p.estado === "Citada") : c.estado === estadoFiltro))
  );
  return (
    <Marco titulo="Convocatorias" texto="Quien se postula pasa por tres pasos: Recibida, Citada a audición y la decisión (aceptar o rechazar).">
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <Desplegable titulo="Abrir una convocatoria" boton="Nueva convocatoria" control={nuevo} error={error} visible={esAdmin}>
      <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">Título<input className={`${campo} w-full mt-1`} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></label>
        <label className="text-sm font-semibold sm:col-span-2">Descripción<textarea className={`${campo} w-full mt-1`} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></label>
        <label className="text-sm font-semibold">Cierra<input type="date" className={`${campo} w-full mt-1`} value={form.cierra} onChange={(e) => setForm({ ...form, cierra: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Cupo (opcional)<input type="number" min="1" className={`${campo} w-full mt-1`} value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value })} /></label>
        <label className="text-sm font-semibold sm:col-span-2">
          Grupo al que da entrada
          <select className={`${campo} w-full mt-1`} value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })}>
            <option value="">Ninguno (convocatoria general)</option>
            {representativos.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
          <span className="block mt-1 font-normal text-ink-500">Al aceptar una postulación, el estudiante queda inscrito en ese grupo.</span>
        </label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Abrir convocatoria</button>
      </form>
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar convocatoria"
        pastillas={[{ etiqueta: "Estado", valor: estadoFiltro, alCambiar: setEstadoFiltro, opciones: [["", "Todas"], ["Abierta", "Abiertas"], ["Cerrada", "Cerradas"], ["revisar", "Por revisar"]] }]}
        total={lista.length}
        visibles={convocatoriasVisibles.length}
        alLimpiar={limpiar}
      />
      <div className="grid gap-4">
        {convocatoriasVisibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="Todavía no hay convocatorias." alLimpiar={limpiar} />}
        {convocatoriasVisibles.map((c) => (
          <article key={c.id} className="vidrio-panel rounded-[22px] p-4 flex flex-col sm:flex-row gap-4">
            <FotoEvento evento={c} ruta={`/cultura/admin/convocatorias/${c.id}/imagen`} respaldo={IMAGENES.integracion} alCambiar={cargar} />
            <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 font-extrabold">{c.titulo}</h2>
              <span className={`text-xs font-bold rounded-md px-2 py-0.5 select-none cursor-default ${c.estado === "Abierta" ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-ink-600"}`}>{c.estado}</span>
            </div>
            <p className="m-0 mt-1 text-sm text-ink-500">Cierra {c.cierra} · {c.postulaciones.length} postulaciones{c.cupo ? ` de ${c.cupo} cupos` : ""}</p>
            {c.grupo && <p className="m-0 mt-1 text-sm font-semibold text-primary">Da entrada a {c.grupo}: al aceptar, el estudiante queda inscrito.</p>}
            {c.descripcion && <p className="m-0 mt-1 text-sm">{c.descripcion}</p>}
            <button type="button" onClick={() => alternar(c)} className={`mt-2 min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm ${esAdmin ? "" : "hidden"}`}>
              {c.estado === "Abierta" ? "Cerrar convocatoria" : "Volver a abrir"}
            </button>
            <ul className="list-none m-0 mt-3 p-0 flex flex-col gap-2">
              {c.postulaciones.map((p) => (
                <li key={p.id} className="burbuja rounded-xl p-3">
                  <p className="m-0 font-bold">{p.nombre} · {p.estado === "Citada" ? "Citada a audición" : p.estado}</p>
                  <p className="m-0 text-sm">{p.motivacion}</p>
                  {p.audicion && <p className="m-0 mt-1 text-sm font-semibold text-primary">Audición: {p.audicion.fecha} · {p.audicion.hora} · {p.audicion.lugar}</p>}
                  {p.observacion && <p className="m-0 mt-1 text-sm text-ink-500">Comentario: {p.observacion}</p>}
                  {c.puedeDecidir && (p.estado === "Recibida" || p.estado === "Citada") && (
                    <div className="mt-2 flex flex-col gap-2">
                      {citando?.id === p.id ? (
                        <form onSubmit={citar} className="grid gap-2 sm:grid-cols-[auto_auto_1fr_auto] items-end">
                          <label className="text-sm font-semibold">Día<input type="date" required min={hoyISO()} className={`${campo} w-full mt-1`} value={citando.fecha} onChange={(e) => setCitando({ ...citando, fecha: e.target.value })} /></label>
                          <label className="text-sm font-semibold">Hora<input type="time" required className={`${campo} w-full mt-1`} value={citando.hora} onChange={(e) => setCitando({ ...citando, hora: e.target.value })} /></label>
                          <label className="text-sm font-semibold">Lugar<input required maxLength={120} className={`${campo} w-full mt-1`} value={citando.lugar} onChange={(e) => setCitando({ ...citando, lugar: e.target.value })} /></label>
                          <span className="flex gap-2">
                            <button type="submit" className="boton-liquido min-h-[44px] px-4 rounded-full font-bold">Citar</button>
                            <button type="button" onClick={() => setCitando(null)} className="min-h-[44px] px-3 rounded-full burbuja text-primary-dark font-bold">Cancelar</button>
                          </span>
                        </form>
                      ) : (
                        <button type="button" onClick={() => setCitando({ id: p.id, fecha: p.audicion?.fecha || "", hora: p.audicion?.hora || "", lugar: p.audicion?.lugar || "" })} className="min-h-[40px] px-3 rounded-full burbuja text-primary-dark font-bold w-fit">
                          {p.estado === "Citada" ? "Cambiar audición" : "Citar a audición"}
                        </button>
                      )}
                      {p.estado === "Citada" && (
                        <>
                          <input maxLength={300} placeholder="Comentario para el estudiante (opcional)" aria-label="Comentario para el estudiante" className={`${campo} w-full`} value={notas[p.id] || ""} onChange={(e) => setNotas({ ...notas, [p.id]: e.target.value })} />
                          {p.audicion.fecha > hoyISO() && <p className="m-0 text-sm text-ink-500">Podrás aceptarla a partir del día de la audición ({p.audicion.fecha}).</p>}
                          <div className="flex gap-2">
                            {p.audicion.fecha <= hoyISO() && <button type="button" onClick={() => resolver(p.id, "Aceptada")} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold">Aceptar</button>}
                            <button type="button" onClick={() => resolver(p.id, "Rechazada")} className="min-h-[44px] px-4 rounded-full border border-red-300 text-red-700 bg-white/70 font-bold hover:bg-red-50">Rechazar</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            </div>
          </article>
        ))}
      </div>
    </Marco>
  );
}
