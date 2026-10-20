import { useCallback, useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { fechaLarga } from "../comunes/lib/format";
import { Icono } from "../comunes/componentes/Iconos";
import { Ventana } from "../comunes/componentes/Ventana";
import { Aviso, Campo, Insignia, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";

// Jornadas y campanas de Salud integral (/mi-salud/jornadas): el estudiante
// ve las publicadas, se inscribe o cancela. Cuando el personal marca su
// asistencia aparece en "Mis participaciones".

const API = "/salud/estudiante/jornadas";
const fecha = (iso) => (iso ? fechaLarga(`${iso}T12:00:00Z`) : "");
const rango = (j) => (j.fechaFin && j.fechaFin !== j.fechaInicio ? `${fecha(j.fechaInicio)} al ${fecha(j.fechaFin).toLowerCase()}` : fecha(j.fechaInicio));
const mensajeError = (err, porDefecto) => err?.response?.data?.message || porDefecto;

function Dato({ icono, children }) {
  return (
    <li className="flex items-start gap-2 text-sm text-ink-700">
      <Icono nombre={icono} className="w-4 h-4 mt-0.5 shrink-0 text-[#0d9488]" />
      <span>{children}</span>
    </li>
  );
}

// Primera inscripcion: documento, programa y autorizacion de datos (Ley 1581).
function FormularioDatos({ jornada, datos, alTerminar }) {
  const previo = datos.misDatos;
  const [v, setV] = useState({ tipoDocumento: previo?.tipoDocumento || "CC", documento: previo?.documento || "", programa: previo?.programa || "", consentimiento: false });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      await http.post(`${API}/${jornada.id}/inscripcion`, v);
      alTerminar(`Te inscribiste en «${jornada.nombre}».`);
    } catch (err) {
      setError(mensajeError(err, "No pudimos inscribirte."));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <p className="m-0 text-sm text-ink-600">
        Es tu primera inscripción en Salud integral. Con estos datos la Unidad de Salud registra tu asistencia.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Tipo de documento">
          <select value={v.tipoDocumento} onChange={set("tipoDocumento")} className={claseCampo} disabled={Boolean(previo)}>
            {Object.entries(datos.tiposDocumento || { CC: "Cédula de ciudadanía", TI: "Tarjeta de identidad" }).map(([id, texto]) => (
              <option key={id} value={id}>
                {texto}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Número de documento">
          <input required inputMode="numeric" value={v.documento} onChange={set("documento")} className={claseCampo} disabled={Boolean(previo)} />
        </Campo>
      </div>
      <Campo etiqueta="Programa académico">
        <input list="programas-jornada" value={v.programa} onChange={set("programa")} placeholder="Escribe o elige tu programa" className={claseCampo} />
        <datalist id="programas-jornada">
          {(datos.programas || []).map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Campo>
      <label className="flex gap-3 items-start text-sm text-ink-700 cursor-pointer">
        <input type="checkbox" required checked={v.consentimiento} onChange={set("consentimiento")} className="w-5 h-5 mt-0.5 accent-[#0d9488] shrink-0" />
        Autorizo a la Uniautónoma del Cauca a tratar mis datos personales para registrar mi participación en las actividades de Salud integral (Ley 1581 de 2012).
      </label>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex justify-end">
        <button type="submit" disabled={enviando} className={botonPrimario}>
          {enviando ? "Inscribiendo…" : "Inscribirme"}
        </button>
      </div>
    </form>
  );
}

function TarjetaJornada({ jornada, ocupado, alInscribirse, alCancelar }) {
  let accion;
  if (jornada.asistio) accion = <Insignia tono="verde">Asististe</Insignia>;
  else if (jornada.inscrito)
    accion = (
      <>
        <Insignia tono="verde">Inscrito(a)</Insignia>
        <button type="button" disabled={ocupado} onClick={() => alCancelar(jornada)} className={botonSecundario}>
          Cancelar
        </button>
      </>
    );
  else if (jornada.cuposDisponibles === 0) accion = <span className="text-sm font-semibold text-ink-500">Sin cupos</span>;
  else
    accion = (
      <button type="button" disabled={ocupado} onClick={() => alInscribirse(jornada)} className={botonPrimario}>
        Inscribirme
      </button>
    );

  return (
    <article className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl bg-[#ccfbf1] text-[#0d9488] grid place-items-center shrink-0">
          <Icono nombre="pulso" className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          {jornada.categoria && <p className="m-0 text-xs font-bold text-[#0d9488]">{jornada.categoria}</p>}
          <h3 className="m-0 text-lg font-extrabold leading-tight">{jornada.nombre}</h3>
        </div>
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
        <Dato icono="calendario">{rango(jornada)}</Dato>
        {jornada.horaInicio && (
          <Dato icono="reloj">
            {jornada.horaInicio}
            {jornada.horaFin ? ` a ${jornada.horaFin}` : ""}
          </Dato>
        )}
        {jornada.lugar && <Dato icono="ubicacion">{jornada.lugar}</Dato>}
        {jornada.cupos ? (
          <Dato icono="usuarios">
            {jornada.cuposDisponibles} de {jornada.cupos} cupos disponibles
          </Dato>
        ) : (
          <Dato icono="usuarios">Sin límite de cupos</Dato>
        )}
      </ul>
      {jornada.descripcion && <p className="m-0 text-sm text-ink-700 whitespace-pre-line">{jornada.descripcion}</p>}
      <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-end gap-3 min-h-[44px]">{accion}</div>
    </article>
  );
}

export function JornadasEstudiantePage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [formulario, setFormulario] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(
    () =>
      http
        .get(API)
        .then((res) => setDatos(res.data))
        .catch((err) => {
          setError(mensajeError(err, "No pudimos cargar las jornadas."));
          setDatos({ jornadas: [] });
        }),
    [],
  );
  useEffect(() => {
    cargar();
  }, [cargar]);

  // Ya registrado(a) en Salud: un clic. Si no, pide sus datos una vez.
  async function inscribirse(j) {
    setError("");
    setExito("");
    if (!datos.registrado) return setFormulario(j);
    setOcupado(j.id);
    try {
      await http.post(`${API}/${j.id}/inscripcion`, {});
      setExito(`Te inscribiste en «${j.nombre}».`);
      await cargar();
    } catch (err) {
      setError(mensajeError(err, "No pudimos inscribirte."));
    } finally {
      setOcupado(null);
    }
  }

  async function cancelar(j) {
    if (!window.confirm(`¿Cancelar tu inscripción en «${j.nombre}»? Liberarás tu cupo.`)) return;
    setError("");
    setExito("");
    setOcupado(j.id);
    try {
      await http.patch(`${API}/${j.id}/inscripcion/cancelar`);
      setExito("Cancelaste tu inscripción.");
      await cargar();
    } catch (err) {
      setError(mensajeError(err, "No pudimos cancelar la inscripción."));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-16 flex flex-col gap-8">
      <header>
        <h1 className="m-0 text-3xl sm:text-4xl font-extrabold">Jornadas y campañas</h1>
        <p className="m-0 mt-2 text-ink-500 max-w-[680px]">
          Vacunación, tamizajes, donación de sangre y más actividades de la Unidad de Salud. Inscríbete y, cuando asistas, quedará en tus participaciones.
        </p>
      </header>

      {error && <Aviso>{error}</Aviso>}
      {exito && <Aviso tono="verde">{exito}</Aviso>}

      {!datos ? (
        <p className="text-ink-500">Cargando…</p>
      ) : datos.jornadas.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-ink-500">No hay jornadas ni campañas abiertas por ahora.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {datos.jornadas.map((j) => (
            <TarjetaJornada key={j.id} jornada={j} ocupado={ocupado === j.id} alInscribirse={inscribirse} alCancelar={cancelar} />
          ))}
        </div>
      )}

      {formulario && (
        <Ventana titulo={`Inscripción · ${formulario.nombre}`} alCerrar={() => setFormulario(null)}>
          <FormularioDatos
            jornada={formulario}
            datos={datos}
            alTerminar={async (texto) => {
              setFormulario(null);
              setExito(texto);
              await cargar();
            }}
          />
        </Ventana>
      )}
    </main>
  );
}
