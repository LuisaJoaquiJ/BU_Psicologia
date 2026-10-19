import { useEffect, useState } from "react";
import { http } from "../../../../lib/api/http";

// Utilidades compartidas por las pantallas de Salud integral.

let catalogosCache = null;

// Catalogos del modulo (programas, poblaciones, categorias, periodos...).
export function useCatalogos() {
  const [catalogos, setCatalogos] = useState(catalogosCache);
  useEffect(() => {
    if (catalogosCache) return;
    http.get("/salud/catalogos").then((res) => {
      catalogosCache = res.data;
      setCatalogos(res.data);
    });
  }, []);
  return catalogos;
}

export function refrescarCatalogos() {
  catalogosCache = null;
}

export const POBLACION_TEXTO = {
  Estudiante: "Estudiante",
  Docente: "Docente",
  Administrativo: "Administrativo",
  Egresado: "Egresado",
  Externo: "Externo / visitante",
};

export const COLOR_POBLACION = {
  Estudiante: "#163F86",
  Docente: "#0d9488",
  Administrativo: "#d97706",
  Egresado: "#7c3aed",
  Externo: "#9CA3AF",
};

export function hoyISO() {
  // Fecha local de Colombia (UTC-5).
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function fechaCorta(iso) {
  if (!iso) return "";
  return new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function nombreCompleto(p) {
  return p ? `${p.nombres} ${p.apellidos}` : "";
}

export function mensajeError(err, porDefecto = "Ocurrió un error. Intenta de nuevo.") {
  return err?.response?.data?.message || porDefecto;
}

// Descarga un archivo del backend (Excel) con la sesion actual.
export async function descargar(ruta, params, nombre) {
  const res = await http.get(ruta, { params, responseType: "blob" });
  const disposicion = res.headers?.["content-disposition"] || "";
  const sugerido = /filename="([^"]+)"/.exec(disposicion)?.[1];
  const url = URL.createObjectURL(res.data);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = sugerido || nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return res;
}

// Preferencias pequeñas del navegador (p. ej. la ultima actividad usada).
export function leerPreferencia(clave, porDefecto = null) {
  try {
    const valor = localStorage.getItem(`cbu-salud-${clave}`);
    return valor === null ? porDefecto : JSON.parse(valor);
  } catch {
    return porDefecto;
  }
}

export function guardarPreferencia(clave, valor) {
  try {
    localStorage.setItem(`cbu-salud-${clave}`, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento disponible: no pasa nada */
  }
}

// Imagen protegida: se pide con el token y se muestra como objeto local.
export function useArchivoProtegido(ruta) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!ruta) return undefined;
    let activo = true;
    let objeto = null;
    http
      .get(ruta, { responseType: "blob" })
      .then((res) => {
        if (!activo) return;
        objeto = URL.createObjectURL(res.data);
        setUrl(objeto);
      })
      .catch(() => setUrl(null));
    return () => {
      activo = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [ruta]);
  return url;
}
