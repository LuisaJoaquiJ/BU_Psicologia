import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { descargar } from "../comunes/lib/salud";

// Horas del estudiante y descarga de su constancia.

export function useMisHoras() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    http
      .get("/deporte/mis-horas")
      .then((r) => setDatos(r.data))
      .catch(() => setError("No fue posible cargar tus horas."));
  }, []);
  return { datos, error };
}

export function descargarConstancia() {
  return descargar("/deporte/mis-horas/constancia", {}, "constancia-horas-deporte.pdf");
}
