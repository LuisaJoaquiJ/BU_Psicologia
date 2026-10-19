import { useEffect, useState } from "react";
import { http } from "../../../../lib/api/http";

// Salidas institucionales y reportes SST: utilidades compartidas por el
// formulario (cualquier persona) y la bandeja del personal de Salud.

let cache = null;

export function useCatalogoSst() {
  const [catalogo, setCatalogo] = useState(cache);
  const [error, setError] = useState("");
  useEffect(() => {
    if (cache) return;
    http
      .get("/reportes-sst/catalogos")
      .then((res) => {
        cache = res.data;
        setCatalogo(res.data);
      })
      .catch(() => setError("No fue posible cargar el formulario. Recarga la página."));
  }, []);
  return { catalogo, error };
}

export const TONO_ESTADO = {
  Recibido: "azul",
  Verificado: "verde",
  RequiereAjustes: "dorado",
  Cerrado: "gris",
};

// Icono y color de cada grupo de reportes.
export const ESTILO_GRUPO = {
  estudiantes: { icono: "usuarios", color: "bg-primary text-gold" },
  representacion: { icono: "escudo", color: "bg-gold text-primary" },
  posgrados: { icono: "birrete", color: "bg-[#0d9488] text-white" },
  riesgo: { icono: "triangulo", color: "bg-red-600 text-white" },
};

export function fechaLarga(iso) {
  if (!iso) return "";
  return new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function hora12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const sufijo = h < 12 ? "a. m." : "p. m.";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${sufijo}`;
}

// Texto del destino de una salida (o del lugar de una condicion insegura).
export function destinoDe(r) {
  if (r.tipo === "CondicionInsegura") return r.lugarEvento;
  return [r.destino, r.pais && r.pais !== "Colombia" ? r.pais : null].filter(Boolean).join(", ");
}

export function tituloDe(r) {
  if (r.tipo === "CondicionInsegura") return r.descripcion?.slice(0, 90) || "Condición insegura";
  return r.evento || r.motivo || r.tipoNombre;
}

// Dias que faltan para una fecha (negativo si ya paso).
export function diasPara(iso) {
  if (!iso) return null;
  const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  return Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00Z`) - new Date(`${hoy}T00:00:00Z`)) / 86400000);
}

export function tamano(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
