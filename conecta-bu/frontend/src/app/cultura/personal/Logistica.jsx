import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { mensajeError } from "../comun/formato";
import { Insignia } from "../comunes/componentes/ui";
import { Ventana } from "../comunes/componentes/Ventana";
import { Aviso, Desplegable, Filtros, Marco, SinResultados, campo, coincide, useVentana } from "./Marco";

const hoyTexto = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const NOMBRE_CATEGORIA = { instrumento: "Instrumento", vestuario: "Vestuario", equipo: "Equipo", otro: "Otro" };
const NOMBRE_TAREA = { logistica: "Logística", informe: "Informe", inventario: "Inventario", otro: "Otro" };

// Inventario del area: instrumentos, vestuario y equipos, con quien los tiene
// prestados y cuando deben volver.
export function InventarioPersonal() {
  const nuevo = useVentana();
  const prestamo = useVentana();
  const [lista, setLista] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [buscar, setBuscar] = useState("");
  const [categoria, setCategoria] = useState("");
  const [estado, setEstado] = useState("");
  const [form, setForm] = useState({ nombre: "", categoria: "instrumento", cantidadTotal: 1, ubicacion: "", grupoId: "" });
  const [elegido, setElegido] = useState(null);
  const [devolucion, setDevolucion] = useState(null);
  const [formPrestamo, setFormPrestamo] = useState({ cantidad: 1, responsable: "", responsableEmail: "", grupoId: "", motivo: "", fechaDevolucionEsperada: "" });
  const limpiar = () => {
    setBuscar("");
    setCategoria("");
    setEstado("");
  };
  function cargar() {
    http.get("/cultura/admin/inventario").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar el inventario."));
    http.get("/cultura/admin/grupos").then((r) => setGrupos(r.data)).catch(() => {});
  }
  useEffect(cargar, []);

  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post("/cultura/admin/inventario", { ...form, cantidadTotal: Number(form.cantidadTotal) });
      setAviso(`Quedó en el inventario: ${form.nombre}.`);
      nuevo.cerrar();
      setForm({ ...form, nombre: "", cantidadTotal: 1, ubicacion: "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible agregar el artículo."));
    }
  }
  function abrirPrestamo(a) {
    setElegido(a);
    setError("");
    setFormPrestamo({ cantidad: 1, responsable: "", responsableEmail: "", grupoId: a.grupoId || "", motivo: "", fechaDevolucionEsperada: hoyTexto() });
    prestamo.abrir();
  }
  async function prestar(e) {
    e.preventDefault();
    setError("");
    try {
      await http.post(`/cultura/admin/inventario/${elegido.id}/prestamos`, { ...formPrestamo, cantidad: Number(formPrestamo.cantidad) });
      setAviso(`Quedó prestado: ${formPrestamo.cantidad} × ${elegido.nombre} a ${formPrestamo.responsable}.`);
      prestamo.cerrar();
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar el préstamo."));
    }
  }
  async function devolver(e) {
    e.preventDefault();
    const { prestamo: p, articulo, danados } = devolucion;
    setError("");
    try {
      await http.post(`/cultura/admin/prestamos/${p.id}/devolucion`, { devueltosDanados: Number(danados) || 0 });
      setAviso(`Quedó devuelto: ${p.cantidad} × ${articulo.nombre}.`);
      setDevolucion(null);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar la devolución."));
    }
  }

  const visibles = lista.filter(
    (a) =>
      coincide(buscar, a.nombre, a.ubicacion, a.grupo, ...a.prestamos.map((p) => p.responsable)) &&
      (!categoria || a.categoria === categoria) &&
      (!estado || (estado === "prestado" ? a.prestados > 0 : estado === "vencido" ? a.prestamos.some((p) => p.vencido) : a.cantidadDanada > 0))
  );
  const vencidos = lista.reduce((n, a) => n + a.prestamos.filter((p) => p.vencido).length, 0);

  return (
    <Marco titulo="Inventario" texto="Instrumentos, vestuario y equipos del área. Registra quién se lleva qué y para cuándo debe volver.">
      {error && !nuevo.abierto && !prestamo.abierto && !devolucion && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      {vencidos > 0 && <Aviso tono="dorado">{vencidos === 1 ? "Hay 1 préstamo" : `Hay ${vencidos} préstamos`} que ya debió volver.</Aviso>}
      <Desplegable titulo="Agregar al inventario" boton="Nuevo artículo" control={nuevo} error={error}>
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">Nombre<input className={`${campo} w-full mt-1`} placeholder="Vestido de cumbia, guitarra acústica…" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
          <label className="text-sm font-semibold">Tipo
            <select className={`${campo} w-full mt-1`} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {Object.entries(NOMBRE_CATEGORIA).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Cantidad<input type="number" min="1" className={`${campo} w-full mt-1`} value={form.cantidadTotal} onChange={(e) => setForm({ ...form, cantidadTotal: e.target.value })} required /></label>
          <label className="text-sm font-semibold">Dónde se guarda<input className={`${campo} w-full mt-1`} placeholder="Bodega de Cultura" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} /></label>
          <label className="text-sm font-semibold">Grupo que lo usa
            <select className={`${campo} w-full mt-1`} value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })}>
              <option value="">Todo el área</option>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </label>
          <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Agregar</button>
        </form>
      </Desplegable>
      {prestamo.abierto && elegido && (
        <PrestamoVentana articulo={elegido} grupos={grupos} form={formPrestamo} setForm={setFormPrestamo} alEnviar={prestar} alCerrar={prestamo.cerrar} error={error} />
      )}
      {devolucion && (
        <Ventana titulo={`Devolución de ${devolucion.articulo.nombre}`} alCerrar={() => setDevolucion(null)} ancho="sm:max-w-[520px]">
          {error && <Aviso>{error}</Aviso>}
          <form onSubmit={devolver} className="grid gap-3">
            <p className="m-0 text-sm text-ink-600">
              {devolucion.prestamo.responsable} devuelve <strong>{devolucion.prestamo.cantidad}</strong>. Si algo volvió dañado, indícalo para descontarlo de lo disponible.
            </p>
            <label className="text-sm font-semibold">Volvieron dañados<input type="number" min="0" max={devolucion.prestamo.cantidad} className={`${campo} w-full mt-1`} value={devolucion.danados} onChange={(e) => setDevolucion({ ...devolucion, danados: e.target.value })} /></label>
            <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Registrar devolución</button>
          </form>
        </Ventana>
      )}
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar por artículo, lugar, grupo o quién lo tiene"
        pastillas={[
          { etiqueta: "Tipo", valor: categoria, alCambiar: setCategoria, opciones: [["", "Todos"], ...Object.entries(NOMBRE_CATEGORIA)] },
          { etiqueta: "Estado", valor: estado, alCambiar: setEstado, opciones: [["", "Todos"], ["prestado", "Prestados"], ["vencido", "Sin devolver a tiempo"], ["danado", "Con dañados"]] },
        ]}
        total={lista.length}
        visibles={visibles.length}
        alLimpiar={limpiar}
      />
      <ul className="list-none m-0 p-0 grid gap-2">
        {visibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="Todavía no hay artículos. Agrega el primero con el botón Nuevo artículo." alLimpiar={limpiar} />}
        {visibles.map((a) => (
          <li key={a.id} className="vidrio-panel rounded-[22px] px-4 py-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span className="min-w-0">
                <strong>{a.nombre}</strong>
                <span className="block text-sm text-ink-500">
                  {NOMBRE_CATEGORIA[a.categoria]}{a.ubicacion ? ` · ${a.ubicacion}` : ""}{a.grupo ? ` · ${a.grupo}` : ""}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Insignia tono={a.disponibles ? "verde" : "gris"}>{a.disponibles} de {a.cantidadTotal} disponibles</Insignia>
                {a.cantidadDanada > 0 && <Insignia tono="rojo">{a.cantidadDanada} {a.cantidadDanada === 1 ? "dañado" : "dañados"}</Insignia>}
                <button type="button" disabled={!a.disponibles} onClick={() => abrirPrestamo(a)} className="min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm disabled:opacity-50">
                  Prestar
                </button>
              </span>
            </div>
            {a.prestamos.length > 0 && (
              <ul className="list-none m-0 p-0 grid gap-1.5">
                {a.prestamos.map((p) => (
                  <li key={p.id} className="rounded-2xl bg-white/70 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong className="tabular-nums">{p.cantidad}</strong> con {p.responsable}
                      {p.grupo ? ` (${p.grupo})` : ""}{p.motivo ? ` · ${p.motivo}` : ""}
                      <span className={`block ${p.vencido ? "text-red-700 font-bold" : "text-ink-500"}`}>
                        {p.vencido ? "Debió volver el" : "Vuelve el"} {p.fechaDevolucionEsperada}
                      </span>
                    </span>
                    <button type="button" onClick={() => { setError(""); setDevolucion({ prestamo: p, articulo: a, danados: 0 }); }} className="min-h-[38px] px-3 rounded-full font-bold text-primary hover:bg-white">
                      Registrar devolución
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Marco>
  );
}

function PrestamoVentana({ articulo, grupos, form, setForm, alEnviar, alCerrar, error }) {
  return (
    <Ventana titulo={`Prestar ${articulo.nombre}`} alCerrar={alCerrar} ancho="sm:max-w-[760px]">
      {error && <Aviso>{error}</Aviso>}
      <form onSubmit={alEnviar} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Cantidad (hay {articulo.disponibles})<input type="number" min="1" max={articulo.disponibles} className={`${campo} w-full mt-1`} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Debe volver el<input type="date" min={hoyTexto()} className={`${campo} w-full mt-1`} value={form.fechaDevolucionEsperada} onChange={(e) => setForm({ ...form, fechaDevolucionEsperada: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Quién lo recibe<input className={`${campo} w-full mt-1`} placeholder="Nombre de la persona o del grupo" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} required /></label>
        <label className="text-sm font-semibold">Correo (opcional)<input type="email" className={`${campo} w-full mt-1`} value={form.responsableEmail} onChange={(e) => setForm({ ...form, responsableEmail: e.target.value })} /></label>
        <label className="text-sm font-semibold">Grupo
          <select className={`${campo} w-full mt-1`} value={form.grupoId} onChange={(e) => setForm({ ...form, grupoId: e.target.value })}>
            <option value="">Sin grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Para qué<input className={`${campo} w-full mt-1`} placeholder="Global Fest, ensayo…" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} /></label>
        <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Registrar préstamo</button>
      </form>
    </Ventana>
  );
}

// Pendientes de logistica y entregas, ordenados por fecha limite.
export function PendientesPersonal() {
  const nuevo = useVentana();
  const [lista, setLista] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [representaciones, setRepresentaciones] = useState([]);
  const [error, setError] = useState("");
  const [buscar, setBuscar] = useState("");
  const [vista, setVista] = useState("abiertos");
  const [tipo, setTipo] = useState("");
  const [form, setForm] = useState({ titulo: "", categoria: "logistica", fechaLimite: "", responsable: "", detalle: "", vinculo: "" });
  const limpiar = () => {
    setBuscar("");
    setVista("abiertos");
    setTipo("");
  };
  function cargar() {
    http.get("/cultura/admin/pendientes").then((r) => setLista(r.data)).catch(() => setError("No fue posible cargar los pendientes."));
  }
  useEffect(() => {
    cargar();
    http.get("/cultura/admin/agenda").then((r) => setEventos(r.data)).catch(() => {});
    http.get("/cultura/admin/representaciones").then((r) => setRepresentaciones(r.data)).catch(() => {});
  }, []);

  async function crear(e) {
    e.preventDefault();
    setError("");
    const [clase, id] = form.vinculo.split(":");
    try {
      await http.post("/cultura/admin/pendientes", {
        titulo: form.titulo,
        categoria: form.categoria,
        fechaLimite: form.fechaLimite,
        responsable: form.responsable,
        detalle: form.detalle,
        eventoId: clase === "evento" ? id : null,
        representacionId: clase === "red" ? id : null,
      });
      nuevo.cerrar();
      setForm({ ...form, titulo: "", responsable: "", detalle: "", vinculo: "" });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar el pendiente."));
    }
  }
  async function marcar(t) {
    setError("");
    try {
      await http.patch(`/cultura/admin/pendientes/${t.id}`, { hecha: !t.hecha });
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible actualizar el pendiente."));
    }
  }

  const visibles = lista.filter(
    (t) =>
      coincide(buscar, t.titulo, t.responsable, t.detalle, t.evento, t.representacion) &&
      (!tipo || t.categoria === tipo) &&
      (vista === "todos" || (vista === "hechos" && t.hecha) || (vista === "abiertos" && !t.hecha) || (vista === "vencidos" && t.vencida))
  );
  const vencidos = lista.filter((t) => t.vencida).length;

  return (
    <Marco titulo="Pendientes" texto="Lo que hay que gestionar antes de cada fecha: el bus, el vestuario, el informe SNIES, el inventario. Marca cada uno cuando quede listo.">
      {error && !nuevo.abierto && <Aviso>{error}</Aviso>}
      {vencidos > 0 && <Aviso tono="dorado">{vencidos === 1 ? "Hay 1 pendiente vencido." : `Hay ${vencidos} pendientes vencidos.`}</Aviso>}
      <Desplegable titulo="Nuevo pendiente" boton="Nuevo pendiente" control={nuevo} error={error}>
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">Qué hay que hacer<input className={`${campo} w-full mt-1`} placeholder="Gestionar el bus para Timbío" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></label>
          <label className="text-sm font-semibold">Tipo
            <select className={`${campo} w-full mt-1`} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {Object.entries(NOMBRE_TAREA).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Fecha límite<input type="date" className={`${campo} w-full mt-1`} value={form.fechaLimite} onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} required /></label>
          <label className="text-sm font-semibold">Responsable<input className={`${campo} w-full mt-1`} placeholder="Nombre o rol" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} /></label>
          <label className="text-sm font-semibold">Para
            <select className={`${campo} w-full mt-1`} value={form.vinculo} onChange={(e) => setForm({ ...form, vinculo: e.target.value })}>
              <option value="">Nada en particular</option>
              {eventos.length > 0 && (
                <optgroup label="Eventos">
                  {eventos.map((ev) => <option key={ev.id} value={`evento:${ev.id}`}>{ev.nombre} · {String(ev.fecha).slice(0, 10)}</option>)}
                </optgroup>
              )}
              {representaciones.length > 0 && (
                <optgroup label="Delegaciones">
                  {representaciones.map((r) => <option key={r.id} value={`red:${r.id}`}>{r.nombre} · {r.fecha}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Detalle<textarea className={`${campo} w-full mt-1`} value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} /></label>
          <button className="boton-liquido min-h-[44px] px-5 rounded-full font-bold w-fit">Guardar pendiente</button>
        </form>
      </Desplegable>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar por pendiente, responsable o evento"
        pastillas={[
          { etiqueta: "Ver", valor: vista, alCambiar: setVista, opciones: [["abiertos", "Por hacer"], ["vencidos", "Vencidos"], ["hechos", "Hechos"], ["todos", "Todos"]] },
          { etiqueta: "Tipo", valor: tipo, alCambiar: setTipo, opciones: [["", "Todos"], ...Object.entries(NOMBRE_TAREA)] },
        ]}
        total={lista.length}
        visibles={visibles.length}
        alLimpiar={limpiar}
      />
      <ul className="list-none m-0 p-0 grid gap-2">
        {visibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="No hay pendientes. Crea uno con el botón Nuevo pendiente." alLimpiar={limpiar} />}
        {visibles.map((t) => (
          <li key={t.id} className="vidrio-panel rounded-[22px] px-4 py-3 flex items-start gap-3">
            <input
              type="checkbox"
              checked={t.hecha}
              onChange={() => marcar(t)}
              aria-label={t.hecha ? `Marcar "${t.titulo}" como por hacer` : `Marcar "${t.titulo}" como hecho`}
              className="mt-1 w-5 h-5 shrink-0 accent-primary cursor-pointer"
            />
            <span className="min-w-0 flex-1">
              <strong className={t.hecha ? "line-through text-ink-500" : ""}>{t.titulo}</strong>
              <span className="block text-sm text-ink-500">
                {NOMBRE_TAREA[t.categoria]}{t.responsable ? ` · ${t.responsable}` : ""}{t.evento ? ` · ${t.evento}` : ""}{t.representacion ? ` · ${t.representacion}` : ""}
              </span>
              {t.detalle && <span className="block text-sm mt-1">{t.detalle}</span>}
            </span>
            <span className="shrink-0 text-right text-sm">
              <span className="block tabular-nums font-bold">{t.fechaLimite}</span>
              {!t.hecha && (
                <Insignia tono={t.vencida ? "rojo" : t.diasRestantes <= 3 ? "dorado" : "gris"}>
                  {t.vencida ? `Venció hace ${-t.diasRestantes} d` : t.diasRestantes === 0 ? "Hoy" : t.diasRestantes === 1 ? "Mañana" : `En ${t.diasRestantes} días`}
                </Insignia>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Marco>
  );
}
