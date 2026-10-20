import { Routes, Route } from "react-router-dom";
import { PanelLayout } from "./comunes/componentes/AdminLayout";
import { UsuariosPage } from "./UsuariosPage";
import { SuperInicio } from "./SuperInicio";
import { AccesosPage } from "./AccesosPage";
import { InformesPage } from "./InformesPage";
import { EstadisticasSuperPage } from "./EstadisticasSuperPage";
import { ConfirmarProvider } from "./comunes/componentes/Confirmar";

// Panel del superadministrador (/super): ve todos los modulos de Conecta BU,
// asigna por correo el personal de cada uno y administra usuarios y roles.
const MENU_SUPER = [
  { to: "/super", label: "Inicio", icono: "tablero", end: true },
  { to: "/super/estadisticas", label: "Estadísticas", icono: "grafica" },
  { to: "/super/informes", label: "Informes", icono: "archivo" },
  { to: "/super/accesos", label: "Accesos", icono: "escudo" },
  { to: "/super/usuarios", label: "Usuarios", icono: "usuarios" },
];

export function SuperPanel() {
  return (
    <ConfirmarProvider>
      <PanelLayout menu={MENU_SUPER} panel="super">
        <Routes>
          <Route index element={<SuperInicio />} />
          <Route path="estadisticas" element={<EstadisticasSuperPage />} />
          <Route path="informes" element={<InformesPage />} />
          <Route path="accesos" element={<AccesosPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
        </Routes>
      </PanelLayout>
    </ConfirmarProvider>
  );
}
