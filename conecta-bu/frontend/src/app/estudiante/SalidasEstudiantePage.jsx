import { useCallback, useEffect, useState } from "react";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";
import { fechaLarga } from "../../lib/format";
import { Icono } from "../../components/Iconos";
import { Ventana } from "../../components/Ventana";
import { Aviso, Campo, Insignia, botonPrimario, botonSecundario, claseCampo } from "../../components/ui";

// Salidas de Salud integral para el estudiante (/mi-salud/salidas): ve las
// salidas publicadas por el personal de Salud, se inscribe con los datos que
// pide la ARL o el seguro y sigue el estado de su inscripcion.

const API = "/salud/estudiante/salidas";
const TONO = { Pendiente: "dorado", Aprobada: "verde", Rechazada: "rojo", Cancelada: "gris" };
const TEXTO = { Pendiente: "En revisión", Aprobada: "Aprobada", Rechazada: "Rechazada", Cancelada: "Cancelada" };
const TIPOS_DOC = [
  ["CC", "Cédula de ciudadanía"],
  ["TI", "Tarjeta de identidad"],
  ["CE", "Cédula de extranjería"],
  ["PA", "Pasaporte"],
];

const pesos = (n) => (n === null || n === undefined ? "" : `$${Number(n).toLocaleString("es-CO")}`);
const fecha = (iso) => (iso ? fechaLarga(`${iso}T12:00:00Z`) : "");
const rango = (s) =>
  s.fechaRegreso && s.fechaRegreso !== s.fechaSalida ? `${fecha(s.fechaSalida)} al ${fecha(s.fechaRegreso).toLowerCase()}` : fecha(s.fechaSalida);
const mensajeError = (err, porDefecto) => err?.response?.data?.message || porDefecto;

function Dato({ icono, children }) {
  return (
    <li className="flex items-start gap-2 text-sm text-ink-700">
      <Icono nombre={icono} className="w-4 h-4 mt-0.5 shrink-0 text-[#0d9488]" />
      <span>{children}</span>
    </li>
  );
}

