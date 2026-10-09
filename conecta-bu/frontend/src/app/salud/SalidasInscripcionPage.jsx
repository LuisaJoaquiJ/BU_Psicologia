import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { fechaLarga } from "../../lib/format";
import { descargar, mensajeError } from "../../lib/salud";
import { Icono } from "../../components/Iconos";
import { BotonFlotante, Ventana } from "../../components/Ventana";
import { Aviso, Campo, Insignia, botonPrimario, botonSecundario, claseCampo } from "../../components/ui";

// Salidas de Salud integral con inscripcion de estudiantes (vista del
// personal de Salud): publicar la salida, revisar a los inscritos y
// descargar el listado para la ARL o el seguro.

const API = "/salud/salidas-inscripcion";
const TONO_SALIDA = { Borrador: "gris", Publicada: "verde", Cerrada: "azul", Cancelada: "rojo" };
const TONO_INSCRIPCION = { Pendiente: "dorado", Aprobada: "verde", Rechazada: "rojo", Cancelada: "gris" };
const TEXTO_INSCRIPCION = { Pendiente: "Por revisar", Aprobada: "Aprobada", Rechazada: "Rechazada", Cancelada: "Cancelada" };
const VACIA = {
  nombre: "",
  destino: "",
  descripcion: "",
  programa: "",
  responsable: "",
  lugarEncuentro: "",
  fechaSalida: "",
  fechaRegreso: "",
  horaSalida: "",
  horaRegreso: "",
  cupos: 30,
  costo: "",
  infoPago: "",
  pideComprobante: false,
  fechaLimiteInscripcion: "",
};

const pesos = (n) => (n === null || n === undefined || n === "" ? "" : `$${Number(n).toLocaleString("es-CO")}`);
const fecha = (iso) => (iso ? fechaLarga(`${iso}T12:00:00Z`) : "");
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function rangoFechas(s) {
  const ida = fecha(s.fechaSalida);
  return s.fechaRegreso && s.fechaRegreso !== s.fechaSalida ? `${ida} al ${fecha(s.fechaRegreso).toLowerCase()}` : ida;
}

