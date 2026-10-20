import { Route, Routes } from "react-router-dom";
import { PanelLayout } from "../comunes/componentes/AdminLayout";
import { ComunicadosPage } from "./comunicados/ComunicadosPage";
import { DisciplinasPage } from "./disciplinas/DisciplinasPage";
import { DocentesPage } from "./docentes/DocentesPage";
import { TableroDeporte } from "./estadisticas/TableroDeporte";
import { EstudianteDetallePage } from "./estudiantes/EstudianteDetallePage";
import { EstudiantesPage } from "./estudiantes/EstudiantesPage";
import { EventoDeporteDetallePage } from "./eventos/EventoDetallePage";
import { EventosDeportePage } from "./eventos/EventosPage";
import { GrupoDetallePage } from "./grupos/GrupoDetallePage";
import { GruposPage } from "./grupos/GruposPage";
import { InicioPersonal } from "./inicio/InicioPersonal";
import { ImplementoDetallePage } from "./inventario/ImplementoDetallePage";
import { InventarioPage } from "./inventario/InventarioPage";
import { ConfirmarProvider } from "../comunes/componentes/Confirmar";

// Panel de la coordinación de Deporte: menú y rutas de cada pantalla.

// Panel del personal del modulo Deporte (/deporte): solo entran los correos
// que el superadministrador asigno a Deporte.
const MENU_DEPORTE = [
  { to: "/deporte", label: "Inicio", icono: "tablero", end: true },
  { to: "/deporte/estadisticas", label: "Estadísticas", icono: "grafica" },
  { to: "/deporte/grupos", label: "Grupos y asistencia", icono: "calendario" },
  { to: "/deporte/docentes", label: "Docentes", icono: "persona" },
  { to: "/deporte/eventos", label: "Eventos", icono: "trofeo" },
  { to: "/deporte/comunicados", label: "Comunicados", icono: "chat" },
  { to: "/deporte/inventario", label: "Inventario", icono: "lista" },
  { to: "/deporte/estudiantes", label: "Estudiantes y horas", icono: "usuarios" },
  { to: "/deporte/disciplinas", label: "Disciplinas", icono: "estrella" },
];

export function DeportePanel() {
  return (
    <ConfirmarProvider>
      <PanelLayout menu={MENU_DEPORTE} panel="deporte">
        <Routes>
          <Route index element={<InicioPersonal />} />
          <Route path="estadisticas" element={<TableroDeporte />} />
          <Route path="grupos" element={<GruposPage />} />
          <Route path="grupos/:id" element={<GrupoDetallePage />} />
          <Route path="estudiantes" element={<EstudiantesPage />} />
          <Route path="estudiantes/:id" element={<EstudianteDetallePage />} />
          <Route path="disciplinas" element={<DisciplinasPage />} />
          <Route path="docentes" element={<DocentesPage />} />
          <Route path="eventos" element={<EventosDeportePage />} />
          <Route path="eventos/:id" element={<EventoDeporteDetallePage />} />
          <Route path="comunicados" element={<ComunicadosPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="inventario/:id" element={<ImplementoDetallePage />} />
        </Routes>
      </PanelLayout>
    </ConfirmarProvider>
  );
}
