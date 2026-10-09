import { Routes, Route } from "react-router-dom";
import { PanelLayout } from "../../components/AdminLayout";
import { GestionHorariosPage } from "../admin/GestionHorariosPage";
import { AgendaAdminPage } from "../admin/AgendaAdminPage";
import { InicioSalud } from "./InicioSalud";
import { RegistrarPage } from "./RegistrarPage";
import { ActividadesPage } from "./ActividadesPage";
import { ActividadDetallePage } from "./ActividadDetallePage";
import { PersonasPage, PersonaDetallePage } from "./PersonasPage";
import { ReportesPage } from "./ReportesPage";

// Panel del personal de la Unidad de Salud Integral: solo entran los correos
// asignados a Salud por el superadministrador. Horarios y agenda usan las
// mismas pantallas que Desarrollo humano, pero contra /salud/horarios y
// /salud/citas (solo servicios de Salud).
const MENU_SALUD = [
  { to: "/salud", label: "Inicio", icono: "tablero", end: true },
  { to: "/salud/registrar", label: "Registrar", icono: "check" },
  { to: "/salud/actividades", label: "Actividades", icono: "estrella" },
  { to: "/salud/personas", label: "Personas", icono: "usuarios" },
  { to: "/salud/horarios", label: "Horarios de citas", icono: "reloj" },
  { to: "/salud/citas", label: "Agenda de citas", icono: "calendario" },
  { to: "/salud/reportes", label: "Reportes", icono: "grafica" },
];

export function SaludPanel() {
  return (
    <PanelLayout menu={MENU_SALUD} panel="salud">
      <Routes>
        <Route index element={<InicioSalud />} />
        <Route path="registrar" element={<RegistrarPage />} />
        <Route path="actividades" element={<ActividadesPage />} />
        <Route path="actividades/:id" element={<ActividadDetallePage />} />
        <Route path="personas" element={<PersonasPage />} />
        <Route path="personas/:id" element={<PersonaDetallePage />} />
        <Route path="horarios" element={<GestionHorariosPage api="/salud" modulo="salud" />} />
        <Route path="citas" element={<AgendaAdminPage api="/salud" />} />
        <Route path="reportes" element={<ReportesPage />} />
      </Routes>
    </PanelLayout>
  );
}
