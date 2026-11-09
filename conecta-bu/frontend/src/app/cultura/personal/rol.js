import { createContext, useContext } from "react";

// Rol de quien usa el panel de Cultura (administrador, docente o monitor). Hasta que
// se conoce, vale el de menos permisos.
export const RolCultura = createContext("monitor");
export const useRolCultura = () => useContext(RolCultura);

// Lo que puede hacer cada rol (lo mismo que revisa el servidor).
export const ROLES_EQUIPO = [
  {
    id: "administrador",
    nombre: "Administrador del área",
    detalle: "Todo el módulo: crea grupos, eventos y convocatorias, decide audiciones, ve redes, apoyo e informes y maneja el equipo.",
  },
  {
    id: "docente",
    nombre: "Docente",
    detalle: "Dirige los grupos a su cargo: asistencia, ubicación del sitio, fotos y las audiciones de su grupo. También maneja inventario, pendientes y pausas.",
  },
  {
    id: "monitor",
    nombre: "Monitor",
    detalle: "Apoya en los grupos donde esté asignado: toma asistencia. Consulta el inventario y registra préstamos y pendientes. No crea ni decide.",
  },
];
