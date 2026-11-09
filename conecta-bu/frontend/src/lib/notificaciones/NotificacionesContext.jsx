import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { http } from "../api/http";
import { useAuth } from "../auth/AuthContext";

// Centro de notificaciones: las ultimas de la persona y cuantas no ha leido. Se
// actualiza solo cada minuto, al volver a la pestana y cada vez que se abre la campana.
const INTERVALO_MS = 60_000;

const vacio = { items: [], noLeidas: 0, cargando: false, cargar: async () => {}, marcarLeida: async () => {}, marcarTodas: async () => {}, eliminar: async () => {} };
const Contexto = createContext(vacio);
export const useNotificaciones = () => useContext(Contexto);

// Nombre y color de cada dimension en los avisos.
export const MODULO_AVISO = {
  "desarrollo-humano": { nombre: "Orientación", color: "#1E3A5F" },
  salud: { nombre: "Salud Integral", color: "#0E7C70" },
  deporte: { nombre: "Deporte", color: "#C24E1C" },
  cultura: { nombre: "Arte y Cultura", color: "#6D4CC4" },
  general: { nombre: "Conecta BU", color: "#4B5B73" },
};

// «hace 5 min», «ayer», «12 nov».
export function haceCuanto(fecha) {
  const ms = Date.now() - new Date(fecha).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  return new Date(fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(".", "");
}

export function NotificacionesProvider({ children }) {
  const { estaAutenticado } = useAuth();
  const [items, setItems] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!estaAutenticado) return;
    setCargando(true);
    try {
      const { data } = await http.get("/notificaciones", { params: { limite: 12 } });
      setItems(data.items);
      setNoLeidas(data.noLeidas);
    } catch {
      /* sin conexion: se queda lo que habia */
    } finally {
      setCargando(false);
    }
  }, [estaAutenticado]);

  useEffect(() => {
    if (!estaAutenticado) {
      setItems([]);
      setNoLeidas(0);
      return undefined;
    }
    cargar();
    const cada = setInterval(() => !document.hidden && cargar(), INTERVALO_MS);
    const alVolver = () => !document.hidden && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(cada);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [estaAutenticado, cargar]);

  const marcarLeida = useCallback(
    async (id) => {
      const era = items.find((n) => n.id === id);
      if (era && !era.leida) {
        setItems((l) => l.map((n) => (n.id === id ? { ...n, leida: true } : n)));
        setNoLeidas((n) => Math.max(0, n - 1));
      }
      try {
        await http.patch(`/notificaciones/${id}/leida`);
      } catch {
        cargar();
      }
    },
    [items, cargar]
  );

  const marcarTodas = useCallback(async () => {
    setItems((l) => l.map((n) => ({ ...n, leida: true })));
    setNoLeidas(0);
    try {
      await http.post("/notificaciones/leer-todas");
    } catch {
      cargar();
    }
  }, [cargar]);

  const eliminar = useCallback(
    async (id) => {
      try {
        await http.delete(`/notificaciones/${id}`);
      } finally {
        cargar();
      }
    },
    [cargar]
  );

  const valor = useMemo(() => ({ items, noLeidas, cargando, cargar, marcarLeida, marcarTodas, eliminar }), [items, noLeidas, cargando, cargar, marcarLeida, marcarTodas, eliminar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
