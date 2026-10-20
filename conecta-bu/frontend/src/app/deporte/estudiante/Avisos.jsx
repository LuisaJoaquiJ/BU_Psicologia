import { useEffect, useState } from "react";
import { Icono } from "../comunes/componentes/Iconos";
import { http } from "../../../lib/api/http";
import { TarjetaComunicado } from "../comunes/Comunicados";

// Comunicados que le llegan al estudiante.

// Comunicados de Deportes para el estudiante (RF-011). Se pueden ocultar.
export function Avisos() {
  const [avisos, setAvisos] = useState([]);
  const [ocultos, setOcultos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("deporte_avisos_ocultos") || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    http
      .get("/deporte/avisos")
      .then((r) => setAvisos(r.data.avisos))
      .catch(() => {});
  }, []);
  const visibles = avisos.filter((a) => !ocultos.includes(a.id));
  if (!visibles.length) return null;
  const ocultar = (id) => {
    const n = [...ocultos, id].slice(-100);
    setOcultos(n);
    try {
      localStorage.setItem("deporte_avisos_ocultos", JSON.stringify(n));
    } catch {
      /* sin almacenamiento: solo se oculta en esta visita */
    }
  };
  return (
    <section aria-label="Comunicados de Deportes" className="flex flex-col gap-3">
      <h2 className="m-0 font-sans text-lg font-bold text-primary-dark flex items-center gap-2">
        <Icono nombre="chat" size={18} /> Comunicados ({visibles.length})
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {visibles.slice(0, 4).map((a) => (
          <div key={a.id} className="relative">
            <TarjetaComunicado a={a} />
            <button type="button" onClick={() => ocultar(a.id)} aria-label={`Ocultar «${a.titulo}»`} className="absolute top-2 right-2 w-8 h-8 rounded-full text-ink-500 hover:bg-gray-100 grid place-items-center">
              <Icono nombre="cerrar" size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