function FormularioSalida({ inicial, alGuardar }) {
  const [v, setV] = useState(inicial);
  const [enviando, setEnviando] = useState(null);
  const [error, setError] = useState("");
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const editar = Boolean(inicial.id);

  async function guardar(estado) {
    setError("");
    setEnviando(estado || "guardar");
    try {
      const datos = { ...v, cupos: Number(v.cupos), costo: v.costo === "" ? null : Number(String(v.costo).replace(/\D/g, "")) };
      if (editar) await http.patch(`${API}/${inicial.id}`, datos);
      else await http.post(API, { ...datos, estado });
      await alGuardar(
        editar
          ? "Guardamos los cambios de la salida."
          : estado === "Publicada"
            ? "Salida publicada: los estudiantes ya pueden inscribirse."
            : "Guardada como borrador.",
      );
    } catch (err) {
      setError(mensajeError(err, "No pudimos guardar la salida."));
    } finally {
      setEnviando(null);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar(editar ? undefined : "Publicada");
      }}
      className="bg-white rounded-[18px] p-5 sm:p-7 grid gap-4 sm:grid-cols-2"
    >
      <Campo etiqueta="Nombre de la salida" className="sm:col-span-2">
        <input required value={v.nombre} onChange={set("nombre")} placeholder="Ej.: Visita técnica Medellín" className={claseCampo} />
      </Campo>
      <Campo etiqueta="Destino">
        <input required value={v.destino} onChange={set("destino")} placeholder="Ej.: Medellín, Antioquia" className={claseCampo} />
      </Campo>
      <Campo etiqueta="Programa o área (opcional)">
        <input value={v.programa} onChange={set("programa")} placeholder="Ej.: Ingeniería Civil" className={claseCampo} />
      </Campo>
      <Campo etiqueta="Fecha de salida">
        <input required type="date" value={v.fechaSalida} onChange={set("fechaSalida")} className={claseCampo} />
      </Campo>
      <Campo etiqueta="Fecha de regreso">
        <input required type="date" value={v.fechaRegreso} min={v.fechaSalida} onChange={set("fechaRegreso")} className={claseCampo} />
      </Campo>
      <Campo etiqueta="Hora de salida (opcional)">
        <input type="time" value={v.horaSalida} onChange={set("horaSalida")} className={claseCampo} />
      </Campo>
      <Campo etiqueta="Hora de regreso (opcional)">
        <input type="time" value={v.horaRegreso} onChange={set("horaRegreso")} className={claseCampo} />
      </Campo>
      <Campo etiqueta="Punto de encuentro (opcional)">
        <input value={v.lugarEncuentro} onChange={set("lugarEncuentro")} placeholder="Ej.: Portería sede principal" className={claseCampo} />
      </Campo>
      <Campo etiqueta="Responsable (opcional)">
        <input value={v.responsable} onChange={set("responsable")} placeholder="Docente o persona a cargo" className={claseCampo} />
      </Campo>
      <Campo etiqueta="Cupos">
        <input required type="number" min="1" value={v.cupos} onChange={set("cupos")} className={claseCampo} />
      </Campo>
      <Campo etiqueta="Inscripciones abiertas hasta">
        <input
          required
          type="date"
          value={v.fechaLimiteInscripcion}
          max={v.fechaSalida || undefined}
          onChange={set("fechaLimiteInscripcion")}
          className={claseCampo}
        />
      </Campo>
      <Campo etiqueta="Costo por estudiante (opcional)" ayuda="Déjalo vacío si la salida no tiene costo.">
        <input inputMode="numeric" value={v.costo} onChange={set("costo")} placeholder="Ej.: 700000" className={claseCampo} />
      </Campo>
      <label className="flex items-center gap-3 self-center min-h-[44px] text-sm font-semibold text-ink-700 cursor-pointer">
        <input type="checkbox" checked={v.pideComprobante} onChange={set("pideComprobante")} className="w-5 h-5 accent-[#19407B]" />
        Pedir el comprobante de pago al inscribirse
      </label>
      <Campo
        etiqueta="Datos de pago e instrucciones (opcional)"
        className="sm:col-span-2"
        ayuda="Cuenta, valor del abono, plazo y a quién enviar copia. El estudiante lo verá al inscribirse."
      >
        <textarea rows={3} value={v.infoPago} onChange={set("infoPago")} className={`${claseCampo} py-3`} />
      </Campo>
      <Campo etiqueta="Descripción (opcional)" className="sm:col-span-2">
        <textarea
          rows={3}
          value={v.descripcion}
          onChange={set("descripcion")}
          placeholder="Qué se va a hacer, qué llevar, recomendaciones."
          className={`${claseCampo} py-3`}
        />
      </Campo>
      {error && (
        <div className="sm:col-span-2">
          <Aviso>{error}</Aviso>
        </div>
      )}
      <div className="sm:col-span-2 flex gap-2.5 justify-end flex-wrap pt-2 border-t border-gray-100">
        {editar ? (
          <button type="submit" disabled={!!enviando} className={botonPrimario}>
            {enviando ? "Guardando…" : "Guardar cambios"}
          </button>
        ) : (
          <>
            <button type="button" disabled={!!enviando} onClick={() => guardar("Borrador")} className={botonSecundario}>
              {enviando === "Borrador" ? "Guardando…" : "Guardar como borrador"}
            </button>
            <button type="submit" disabled={!!enviando} className={botonPrimario}>
              {enviando === "Publicada" ? "Publicando…" : "Publicar salida"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}

export function SalidasInscripcionPage() {
  const [params, setParams] = useSearchParams();
  const [salidas, setSalidas] = useState(null);
  const [formulario, setFormulario] = useState(params.get("nueva") ? { ...VACIA } : null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const cargar = () =>
    http
      .get(API)
      .then((r) => setSalidas(r.data.salidas))
      .catch((e) => setError(mensajeError(e, "No pudimos cargar las salidas.")));
  useEffect(() => {
    cargar();
  }, []);

  const cerrar = useCallback(() => {
    setFormulario(null);
    if (params.get("nueva")) setParams({}, { replace: true });
  }, [params, setParams]);

  async function cambiarEstado(s, estado) {
    if (estado === "Cancelada" && !window.confirm(`¿Cancelar la salida "${s.nombre}"? Los inscritos dejarán de verla como activa.`)) return;
    setError("");
    try {
      await http.patch(`${API}/${s.id}/estado`, { estado });
      setMensaje(
        { Publicada: "Salida publicada.", Cerrada: "Inscripciones cerradas.", Cancelada: "Salida cancelada.", Borrador: "Volvió a borrador." }[estado],
      );
      await cargar();
    } catch (err) {
      setError(mensajeError(err, "No pudimos cambiar el estado."));
    }
  }

  const hoy = hoyLocal();
  const grupos = useMemo(() => {
    const lista = salidas || [];
    return [
      ["Próximas", lista.filter((s) => s.fechaRegreso >= hoy)],
      ["Anteriores", lista.filter((s) => s.fechaRegreso < hoy).reverse()],
    ];
  }, [salidas, hoy]);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-32">
      <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">Salidas</h1>
      <p className="mt-1 mb-6 text-ink-500 max-w-[48em]">
        Publica las salidas para que los estudiantes se inscriban. Desde cada salida revisas a los inscritos y descargas el listado para la ARL o el seguro.
      </p>
      {mensaje && (
        <div className="mb-5" role="status">
          <Aviso tono="verde">{mensaje}</Aviso>
        </div>
      )}
      {error && (
        <div className="mb-5">
          <Aviso>{error}</Aviso>
        </div>
      )}
      {!salidas && !error && <p className="text-ink-500">Cargando salidas…</p>}
      {salidas && salidas.length === 0 && (
        <div className="bg-white rounded-[22px] border border-gray-200 px-6 py-12 text-center flex flex-col items-center gap-3">
          <span className="w-14 h-14 rounded-2xl bg-primary-light text-primary flex items-center justify-center">
            <Icono nombre="bus" size={28} strokeWidth={2} />
          </span>
          <p className="m-0 text-lg font-extrabold text-ink-900">Todavía no hay salidas</p>
          <p className="m-0 text-ink-500 max-w-[36em]">Crea la primera; puedes guardarla como borrador y publicarla cuando esté lista.</p>
          <button type="button" onClick={() => setFormulario({ ...VACIA })} className={`${botonPrimario} mt-2`}>
            Nueva salida
          </button>
        </div>
      )}

      {grupos.map(([titulo, lista]) =>
        lista.length ? (
          <section key={titulo} aria-label={titulo} className="mb-8">
            <h2 className="m-0 mb-3 text-xl font-extrabold">
              {titulo} <span className="text-base font-semibold text-ink-500">({lista.length})</span>
            </h2>
            <ul className="list-none m-0 p-0 bg-white rounded-[18px] border border-gray-200 divide-y divide-[#EEF2F7]">
              {lista.map((s) => (
                <li key={s.id} className="px-5 py-4 flex items-center justify-between flex-wrap gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-[1_1_340px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-ink-900">{s.nombre}</strong>
                      <Insignia tono={TONO_SALIDA[s.estado]}>{s.estado}</Insignia>
                    </div>
                    <p className="m-0 text-sm text-ink-500">
                      {s.destino} · {rangoFechas(s)}
                      {s.costo ? ` · ${pesos(s.costo)}` : ""}
                    </p>
                    <p className="m-0 mt-1 text-[13px] font-bold text-ink-600 tabular-nums">
                      {s.inscritos.total} de {s.cupos} inscritos
                      {s.inscritos.pendientes > 0 && <span className="ml-2 text-[#8A4B00]">· {s.inscritos.pendientes} por revisar</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/salud/salidas-estudiantes/${s.id}`} className={botonPrimario}>
                      Ver inscritos
                    </Link>
                    {s.estado === "Borrador" && (
                      <button type="button" onClick={() => cambiarEstado(s, "Publicada")} className={botonPrimario}>
                        Publicar
                      </button>
                    )}
                    {s.estado === "Publicada" && (
                      <button type="button" onClick={() => cambiarEstado(s, "Cerrada")} className={botonSecundario}>
                        Cerrar inscripciones
                      </button>
                    )}
                    {s.estado === "Cerrada" && (
                      <button type="button" onClick={() => cambiarEstado(s, "Publicada")} className={botonSecundario}>
                        Reabrir
                      </button>
                    )}
                    {s.estado !== "Cancelada" && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormulario({ ...VACIA, ...s, costo: s.costo ?? "", horaSalida: s.horaSalida || "", horaRegreso: s.horaRegreso || "" })
                        }
                        className="min-h-[42px] px-3 rounded-full text-sm font-bold text-primary hover:bg-primary-light"
                      >
                        Editar
                      </button>
                    )}
                    {s.estado !== "Cancelada" && (
                      <button
                        type="button"
                        onClick={() => cambiarEstado(s, "Cancelada")}
                        className="min-h-[42px] px-3 rounded-full text-sm font-bold text-red-700 hover:bg-red-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}

      {!formulario && <BotonFlotante onClick={() => setFormulario({ ...VACIA })}>Nueva salida</BotonFlotante>}
      {formulario && (
        <Ventana titulo={formulario.id ? "Editar salida" : "Nueva salida"} alCerrar={cerrar}>
          <FormularioSalida
            inicial={formulario}
            alGuardar={async (texto) => {
              cerrar();
              await cargar();
              setMensaje(texto);
            }}
          />
        </Ventana>
      )}
    </main>
  );
}

// Inscritos de una salida: revisar comprobantes, aprobar o rechazar, y
// descargar el listado para la ARL o el seguro.
export function SalidaInscritosPage() {
  const { id } = useParams();
  const [salida, setSalida] = useState(null);
  const [inscripciones, setInscripciones] = useState(null);
  const [filtro, setFiltro] = useState("todas");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [rechazando, setRechazando] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(null);

  const cargar = () =>
    Promise.all([http.get(`${API}/${id}`), http.get(`${API}/${id}/inscripciones`)])
      .then(([a, b]) => {
        setSalida(a.data.salida);
        setInscripciones(b.data.inscripciones);
      })
      .catch((e) => setError(mensajeError(e, "No pudimos cargar la salida.")));
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function revisar(ins, estado, observacion) {
    setError("");
    setMensaje("");
    setOcupado(ins.id);
    try {
      await http.patch(`${API}/${id}/inscripciones/${ins.id}`, { estado, observacion });
      setMensaje(estado === "Aprobada" ? `Aprobaste a ${ins.nombre}.` : `Rechazaste la inscripción de ${ins.nombre}; verá el motivo.`);
      setRechazando(null);
      setMotivo("");
      await cargar();
    } catch (err) {
      setError(mensajeError(err, "No pudimos guardar la revisión."));
    } finally {
      setOcupado(null);
    }
  }

  async function verComprobante(ins) {
    try {
      const res = await http.get(`${API}/${id}/inscripciones/${ins.id}/comprobante`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(mensajeError(err, "No pudimos abrir el comprobante."));
    }
  }

  const lista = (inscripciones || []).filter((i) => filtro === "todas" || i.estado === filtro);
  const cuenta = (e) => (inscripciones || []).filter((i) => i.estado === e).length;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <Link to="/salud/salidas-estudiantes" className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-bold text-primary-soft">
        <Icono nombre="izquierda" size={16} strokeWidth={2.2} /> Todas las salidas
      </Link>
      {error && (
        <div className="my-4">
          <Aviso>{error}</Aviso>
        </div>
      )}
      {!salida && !error && <p className="text-ink-500">Cargando…</p>}
      {salida && (
        <>
          <div className="flex justify-between items-end gap-4 flex-wrap mb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="m-0 text-[28px] sm:text-[34px] leading-tight font-extrabold">{salida.nombre}</h1>
                <Insignia tono={TONO_SALIDA[salida.estado]}>{salida.estado}</Insignia>
              </div>
              <p className="mt-1 mb-0 text-ink-500">
                {salida.destino} · {rangoFechas(salida)}
                {salida.responsable ? ` · Responsable: ${salida.responsable}` : ""}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => descargar(`${API}/${id}/listado`, {}, "listado-salida.xlsx")} className={botonPrimario}>
                <Icono nombre="descarga" size={18} strokeWidth={2.2} /> Listado para ARL (aprobados)
              </button>
              <button type="button" onClick={() => descargar(`${API}/${id}/listado`, { todos: 1 }, "inscritos-salida.xlsx")} className={botonSecundario}>
                Todos los inscritos
              </button>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
            {[
              ["Cupos", `${salida.inscritos.total} de ${salida.cupos}`, "ocupados"],
              ["Por revisar", cuenta("Pendiente"), "esperan tu revisión"],
              ["Aprobados", cuenta("Aprobada"), "van en el listado de la ARL"],
              ["Rechazados", cuenta("Rechazada"), "pueden corregir e inscribirse"],
            ].map(([t, v, d]) => (
              <div key={t} className="bg-white border border-gray-200 rounded-[20px] p-4 sm:p-5">
                <p className="m-0 text-[13px] text-ink-500">{t}</p>
                <p className="m-0 text-[28px] font-extrabold text-primary-dark tabular-nums">{v}</p>
                <p className="m-0 text-xs text-ink-500">{d}</p>
              </div>
            ))}
          </div>

          {mensaje && (
            <div className="mb-4" role="status">
              <Aviso tono="verde">{mensaje}</Aviso>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap mb-3">
            <label className="flex items-center gap-2 text-sm font-extrabold text-ink-900">
              Mostrar
              <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={`${claseCampo} !w-auto`}>
                <option value="todas">Todas ({(inscripciones || []).length})</option>
                {["Pendiente", "Aprobada", "Rechazada", "Cancelada"].map((e) => (
                  <option key={e} value={e}>
                    {TEXTO_INSCRIPCION[e]} ({cuenta(e)})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {inscripciones && lista.length === 0 && (
            <p className="m-0 text-ink-500 bg-white border border-gray-200 rounded-2xl p-6">
              {inscripciones.length ? "Ninguna inscripción con ese estado." : "Todavía no hay estudiantes inscritos."}
            </p>
          )}
          <ul className="list-none m-0 p-0 flex flex-col gap-3">
            {lista.map((i) => (
              <li key={i.id} className="bg-white border border-gray-200 rounded-[18px] p-4 sm:p-5">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-ink-900">{i.nombre}</strong>
                      <Insignia tono={TONO_INSCRIPCION[i.estado]}>{TEXTO_INSCRIPCION[i.estado]}</Insignia>
                    </div>
                    <dl className="m-0 mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["Documento", `${i.tipoDocumento} ${i.documento}`],
                        ["Programa", i.programa],
                        ["Celular", i.celular],
                        ["Correo", i.correo],
                        ["EPS", i.eps],
                        ["Emergencia", [i.contactoEmergencia, i.telefonoEmergencia].filter(Boolean).join(" · ") || "—"],
                      ].map(([k, val]) => (
                        <div key={k} className="min-w-0">
                          <dt className="inline text-ink-500">{k}: </dt>
                          <dd className="inline m-0 font-semibold text-ink-900 break-words">{val}</dd>
                        </div>
                      ))}
                    </dl>
                    {i.observacion && <p className="m-0 mt-2 text-sm text-ink-600">Observación: {i.observacion}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {i.tieneComprobante && (
                      <button type="button" onClick={() => verComprobante(i)} className={botonSecundario}>
                        <Icono nombre="archivo" size={16} /> Ver comprobante
                      </button>
                    )}
                    {i.estado !== "Cancelada" && i.estado !== "Aprobada" && (
                      <button type="button" disabled={ocupado === i.id} onClick={() => revisar(i, "Aprobada")} className={botonPrimario}>
                        Aprobar
                      </button>
                    )}
                    {i.estado !== "Cancelada" && i.estado !== "Rechazada" && (
                      <button
                        type="button"
                        onClick={() => setRechazando(rechazando === i.id ? null : i.id)}
                        className="min-h-[42px] px-3 rounded-full text-sm font-bold text-red-700 hover:bg-red-50"
                      >
                        Rechazar
                      </button>
                    )}
                  </div>
                </div>
                {rechazando === i.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      revisar(i, "Rechazada", motivo);
                    }}
                    className="mt-3 flex gap-2 flex-wrap items-end"
                  >
                    <label className="flex-1 min-w-[240px] flex flex-col gap-1.5 text-sm font-semibold text-ink-600">
                      Motivo del rechazo (lo verá el estudiante)
                      <input
                        autoFocus
                        required
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ej.: el comprobante no se ve completo"
                        className={claseCampo}
                      />
                    </label>
                    <button type="submit" disabled={ocupado === i.id} className={botonPrimario}>
                      Rechazar inscripción
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
