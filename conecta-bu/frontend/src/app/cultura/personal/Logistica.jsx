import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { mensajeError } from "../comun/formato";
import { Insignia, Segmentos } from "../comunes/componentes/ui";
import { Ventana } from "../comunes/componentes/Ventana";
import { Icono } from "../comunes/componentes/Iconos";
import { Aviso, Desplegable, Filtros, Marco, SinResultados, campo, coincide, useVentana } from "./Marco";

const hoyTexto = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const NOMBRE_CATEGORIA = { instrumento: "Instrumento", vestuario: "Vestuario", equipo: "Equipo", otro: "Otro" };
const NOMBRE_TAREA = { logistica: "Logística", informe: "Informe", inventario: "Inventario", otro: "Otro" };

const ESTILO_CATEGORIA = {
  instrumento: { icono: "musica", fondo: "bg-primary-light", color: "text-primary" },
  vestuario: { icono: "persona", fondo: "bg-gold-light", color: "text-[#9C6E10]" },
  equipo: { icono: "rayo", fondo: "bg-[#DDF3EC]", color: "text-[#0B6B4F]" },
  otro: { icono: "cuadricula", fondo: "bg-gray-100", color: "text-ink-600" },
};
const diasHasta = (iso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${hoyTexto()}T00:00:00Z`)) / 864e5);
const cuandoVuelve = (iso) => {
  const d = diasHasta(iso);
  return d < 0 ? `Venció hace ${-d} d` : d === 0 ? "Vuelve hoy" : d === 1 ? "Vuelve mañana" : `En ${d} días`;
};
const fechaCorta = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Cifra del tablero.
function Cifra({ valor, texto, alerta }) {
  return (
    <div className={`rounded-[18px] border p-4 ${alerta ? "bg-red-50/80 border-red-100" : "bg-white/80 border-white"}`}>
      <p className={`m-0 text-[30px] leading-none font-extrabold tabular-nums ${alerta ? "text-red-700" : "text-primary-dark"}`}>{valor}</p>
      <p className="m-0 mt-1.5 text-sm text-ink-500">{texto}</p>
    </div>
  );
}

// Inventario del area: instrumentos, vestuario y equipos, con quien los tiene
// prestados y cuando deben volver. Arriba el tablero de prestamos (lo urgente)
// y debajo el catalogo para prestar.
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
  const piezasPrestadas = lista.reduce((n, a) => n + a.prestados, 0);
  const danadas = lista.reduce((n, a) => n + a.cantidadDanada, 0);
  // Todos los prestamos activos, primero los vencidos y luego por fecha de devolucion.
  const prestamos = lista
    .flatMap((a) => a.prestamos.map((p) => ({ ...p, articulo: a })))
    .sort((x, y) => Number(y.vencido) - Number(x.vencido) || x.fechaDevolucionEsperada.localeCompare(y.fechaDevolucionEsperada));
  const abrirDevolucion = (p) => {
    setError("");
    setDevolucion({ prestamo: p, articulo: p.articulo, danados: 0 });
  };

  return (
    <Marco titulo="Inventario" texto="Instrumentos, vestuario y equipos del área. Registra quién se lleva qué y para cuándo debe volver.">
      {error && !nuevo.abierto && !prestamo.abierto && !devolucion && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
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
      <section aria-label="Tablero de préstamos" className="flex flex-col gap-4 mb-8">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Cifra valor={lista.length} texto={lista.length === 1 ? "artículo" : "artículos"} />
          <Cifra valor={piezasPrestadas} texto={piezasPrestadas === 1 ? "pieza prestada" : "piezas prestadas"} />
          <Cifra valor={vencidos} texto={vencidos === 1 ? "préstamo sin devolver a tiempo" : "préstamos sin devolver a tiempo"} alerta={vencidos > 0} />
          <Cifra valor={danadas} texto={danadas === 1 ? "pieza dañada" : "piezas dañadas"} />
        </div>
        <div className="vidrio-panel rounded-[22px] p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="m-0 text-lg font-extrabold text-primary-dark">Préstamos por fecha de devolución</h2>
            {prestamos.length > 0 && <span className="text-sm text-ink-500">{plural(prestamos.length, "préstamo activo", "préstamos activos")}</span>}
          </div>
          {prestamos.length === 0 && <p className="m-0 text-sm text-ink-500">No hay nada prestado: todo está en su lugar.</p>}
          <ul className="list-none m-0 p-0 grid gap-2">
            {prestamos.map((p) => {
              const d = diasHasta(p.fechaDevolucionEsperada);
              const estilo = ESTILO_CATEGORIA[p.articulo.categoria] || ESTILO_CATEGORIA.otro;
              return (
                <li key={p.id} className={`rounded-2xl border px-3 py-2.5 flex flex-wrap items-center gap-3 ${p.vencido ? "bg-red-50/70 border-red-100" : "bg-white/80 border-white"}`}>
                  <span aria-hidden="true" className={`shrink-0 w-10 h-10 rounded-xl grid place-items-center ${estilo.fondo} ${estilo.color}`}>
                    <Icono nombre={estilo.icono} size={19} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 basis-[calc(100%-3.25rem)] sm:basis-0">
                    <strong className="block sm:truncate">
                      <span className="tabular-nums">{p.cantidad}</span> × {p.articulo.nombre}
                    </strong>
                    <span className="block text-sm text-ink-500 sm:truncate">
                      {p.responsable}{p.grupo ? ` (${p.grupo})` : ""}{p.motivo ? ` · ${p.motivo}` : ""}
                    </span>
                  </span>
                  {/* En el celular va en una segunda linea, bajo el articulo. */}
                  <span className="w-full sm:w-auto pl-[3.25rem] sm:pl-0 flex items-center justify-between sm:justify-end gap-3">
                    <span className="sm:text-right">
                      <Insignia tono={p.vencido ? "rojo" : d <= 3 ? "dorado" : "azul"} className="whitespace-nowrap">{cuandoVuelve(p.fechaDevolucionEsperada)}</Insignia>
                      <span className="block text-xs text-ink-500 mt-1">{fechaCorta(p.fechaDevolucionEsperada)}</span>
                    </span>
                    <button type="button" onClick={() => abrirDevolucion(p)} aria-label={`Registrar devolución de ${p.articulo.nombre}`} className="shrink-0 min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm">
                      <span className="sm:hidden">Devolver</span>
                      <span className="hidden sm:inline">Registrar devolución</span>
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <h2 className="m-0 mb-3 text-xl font-extrabold text-primary-dark">Catálogo</h2>
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar artículo o persona"
        pastillas={[
          { etiqueta: "Tipo", valor: categoria, alCambiar: setCategoria, opciones: [["", "Todos"], ...Object.entries(NOMBRE_CATEGORIA)] },
          { etiqueta: "Estado", valor: estado, alCambiar: setEstado, opciones: [["", "Todos"], ["prestado", "Prestados"], ["vencido", "Vencidos"], ["danado", "Dañados"]] },
        ]}
        total={lista.length}
        visibles={visibles.length}
        alLimpiar={limpiar}
      />
      {visibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="Todavía no hay artículos. Agrega el primero con el botón Nuevo artículo." alLimpiar={limpiar} />}
      <ul className="list-none m-0 p-0 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibles.map((a) => {
          const estilo = ESTILO_CATEGORIA[a.categoria] || ESTILO_CATEGORIA.otro;
          const total = Math.max(a.cantidadTotal, 1);
          const sinDevolver = a.prestamos.filter((p) => p.vencido).length;
          const proxima = [...a.prestamos].sort((x, y) => x.fechaDevolucionEsperada.localeCompare(y.fechaDevolucionEsperada))[0];
          return (
            <li key={a.id} className="vidrio-panel rounded-[22px] p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className={`shrink-0 w-12 h-12 rounded-2xl grid place-items-center ${estilo.fondo} ${estilo.color}`}>
                  <Icono nombre={estilo.icono} size={22} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[17px] leading-tight">{a.nombre}</strong>
                  <span className="block text-sm text-ink-500 mt-0.5">
                    {NOMBRE_CATEGORIA[a.categoria]}{a.ubicacion ? ` · ${a.ubicacion}` : ""}
                  </span>
                  {a.grupo && <span className="block text-sm text-ink-500">{a.grupo}</span>}
                </span>
              </div>
              <div>
                <div
                  role="img"
                  aria-label={`${a.disponibles} libres, ${a.prestados} prestados y ${a.cantidadDanada} dañados de ${a.cantidadTotal}`}
                  className="flex h-2.5 rounded-full overflow-hidden bg-gray-100"
                >
                  <span className="bg-[#1BAF7A]" style={{ width: `${(a.disponibles / total) * 100}%` }} />
                  <span className="bg-[#7F64D9]" style={{ width: `${(a.prestados / total) * 100}%` }} />
                  <span className="bg-red-500" style={{ width: `${(a.cantidadDanada / total) * 100}%` }} />
                </div>
                <p className="m-0 mt-1.5 text-sm text-ink-600">
                  <strong className="text-[#0B6B4F] tabular-nums">{a.disponibles}</strong> {a.disponibles === 1 ? "libre" : "libres"}
                  {a.prestados > 0 && <> · <strong className="text-[#4B2FA0] tabular-nums">{a.prestados}</strong> {a.prestados === 1 ? "prestada" : "prestadas"}</>}
                  {a.cantidadDanada > 0 && <> · <strong className="text-red-700 tabular-nums">{a.cantidadDanada}</strong> {a.cantidadDanada === 1 ? "dañada" : "dañadas"}</>}
                  <span className="text-ink-500"> de {a.cantidadTotal}</span>
                </p>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                {sinDevolver > 0 ? (
                  <Insignia tono="rojo">{plural(sinDevolver, "préstamo sin devolver", "préstamos sin devolver")}</Insignia>
                ) : proxima ? (
                  <Insignia tono="azul">Vuelve el {fechaCorta(proxima.fechaDevolucionEsperada)}</Insignia>
                ) : a.disponibles > 0 ? (
                  <Insignia tono="verde">Disponible</Insignia>
                ) : (
                  <Insignia tono="gris">Sin unidades libres</Insignia>
                )}
                <button type="button" disabled={!a.disponibles} onClick={() => abrirPrestamo(a)} className="min-h-[40px] px-5 rounded-full boton-liquido font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  Prestar
                </button>
              </div>
            </li>
          );
        })}
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

// ---------- Calendario de pendientes ----------
const SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const isoDe = (d) => d.toISOString().slice(0, 10);
const sumarDias = (iso, n) => isoDe(new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5));
const nombreMes = (anio, mes) => {
  const t = new Date(Date.UTC(anio, mes, 1)).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const diaLargo = (iso) => {
  const t = new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// Color de cada pendiente: hecho (verde), vencido (rojo), cerca de vencer (dorado) o con tiempo (morado).
const tonoPendiente = (t) =>
  t.hecha ? "bg-[#DDF3EC] text-[#0B6B4F]" : t.vencida ? "bg-red-50 text-red-700" : t.diasRestantes <= 3 ? "bg-gold-light text-[#6B4A06]" : "bg-primary-light text-primary-dark";
const puntoPendiente = (t) => (t.hecha ? "bg-[#1BAF7A]" : t.vencida ? "bg-red-500" : t.diasRestantes <= 3 ? "bg-[#D6A21E]" : "bg-primary");
// Fondo de la tarjeta segun el estado, para distinguir de un vistazo lo hecho de lo que falta.
const fondoPendiente = (t) => (t.hecha ? "bg-[#ECF8F3] border-[#BFE8D7]" : t.vencida ? "bg-red-50/70 border-red-100" : "bg-white/80 border-white");
const textoEstado = (t) => (t.hecha ? "Hecho" : t.vencida ? `Venció hace ${-t.diasRestantes} d` : t.diasRestantes === 0 ? "Hoy" : t.diasRestantes === 1 ? "Mañana" : `En ${t.diasRestantes} días`);
const tonoEstado = (t) => (t.hecha ? "verde" : t.vencida ? "rojo" : t.diasRestantes <= 3 ? "dorado" : "azul");

function CalendarioPendientes({ pendientes, eventos, alMarcar, alAgregar }) {
  const hoy = hoyTexto();
  const [mes, setMes] = useState(() => ({ anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) - 1 }));
  const [elegido, setElegido] = useState(hoy);

  const primero = new Date(Date.UTC(mes.anio, mes.mes, 1));
  const inicio = sumarDias(isoDe(primero), -((primero.getUTCDay() + 6) % 7));
  const dias = Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
  const porDia = new Map();
  for (const t of pendientes) porDia.set(t.fechaLimite, [...(porDia.get(t.fechaLimite) || []), { tipo: "pendiente", ...t }]);
  for (const e of eventos) {
    const f = String(e.fecha).slice(0, 10);
    porDia.set(f, [...(porDia.get(f) || []), { tipo: "evento", ...e }]);
  }
  const mover = (n) =>
    setMes(({ anio, mes: m }) => {
      const d = new Date(Date.UTC(anio, m + n, 1));
      return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() };
    });
  const irAHoy = () => {
    setMes({ anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) - 1 });
    setElegido(hoy);
  };
  const delDia = porDia.get(elegido) || [];
  const pendientesDia = delDia.filter((x) => x.tipo === "pendiente");
  const eventosDia = delDia.filter((x) => x.tipo === "evento");

  return (
    <section aria-label="Calendario de pendientes" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="vidrio-panel rounded-[22px] p-3 sm:p-4 max-w-[860px]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="m-0 text-lg font-extrabold text-primary-dark" aria-live="polite">{nombreMes(mes.anio, mes.mes)}</h2>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={irAHoy} className="min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm">Hoy</button>
            <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior" className="w-10 h-10 rounded-full burbuja text-primary-dark grid place-items-center">
              <Icono nombre="izquierda" size={18} strokeWidth={2.2} />
            </button>
            <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente" className="w-10 h-10 rounded-full burbuja text-primary-dark grid place-items-center">
              <Icono nombre="derecha" size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>
        <div role="grid" aria-label={nombreMes(mes.anio, mes.mes)} className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {SEMANA.map((d) => (
            <div key={d} role="columnheader" className="text-center text-xs font-bold text-ink-500 pb-1">{d}</div>
          ))}
          {dias.map((dia) => {
            const items = porDia.get(dia) || [];
            const delMes = Number(dia.slice(5, 7)) - 1 === mes.mes;
            const esHoy = dia === hoy;
            const esElegido = dia === elegido;
            const pend = items.filter((x) => x.tipo === "pendiente");
            const evs = items.filter((x) => x.tipo === "evento");
            const visiblesCelda = [...pend, ...evs];
            return (
              <button
                key={dia}
                type="button"
                role="gridcell"
                aria-selected={esElegido}
                aria-label={`${diaLargo(dia)}: ${pend.length} pendientes, ${evs.length} eventos`}
                onClick={() => setElegido(dia)}
                className={`relative text-left rounded-xl p-1 min-h-[46px] sm:min-h-[68px] flex flex-col gap-0.5 transition-colors border ${esElegido ? "border-primary bg-white" : "border-transparent hover:bg-white/70"} ${delMes ? "bg-white/50" : "bg-transparent opacity-50"}`}
              >
                <span className={`text-xs font-bold w-6 h-6 grid place-items-center rounded-full tabular-nums ${esHoy ? "bg-primary text-white" : "text-ink-700"}`}>{Number(dia.slice(8, 10))}</span>
                {/* Celular: puntos de color. Pantalla grande: los titulos. */}
                <span className="flex flex-wrap gap-0.5 sm:hidden">
                  {visiblesCelda.slice(0, 4).map((x) => (
                    <span key={x.id} className={`w-1.5 h-1.5 rounded-full ${x.tipo === "evento" ? "border border-primary" : puntoPendiente(x)}`} />
                  ))}
                </span>
                <span className="hidden sm:flex flex-col gap-0.5 min-w-0">
                  {visiblesCelda.slice(0, 2).map((x) =>
                    x.tipo === "evento" ? (
                      <span key={x.id} className="truncate text-[10px] leading-tight font-semibold rounded px-1 py-px border border-primary/40 text-primary">{x.nombre}</span>
                    ) : (
                      <span key={x.id} className={`truncate text-[10px] leading-tight font-semibold rounded px-1 py-px ${tonoPendiente(x)}`}>{x.hecha ? "✓ " : ""}{x.titulo}</span>
                    )
                  )}
                  {visiblesCelda.length > 2 && <span className="text-[10px] font-bold text-ink-500 px-1">+{visiblesCelda.length - 2} más</span>}
                </span>
              </button>
            );
          })}
        </div>
        <ul className="list-none m-0 mt-3 p-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          <li className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Vencido</li>
          <li className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#D6A21E]" />En 3 días o menos</li>
          <li className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" />Con tiempo</li>
          <li className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#1BAF7A]" />Hecho</li>
          <li className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-primary" />Evento de la agenda</li>
        </ul>
      </div>

      <div className="vidrio-panel rounded-[22px] p-4 sm:p-5 lg:sticky lg:top-24">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="m-0 text-lg font-extrabold text-primary-dark">{elegido === hoy ? `Hoy, ${diaLargo(elegido).toLowerCase()}` : diaLargo(elegido)}</h3>
          <button type="button" onClick={() => alAgregar(elegido)} className="min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold text-sm inline-flex items-center gap-1.5">
            <Icono nombre="mas" size={16} strokeWidth={2.4} /> Pendiente para este día
          </button>
        </div>
        {!delDia.length && <p className="m-0 text-sm text-ink-500">Nada para este día.</p>}
        <ul className="list-none m-0 p-0 grid gap-2">
          {pendientesDia.map((t) => (
            <li key={t.id} className={`rounded-2xl border px-3 py-2.5 flex items-start gap-3 transition-colors ${fondoPendiente(t)}`}>
              <input type="checkbox" checked={t.hecha} onChange={() => alMarcar(t)} aria-label={t.hecha ? `Marcar "${t.titulo}" como por hacer` : `Marcar "${t.titulo}" como hecho`} className={`mt-1 w-5 h-5 shrink-0 cursor-pointer ${t.hecha ? "accent-[#1BAF7A]" : "accent-primary"}`} />
              <span className="min-w-0 flex-1">
                <strong className={t.hecha ? "text-[#0B6B4F]" : ""}>{t.titulo}</strong>
                <span className="block text-sm text-ink-500">
                  {NOMBRE_TAREA[t.categoria]}{t.responsable ? ` · ${t.responsable}` : ""}{t.evento ? ` · ${t.evento}` : ""}{t.representacion ? ` · ${t.representacion}` : ""}
                </span>
                {t.detalle && <span className="block text-sm mt-0.5">{t.detalle}</span>}
              </span>
              <Insignia tono={tonoEstado(t)}>{t.hecha ? "Hecho" : t.vencida ? "Vencido" : "Por hacer"}</Insignia>
            </li>
          ))}
          {eventosDia.map((e) => (
            <li key={e.id} className="rounded-2xl border border-primary/30 px-3 py-2.5 flex items-center gap-3">
              <span aria-hidden="true" className="w-9 h-9 rounded-xl bg-primary-light text-primary grid place-items-center shrink-0">
                <Icono nombre="calendario" size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <strong className="block truncate">{e.nombre}</strong>
                <span className="block text-sm text-ink-500">Evento de la agenda · {e.horaInicio}–{e.horaFin}{e.lugar ? ` · ${e.lugar}` : ""}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// Pendientes de logistica y entregas: calendario del mes o lista por fecha limite.
export function PendientesPersonal() {
  const nuevo = useVentana();
  const [lista, setLista] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [representaciones, setRepresentaciones] = useState([]);
  const [error, setError] = useState("");
  const [buscar, setBuscar] = useState("");
  const [vista, setVista] = useState("todos");
  const [tipo, setTipo] = useState("");
  const [modo, setModo] = useState("calendario");
  const [form, setForm] = useState({ titulo: "", categoria: "logistica", fechaLimite: "", responsable: "", detalle: "", vinculo: "" });
  const agregarPara = (fecha) => {
    setForm((f) => ({ ...f, fechaLimite: fecha }));
    setError("");
    nuevo.abrir();
  };
  const limpiar = () => {
    setBuscar("");
    setVista("todos");
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
      <Segmentos className="self-start mb-4" etiqueta="Vista" opciones={[["calendario", "Calendario", "calendario"], ["lista", "Lista", "lista"]]} valor={modo} alCambiar={setModo} />
      <Filtros
        buscar={buscar}
        alBuscar={setBuscar}
        placeholder="Buscar pendiente"
        pastillas={[
          { etiqueta: "Ver", valor: vista, alCambiar: setVista, opciones: [["todos", "Todos"], ["abiertos", "Por hacer"], ["vencidos", "Vencidos"], ["hechos", "Hechos"]] },
          { etiqueta: "Tipo", valor: tipo, alCambiar: setTipo, opciones: [["", "Todos"], ...Object.entries(NOMBRE_TAREA)] },
        ]}
        total={lista.length}
        visibles={visibles.length}
        alLimpiar={limpiar}
      />
      {modo === "calendario" && (
        <CalendarioPendientes pendientes={visibles} eventos={eventos.filter((e) => e.estado === "Publicado")} alMarcar={marcar} alAgregar={agregarPara} />
      )}
      {modo === "lista" && (
      <ul className="list-none m-0 p-0 grid gap-2">
        {visibles.length === 0 && <SinResultados hayDatos={lista.length > 0} vacio="No hay pendientes. Crea uno con el botón Nuevo pendiente." alLimpiar={limpiar} />}
        {visibles.map((t) => (
          <li key={t.id} className={`rounded-[22px] border px-4 py-3 flex items-start gap-3 shadow-[0_8px_24px_-16px_rgba(11,35,71,0.25)] transition-colors ${fondoPendiente(t)}`}>
            <input
              type="checkbox"
              checked={t.hecha}
              onChange={() => marcar(t)}
              aria-label={t.hecha ? `Marcar "${t.titulo}" como por hacer` : `Marcar "${t.titulo}" como hecho`}
              className={`mt-1 w-5 h-5 shrink-0 cursor-pointer ${t.hecha ? "accent-[#1BAF7A]" : "accent-primary"}`}
            />
            <span className="min-w-0 flex-1">
              <strong className={t.hecha ? "text-[#0B6B4F]" : ""}>{t.titulo}</strong>
              <span className="block text-sm text-ink-500">
                {NOMBRE_TAREA[t.categoria]}{t.responsable ? ` · ${t.responsable}` : ""}{t.evento ? ` · ${t.evento}` : ""}{t.representacion ? ` · ${t.representacion}` : ""}
              </span>
              {t.detalle && <span className="block text-sm mt-1">{t.detalle}</span>}
            </span>
            <span className="shrink-0 text-right text-sm">
              <span className="block tabular-nums font-bold">{t.fechaLimite}</span>
              <Insignia tono={tonoEstado(t)}>{textoEstado(t)}</Insignia>
            </span>
          </li>
        ))}
      </ul>
      )}
    </Marco>
  );
}
