import { AvisoFlotante } from "../../../components/avisos/Avisos";
import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { horarioTexto, hoyISO, mensajeError } from "../comun/formato";
import { campo } from "./Marco";
import { SelectorUbicacion } from "./SelectorUbicacion";

const CONTEOS = [
  ["conteoEstudiantes", "Estudiantes"],
  ["conteoDocentes", "Docentes"],
  ["conteoAdministrativos", "Administrativos"],
  ["conteoEgresados", "Egresados"],
];

// Misma regla del servidor: se puede marcar desde 15 minutos antes de la
// sesion hasta 15 minutos despues del final.
const ANTES_MIN = 15;
const DESPUES_MIN = 15;
const aMinutos = (h) => {
  const [hh, mm] = String(h || "").split(":").map(Number);
  return Number.isInteger(hh) && Number.isInteger(mm) ? hh * 60 + mm : null;
};
const aHora = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function ventana({ horario, fecha, horaInicio, horaFin, fechaInicio, fechaFin }) {
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  const hoy = d.toISOString().slice(0, 10);
  const desde = fechaInicio ? String(fechaInicio).slice(0, 10) : null;
  const hasta = fechaFin ? String(fechaFin).slice(0, 10) : null;
  if (horario && desde && hoy < desde) return { puede: false, texto: `El taller empieza el ${desde}. Los estudiantes podrán marcar desde entonces, en su horario.` };
  if (horario && hasta && hoy > hasta) return { puede: false, texto: `El taller terminó el ${hasta}.` };
  const diaHoy = ((d.getUTCDay() + 6) % 7) + 1;
  const ahora = d.getUTCHours() * 60 + d.getUTCMinutes();
  let franjas;
  if (horario) {
    franjas = horario.filter((h) => Number(h.dia) === diaHoy);
    if (!franjas.length) return { puede: false, texto: `Hoy no hay sesión. Se marca en el horario: ${horarioTexto(horario)}.` };
  } else {
    if (String(fecha).slice(0, 10) !== hoy) return { puede: false, texto: `Se marca el día del evento, desde las ${aHora(Math.max(0, aMinutos(horaInicio) - ANTES_MIN))}.` };
    franjas = [{ inicio: horaInicio, fin: horaFin }];
  }
  const lista = franjas.map((f) => ({ inicio: aMinutos(f.inicio), fin: aMinutos(f.fin) })).filter((f) => f.inicio !== null && f.fin > f.inicio).sort((a, b) => a.inicio - b.inicio);
  const enCurso = lista.find((f) => ahora >= f.inicio - ANTES_MIN && ahora <= f.fin);
  if (enCurso) return { puede: true, texto: `Sesión de hoy: ${aHora(enCurso.inicio)}–${aHora(enCurso.fin)}. Se puede marcar hasta las ${aHora(enCurso.fin + DESPUES_MIN)}.` };
  const proxima = lista.find((f) => ahora < f.inicio - ANTES_MIN);
  if (proxima) return { puede: false, texto: `La sesión de hoy es de ${aHora(proxima.inicio)} a ${aHora(proxima.fin)}. Los estudiantes podrán marcar desde las ${aHora(proxima.inicio - ANTES_MIN)}.` };
  const ultima = lista[lista.length - 1];
  return { puede: false, texto: ultima ? `La sesión de hoy terminó a las ${aHora(ultima.fin)}. Si alguien asistió, márcalo a mano en la lista.` : "Falta la hora de inicio y fin para poder marcar." };
}

