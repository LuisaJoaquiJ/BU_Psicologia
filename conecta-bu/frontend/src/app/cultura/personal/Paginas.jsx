import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { DIAS, horarioTexto, hoyISO, mensajeError } from "../comun/formato";
import { ControlAsistencia } from "./ControlAsistencia";
import { FotoEvento } from "./FotoEvento";
import { Aviso, Desplegable, Filtros, Marco, ResumenTipos, SinResultados, campo, coincide, opcionesDe, useVentana } from "./Marco";

export function GruposPersonal() {
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
  const [form, setForm] = useState({ areaId: "", nombre: "", director: "", lugar: "", cupo: 20, inicio: "14:00", fin: "16:00", dias: [2, 4], codigoSnies: "", documentoResponsable: "" });
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
        codigoSnies: form.codigoSnies,
        documentoResponsable: form.documentoResponsable,
      });
      setAviso(`Quedó publicado ${form.nombre}.`);
      nuevo.cerrar();
      setForm({ ...form, nombre: "", director: "", lugar: "", codigoSnies: "", documentoResponsable: "" });
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
        className="vidrio-panel rounded-[22px] p-4 flex flex-wrap gap-2 mb-4"
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
        <input className={`${campo} flex-1`} placeholder="Buscar inscrito por cédula, correo o nombre" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <button className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold">Buscar</button>
      </form>
      {hallados.length > 0 && (
        <ul className="list-none m-0 mb-6 p-0 grid gap-1">
          {hallados.map((p) => (
            <li key={p.usuarioId} className="text-sm burbuja rounded-xl px-3 py-2">{p.nombre} · {p.email} · {p.documento || "sin cédula"} · {p.programa || "sin programa"}</li>
          ))}
        </ul>
      )}
      <Desplegable titulo="Publicar un grupo o taller" boton="Nuevo grupo" control={nuevo} error={error}>
      <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
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
        <label className="text-sm font-semibold">
          Código SNIES de la actividad
          <input className={`${campo} w-full mt-1`} value={form.codigoSnies} onChange={(e) => setForm({ ...form, codigoSnies: e.target.value })} />
        </label>
        <label className="text-sm font-semibold">
          Cédula del responsable
          <input className={`${campo} w-full mt-1`} value={form.documentoResponsable} onChange={(e) => setForm({ ...form, documentoResponsable: e.target.value })} />
        </label>
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
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar por nombre, área, director o lugar"
        selectores={[
          { etiqueta: "Área", valor: area, alCambiar: setArea, opciones: [["", "Todas"], ...opcionesDe(grupos, "area").map((a) => [a, a])] },
          { etiqueta: "Periodo", valor: periodo, alCambiar: setPeriodo, opciones: [["", "Todos"], ...opcionesDe(grupos, "periodo").map((p) => [p, p])] },
        ]}
        pastillas={[{ etiqueta: "Inscripciones", valor: estado, alCambiar: setEstado, opciones: [["", "Todos"], ["abiertas", "Abiertas"], ["cerradas", "Cerradas"], ["cupos", "Con cupos"], ["llenos", "Llenos"]] }]}
        total={grupos.length}
        visibles={gruposVisibles.length}
        alLimpiar={limpiar}
      />
      <div className="grid gap-4">
        {gruposVisibles.length === 0 && <SinResultados hayDatos={grupos.length > 0} vacio="Todavía no hay grupos. Publica el primero con el botón Nuevo grupo." alLimpiar={limpiar} />}
        {gruposVisibles.map((grupo) => {
          const marca = asistencia[grupo.id] || { fecha: hoyISO(), presentes: [] };
          return (
            <article key={grupo.id} className="vidrio-panel rounded-[22px] p-4">
              <h2 className="m-0 font-extrabold">{grupo.nombre}</h2>
              <p className="m-0 mt-1 text-sm text-ink-500">
                {grupo.area} · {grupo.periodo} · {horarioTexto(grupo.horario)} · {grupo.inscritos.length} de {grupo.cupo} cupos
                {grupo.codigoSnies ? ` · SNIES ${grupo.codigoSnies}` : ""}
              </p>
              <ResumenTipos porTipo={grupo.porTipo} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
              <ControlAsistencia ruta={`/cultura/admin/grupos/${grupo.id}`} fecha={marca.fecha} evidencia={{ grupoId: grupo.id }} />
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
            </article>
          );
        })}
      </div>
    </Marco>
  );
}