function FormularioInscripcion({ salida, programas, previo, alTerminar }) {
  const { usuario } = useAuth();
  const [v, setV] = useState({
    tipoDocumento: previo?.tipoDocumento || "CC",
    documento: previo?.documento || "",
    programa: previo?.programa || "",
    celular: previo?.celular || "",
    eps: previo?.eps || "",
    contactoEmergencia: previo?.contactoEmergencia || "",
    telefonoEmergencia: previo?.telefonoEmergencia || "",
    consentimiento: false,
  });
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const datos = new FormData();
      Object.entries(v).forEach(([k, valor]) => datos.append(k, String(valor)));
      if (archivo) datos.append("comprobante", archivo);
      await http.post(`${API}/${salida.id}/inscripcion`, datos);
      await alTerminar(`Te inscribiste en «${salida.nombre}». El personal de Salud integral revisará tu inscripción.`);
    } catch (err) {
      setError(mensajeError(err, "No pudimos registrar tu inscripción."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <div className="bg-white rounded-[18px] p-5 sm:p-6">
        <p className="m-0 font-extrabold text-lg">{salida.nombre}</p>
        <p className="m-0 mt-1 text-sm text-ink-500">
          {salida.destino} · {rango(salida)}
        </p>
      </div>

      <div className="bg-white rounded-[18px] p-5 sm:p-6 grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre completo">
          <input value={usuario?.nombre || ""} readOnly className={`${claseCampo} bg-gray-50 text-ink-500`} />
        </Campo>
        <Campo etiqueta="Correo institucional">
          <input value={usuario?.email || usuario?.emailInstitucional || ""} readOnly className={`${claseCampo} bg-gray-50 text-ink-500`} />
        </Campo>
        <Campo etiqueta="Tipo de documento">
          <select value={v.tipoDocumento} onChange={set("tipoDocumento")} className={claseCampo}>
            {TIPOS_DOC.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Número de identificación">
          <input required inputMode="numeric" value={v.documento} onChange={set("documento")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Programa">
          <input
            required
            list="programas-salida"
            value={v.programa}
            onChange={set("programa")}
            placeholder="Escribe o elige tu programa"
            className={claseCampo}
          />
          <datalist id="programas-salida">
            {programas.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta="Número de celular">
          <input required type="tel" value={v.celular} onChange={set("celular")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="EPS">
          <input required value={v.eps} onChange={set("eps")} placeholder="Ej.: Nueva EPS" className={claseCampo} />
        </Campo>
        <div className="hidden sm:block" />
        <Campo etiqueta="Contacto de emergencia (opcional)">
          <input value={v.contactoEmergencia} onChange={set("contactoEmergencia")} placeholder="Nombre y parentesco" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Teléfono de emergencia (opcional)">
          <input type="tel" value={v.telefonoEmergencia} onChange={set("telefonoEmergencia")} className={claseCampo} />
        </Campo>
      </div>

      {(salida.costo || salida.infoPago || salida.pideComprobante) && (
        <div className="bg-white rounded-[18px] p-5 sm:p-6 flex flex-col gap-3">
          <p className="m-0 font-bold">Pago{salida.costo ? ` · ${pesos(salida.costo)}` : ""}</p>
          {salida.infoPago && <p className="m-0 text-sm text-ink-700 whitespace-pre-line">{salida.infoPago}</p>}
          {salida.pideComprobante && (
            <Campo etiqueta="Comprobante de pago" ayuda="PDF o imagen, máximo 10 MB.">
              <input
                required
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                className="block w-full text-sm min-h-[44px] file:mr-3 file:min-h-[44px] file:px-4 file:rounded-full file:border-0 file:bg-[#19407B] file:text-white file:font-semibold"
              />
            </Campo>
          )}
        </div>
      )}

      <label className="bg-white rounded-[18px] p-5 sm:p-6 flex items-start gap-3 text-sm text-ink-700 cursor-pointer">
        <input required type="checkbox" checked={v.consentimiento} onChange={set("consentimiento")} className="w-5 h-5 mt-0.5 shrink-0 accent-[#19407B]" />
        <span>
          Autorizo a la Unidad de Salud integral a usar estos datos para organizar la salida y reportarla a la ARL o al seguro estudiantil. Solo el personal de
          Salud integral los puede ver.
        </span>
      </label>

      {error && <Aviso>{error}</Aviso>}
      <div className="flex justify-end">
        <button type="submit" disabled={enviando} className={botonPrimario}>
          {enviando ? "Enviando…" : "Enviar inscripción"}
        </button>
      </div>
    </form>
  );
}

function TarjetaSalida({ salida, alInscribirse }) {
  const mia = salida.miInscripcion;
  const activa = mia && ["Pendiente", "Aprobada"].includes(mia.estado);
  let accion;
  if (activa) accion = <Insignia tono={TONO[mia.estado]}>Inscripción {TEXTO[mia.estado].toLowerCase()}</Insignia>;
  else if (salida.inscripcionAbierta)
    accion = (
      <button type="button" onClick={() => alInscribirse(salida)} className={botonPrimario}>
        {mia ? "Inscribirme de nuevo" : "Inscribirme"}
      </button>
    );
  else accion = <span className="text-sm font-semibold text-ink-500">{salida.cuposDisponibles === 0 ? "Sin cupos" : "Inscripciones cerradas"}</span>;

  return (
    <article className="bg-white border border-gray-200 rounded-[22px] p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl bg-[#ccfbf1] text-[#0d9488] grid place-items-center shrink-0">
          <Icono nombre="bus" className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-lg font-extrabold leading-tight">{salida.nombre}</h3>
          <p className="m-0 mt-0.5 text-sm text-ink-500">{salida.destino}</p>
        </div>
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
        <Dato icono="calendario">
          {rango(salida)}
          {salida.horaSalida ? ` · sale ${salida.horaSalida}` : ""}
        </Dato>
        {salida.lugarEncuentro && <Dato icono="ubicacion">{salida.lugarEncuentro}</Dato>}
        {salida.programa && <Dato icono="birrete">{salida.programa}</Dato>}
        <Dato icono="usuarios">
          {salida.cuposDisponibles} de {salida.cupos} cupos disponibles
        </Dato>
        {salida.costo ? <Dato icono="archivo">Costo {pesos(salida.costo)}</Dato> : <Dato icono="archivo">Sin costo</Dato>}
        <Dato icono="reloj">Inscripciones hasta el {fecha(salida.fechaLimiteInscripcion).toLowerCase()}</Dato>
      </ul>
      {salida.descripcion && <p className="m-0 text-sm text-ink-700 whitespace-pre-line">{salida.descripcion}</p>}
      <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-end min-h-[44px]">{accion}</div>
    </article>
  );
}

export function SalidasEstudiantePage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [inscribiendo, setInscribiendo] = useState(null);
  const [cancelando, setCancelando] = useState(null);

  const cargar = useCallback(
    () =>
      http
        .get(API)
        .then((res) => setDatos(res.data))
        .catch((err) => {
          setError(mensajeError(err, "No pudimos cargar las salidas."));
          setDatos({ salidas: [], misInscripciones: [], programas: [] });
        }),
    [],
  );
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cancelar(ins) {
    if (!window.confirm(`¿Cancelar tu inscripción en «${ins.salida?.nombre}»? Liberarás tu cupo.`)) return;
    setError("");
    setExito("");
    setCancelando(ins.id);
    try {
      await http.patch(`${API}/${ins.salidaId}/inscripcion/cancelar`);
      setExito("Cancelaste tu inscripción.");
      await cargar();
    } catch (err) {
      setError(mensajeError(err, "No pudimos cancelar la inscripción."));
    } finally {
      setCancelando(null);
    }
  }

  const previo = datos?.misInscripciones?.[0];

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-16 flex flex-col gap-8">
      <header>
        <h1 className="m-0 text-3xl sm:text-4xl font-extrabold">Salidas</h1>
        <p className="m-0 mt-2 text-ink-500 max-w-[680px]">
          Salidas académicas y visitas técnicas organizadas con Salud integral. Inscríbete aquí: tus datos se usan para reportar la salida a la ARL o al seguro.
        </p>
      </header>

      {error && <Aviso>{error}</Aviso>}
      {exito && <Aviso tono="verde">{exito}</Aviso>}

      <section className="flex flex-col gap-4">
        <h2 className="m-0 text-xl font-extrabold">Salidas disponibles</h2>
        {!datos ? (
          <p className="text-ink-500">Cargando…</p>
        ) : datos.salidas.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-[22px] p-8 text-center text-ink-500">No hay salidas publicadas por ahora.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {datos.salidas.map((s) => (
              <TarjetaSalida key={s.id} salida={s} alInscribirse={setInscribiendo} />
            ))}
          </div>
        )}
      </section>

      {datos?.misInscripciones?.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="m-0 text-xl font-extrabold">Mis inscripciones</h2>
          <ul className="m-0 p-0 list-none bg-white border border-gray-200 rounded-[22px] divide-y divide-gray-100">
            {datos.misInscripciones.map((ins) => (
              <li key={ins.id} className="p-4 sm:p-5 flex flex-wrap items-center gap-3 justify-between">
                <div className="min-w-0">
                  <p className="m-0 font-bold">{ins.salida?.nombre || "Salida"}</p>
                  <p className="m-0 text-sm text-ink-500">
                    {ins.salida?.destino}
                    {ins.salida?.fechaSalida ? ` · ${fecha(ins.salida.fechaSalida)}` : ""}
                  </p>
                  {ins.estado === "Rechazada" && ins.observacion && <p className="m-0 mt-1 text-sm text-red-700">Motivo: {ins.observacion}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <Insignia tono={TONO[ins.estado]}>{TEXTO[ins.estado]}</Insignia>
                  {["Pendiente", "Aprobada"].includes(ins.estado) && ins.salida?.estado !== "Cancelada" && (
                    <button type="button" disabled={cancelando === ins.id} onClick={() => cancelar(ins)} className={botonSecundario}>
                      {cancelando === ins.id ? "Cancelando…" : "Cancelar"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inscribiendo && (
        <Ventana titulo="Inscripción a la salida" alCerrar={() => setInscribiendo(null)}>
          <FormularioInscripcion
            salida={inscribiendo}
            programas={datos?.programas || []}
            previo={previo}
            alTerminar={async (texto) => {
              setInscribiendo(null);
              setError("");
              setExito(texto);
              await cargar();
            }}
          />
        </Ventana>
      )}
    </main>
  );
}