// Codigo de asistencia, asistentes sin cuenta y listado en PDF de un grupo o
// un evento. "ruta" es /cultura/admin/grupos/:id o /cultura/admin/agenda/:id.
// Para saber cuando se puede abrir: "horario" (grupo) o "horaInicio"/"horaFin" con "fecha" (evento).
export function ControlAsistencia({ ruta, fecha, evidencia, horario, horaInicio, horaFin, fechaInicio, fechaFin, ubicacion, alCambiar, puedeUbicar = true, puedeEvidencia = true }) {
  const [, setReloj] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setReloj((n) => n + 1), 30000); // recalcula la ventana cada 30 s
    return () => clearInterval(t);
  }, []);
  const estado = ventana({ horario, fecha, horaInicio, horaFin, fechaInicio, fechaFin });
  const guardada = ubicacion?.latitud !== null && ubicacion?.latitud !== undefined;
  const [punto, setPunto] = useState({ latitud: ubicacion?.latitud ?? null, longitud: ubicacion?.longitud ?? null, radioM: ubicacion?.radioM || 100 });
  const [abriendoMapa, setAbriendoMapa] = useState(false);
  const conPunto = punto.latitud !== null && punto.latitud !== undefined;
  const [conteos, setConteos] = useState({ conteoEstudiantes: 0, conteoDocentes: 0, conteoAdministrativos: 0, conteoEgresados: 0 });
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const dia = fecha || hoyISO();

  async function accion(fn, listo) {
    setError("");
    setMensaje("");
    try {
      await fn();
      if (listo) setMensaje(listo);
    } catch (err) {
      setError(mensajeError(err, "No fue posible completar la acción."));
    }
  }

  const guardarUbicacion = () =>
    accion(async () => {
      await http.put(`${ruta}/ubicacion`, { latitud: punto.latitud, longitud: punto.longitud, radioM: punto.radioM });
      alCambiar?.();
      setAbriendoMapa(false);
    }, "Quedó guardada la ubicación del sitio.");
  const quitarUbicacion = () =>
    accion(async () => {
      await http.put(`${ruta}/ubicacion`, { latitud: null, longitud: null });
      setPunto({ latitud: null, longitud: null, radioM: punto.radioM });
      alCambiar?.();
    }, "Se quitó la ubicación del sitio.");
  const guardarConteos = () => accion(() => http.put(`${ruta}/conteos`, { ...conteos, fecha: dia }), "Quedaron guardados los asistentes sin cuenta.");
  const subir = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    const datos = new FormData();
    datos.append("evidencia", archivo);
    Object.entries(evidencia).forEach(([k, v]) => datos.append(k, v));
    datos.append("tipo", archivo.type === "application/pdf" ? "planilla" : "fotografia");
    accion(() => http.post("/cultura/admin/evidencias", datos), "Quedó guardada la evidencia.");
  };
  const descargar = () =>
    accion(async () => {
      const r = await http.get(`${ruta}/listado`, { params: { fecha: dia }, responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `listado-asistencia-${dia}.pdf`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className={`rounded-xl bg-primary-light/60 px-4 py-3 flex-col gap-2 ${puedeUbicar ? "flex" : "hidden"}`}>
        <p className="m-0 text-sm font-extrabold text-primary-dark">Ubicación del sitio</p>
        {!abriendoMapa ? (
          <>
            {guardada ? (
              <p className="m-0 text-sm text-ink-700">
                Guardada · los estudiantes marcan a menos de {ubicacion.radioM} m.{" "}
                <a href={`https://www.google.com/maps?q=${ubicacion.latitud},${ubicacion.longitud}`} target="_blank" rel="noreferrer" className="font-semibold text-primary">
                  Ver en Google Maps
                </a>
              </p>
            ) : (
              <p className="m-0 text-sm text-[#5C4206]">Falta marcarla. Sin ubicación los estudiantes no pueden registrar su asistencia.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAbriendoMapa(true)} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold">
                {guardada ? "Cambiar en el mapa" : "Marcar en el mapa"}
              </button>
              {guardada && (
                <button type="button" onClick={quitarUbicacion} className="min-h-[44px] px-4 rounded-full border border-red-300 text-red-700 bg-white/70 font-bold hover:bg-red-50">
                  Quitar ubicación
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <SelectorUbicacion valor={punto} alCambiar={setPunto} />
            <div className="flex gap-2">
              <button type="button" onClick={guardarUbicacion} disabled={!conPunto} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold disabled:opacity-50">
                Guardar ubicación
              </button>
              <button type="button" onClick={() => setAbriendoMapa(false)} className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold">
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
          <button type="button" onClick={descargar} className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold">
            Listado en PDF
          </button>
          {evidencia && puedeEvidencia && (
            <label className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold inline-flex items-center cursor-pointer">
              Subir foto o planilla
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={subir} className="sr-only" />
            </label>
          )}
        </div>
        <p id={`ventana-${ruta}`} className={`m-0 text-sm ${estado.puede ? "text-[#0B6B61] font-semibold" : "text-ink-500"}`}>
          {estado.texto}
        </p>
      <details>
        <summary className="min-h-[44px] flex items-center text-sm font-semibold cursor-pointer">Asistentes sin cuenta</summary>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          {CONTEOS.map(([clave, texto]) => (
            <label key={clave} className="text-sm font-semibold">
              {texto}
              <input
                type="number"
                min="0"
                className={`${campo} w-full mt-1`}
                value={conteos[clave]}
                onChange={(e) => setConteos({ ...conteos, [clave]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <button type="button" onClick={guardarConteos} className="mt-2 min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold">
          Guardar conteo de {dia}
        </button>
      </details>
      {error && <AvisoFlotante tono="error">{error}</AvisoFlotante>}
      {mensaje && <AvisoFlotante tono="exito">{mensaje}</AvisoFlotante>}
    </div>
  );
}
