import { useState } from "react";
import { http } from "../../../lib/api/http";
import { hoyISO, mensajeError } from "../comun/formato";
import { campo } from "./Marco";

const CONTEOS = [
  ["conteoEstudiantes", "Estudiantes"],
  ["conteoDocentes", "Docentes"],
  ["conteoAdministrativos", "Administrativos"],
  ["conteoEgresados", "Egresados"],
];

// Codigo de asistencia, asistentes sin cuenta y listado en PDF de un grupo o
// un evento. "ruta" es /cultura/admin/grupos/:id o /cultura/admin/agenda/:id.
export function ControlAsistencia({ ruta, fecha, evidencia }) {
  const [abierto, setAbierto] = useState(null);
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

  const abrir = () => accion(async () => setAbierto((await http.post(`${ruta}/asistencia/abrir`)).data));
  const cerrar = () =>
    accion(async () => {
      await http.post(`${ruta}/asistencia/cerrar`);
      setAbierto(null);
    }, "Se cerró el registro de asistencia.");
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
      {abierto ? (
        <div className="rounded-xl bg-primary-dark text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-white/85">
            Código abierto hasta las {new Date(abierto.abiertaHasta).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}
          </span>
          <strong className="font-mono text-2xl tracking-[0.2em]">{abierto.codigo}</strong>
          <button type="button" onClick={cerrar} className="min-h-[40px] px-4 rounded-full bg-white text-primary-dark font-bold">
            Cerrar registro
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={abrir} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold">
            Abrir código de asistencia
          </button>
          <button type="button" onClick={descargar} className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold">
            Listado en PDF
          </button>
          {evidencia && (
            <label className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold inline-flex items-center cursor-pointer">
              Subir foto o planilla
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={subir} className="sr-only" />
            </label>
          )}
        </div>
      )}
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
      {error && <p className="m-0 text-sm text-red-700">{error}</p>}
      {mensaje && <p className="m-0 text-sm text-emerald-800">{mensaje}</p>}
    </div>
  );
}