export function AgendaPersonal() {
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
  const [form, setForm] = useState({ nombre: "", descripcion: "", representacion: "", categoria: "especial", grupoId: "", fecha: "", horaInicio: "18:00", horaFin: "20:00", lugar: "", cupo: 40, fechaLimite: "", estado: "Publicado", codigoSnies: "", documentoResponsable: "" });
  function cargar() {
    http.get("/cultura/admin/agenda").then((r) => setEventos(r.data)).catch(() => setError("No fue posible cargar la agenda."));
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
      await http.post("/cultura/admin/agenda", { ...form, fechaLimite: form.fechaLimite || form.fecha, cupo: Number(form.cupo) });
      setAviso(`Quedó en la agenda: ${form.nombre}.`);
      nuevo.cerrar();
      setForm({ ...form, nombre: "", descripcion: "", lugar: "", representacion: "", codigoSnies: "" });
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
      <Desplegable titulo="Publicar un evento" boton="Nuevo evento" control={nuevo} error={error}>
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
          <select className={`${campo} w-full mt-1`} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
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
        <label className="text-sm font-semibold">
          Código SNIES de la actividad
          <input className={`${campo} w-full mt-1`} value={form.codigoSnies} onChange={(e) => setForm({ ...form, codigoSnies: e.target.value })} />
        </label>
        <label className="text-sm font-semibold">
          Cédula del responsable
          <input className={`${campo} w-full mt-1`} value={form.documentoResponsable} onChange={(e) => setForm({ ...form, documentoResponsable: e.target.value })} />
        </label>
        <p className="m-0 sm:col-span-2 text-sm text-ink-500">Para otra franja del mismo día, publica otro evento con su hora de inicio y fin. Si dejas vacío el límite de inscripción, es el mismo día del evento.</p>
        <label className="text-sm font-semibold">Fecha<input type="date" className={`${campo} w-full mt-1`} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Límite de inscripción<input type="date" className={`${campo} w-full mt-1`} value={form.fechaLimite} onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} /></label>
        <label className="text-sm font-semibold">Inicio<input type="time" className={`${campo} w-full mt-1`} value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} /></label>
        <label className="text-sm font-semibold">Fin<input type="time" className={`${campo} w-full mt-1`} value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} /></label>
        <label className="text-sm font-semibold">Lugar<input className={`${campo} w-full mt-1`} value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} /></label>
        <label className="text-sm font-semibold">Cupo<input type="number" min="1" className={`${campo} w-full mt-1`} value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value })} /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Publicar en la agenda</button>
      </form>
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar por nombre, lugar o representación"
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
              <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${e.estado === "Publicado" ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-ink-600"}`}>{e.estado}</span>
              <button type="button" onClick={() => cambiarEstado(e)} className="min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm">
                {e.estado === "Publicado" ? "Pasar a borrador" : "Publicar"}
              </button>
            </div>
            <ControlAsistencia ruta={`/cultura/admin/agenda/${e.id}`} fecha={e.fecha} evidencia={{ eventoId: e.id }} />
            </div>
          </li>
        ))}
      </ul>
    </Marco>
  );
}

export function ConvocatoriasPersonal() {
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
  const [form, setForm] = useState({ titulo: "", descripcion: "", cierra: "", cupo: "" });
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
  }
  useEffect(cargar, []);
  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/convocatorias", { ...form, cupo: form.cupo === "" ? null : Number(form.cupo) });
      setAviso(`Quedó abierta la convocatoria ${form.titulo}.`);
      nuevo.cerrar();
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
  const convocatoriasVisibles = lista.filter(
    (c) =>
      coincide(buscar, c.titulo, c.descripcion) &&
      (!estadoFiltro || (estadoFiltro === "revisar" ? c.postulaciones.some((p) => p.estado === "Recibida") : c.estado === estadoFiltro))
  );
  return (
    <Marco titulo="Convocatorias" texto="Quien se postula queda en estado Recibida hasta que el área acepte o rechace.">
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <Desplegable titulo="Abrir una convocatoria" boton="Nueva convocatoria" control={nuevo} error={error}>
      <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">Título<input className={`${campo} w-full mt-1`} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></label>
        <label className="text-sm font-semibold sm:col-span-2">Descripción<textarea className={`${campo} w-full mt-1`} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></label>
        <label className="text-sm font-semibold">Cierra<input type="date" className={`${campo} w-full mt-1`} value={form.cierra} onChange={(e) => setForm({ ...form, cierra: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Cupo (opcional)<input type="number" min="1" className={`${campo} w-full mt-1`} value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value })} /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Abrir convocatoria</button>
      </form>
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar convocatoria"
        pastillas={[{ etiqueta: "Estado", valor: estadoFiltro, alCambiar: setEstadoFiltro, opciones: [["", "Todas"], ["Abierta", "Abiertas"], ["Cerrada", "Cerradas"], ["revisar", "Con postulaciones por revisar"]] }]}
        total={lista.length}
        visibles={convocatoriasVisibles.length}
        alLimpiar={limpiar}
      />
      <div className="grid gap-4">
        {convocatoriasVisibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="Todavía no hay convocatorias." alLimpiar={limpiar} />}
        {convocatoriasVisibles.map((c) => (
          <article key={c.id} className="vidrio-panel rounded-[22px] p-4">
            <h2 className="m-0 font-extrabold">{c.titulo}</h2>
            <p className="m-0 text-sm text-ink-500">Cierra {c.cierra} · {c.estado} · {c.postulaciones.length} postulaciones{c.cupo ? ` de ${c.cupo} cupos` : ""}</p>
            <button type="button" onClick={() => alternar(c)} className="mt-2 min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm">
              {c.estado === "Abierta" ? "Cerrar convocatoria" : "Volver a abrir"}
            </button>
            <ul className="list-none m-0 mt-3 p-0 flex flex-col gap-2">
              {c.postulaciones.map((p) => (
                <li key={p.id} className="burbuja rounded-xl p-3">
                  <p className="m-0 font-bold">{p.nombre} · {p.estado}</p>
                  <p className="m-0 text-sm">{p.motivacion}</p>
                  {p.estado === "Recibida" && (
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => resolver(p.id, "Aceptada")} className="min-h-[40px] px-3 rounded-full burbuja text-primary-dark font-bold">Aceptar</button>
                      <button type="button" onClick={() => resolver(p.id, "Rechazada")} className="min-h-[40px] px-3 rounded-full burbuja text-primary-dark font-bold">Rechazar</button>
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
