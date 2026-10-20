import { useCallback, useEffect, useState } from "react";
import { http } from "../../../lib/api/http";

// Catálogos de Deporte (disciplinas, docentes, días, categorías...) para los formularios.

export function useCatalogosDeporte() {
  const [cat, setCat] = useState(null);
  const recargar = useCallback(() => http.get("/deporte/admin/catalogos").then((r) => setCat(r.data)), []);
  useEffect(() => {
    recargar();
  }, [recargar]);
  return { cat, recargar };
}
