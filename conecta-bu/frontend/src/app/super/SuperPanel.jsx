import { Routes, Route } from "react-router-dom";
import { PanelLayout } from "../../components/AdminLayout";
import { UsuariosPage } from "../admin/UsuariosPage";
import { SuperInicio } from "./SuperInicio";
import { AccesosPage } from "./AccesosPage";
import { InformesPage } from "./InformesPage";

// Panel del superadministrador (/super): ve todos los modulos de Conecta BU,
// asigna por correo el personal de cada uno y administra usuarios y roles.
const MENU_SUPER = [
  { to: "/super", label: "Inicio", icono: "tablero", end: true },
  { to: "/super/informes", label: "Informes de gestión", icono: "archivo" },
  { to: "/super/accesos", label: "Accesos por módulo", icono: "escudo" },
  { to: "/super/usuarios", label: "Usuarios y roles", icono: "usuarios" },
];

export function SuperPanel() {
  return (
    <PanelLayout menu={MENU_SUPER} panel="super">
      <Routes>
        <Route index element={<SuperInicio />} />
        <Route path="informes" element={<InformesPage />} />
        <Route path="accesos" element={<AccesosPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
      </Routes>
    </PanelLayout>
  );
}
