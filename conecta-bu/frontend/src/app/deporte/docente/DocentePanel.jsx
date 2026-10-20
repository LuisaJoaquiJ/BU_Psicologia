import { Route, Routes } from "react-router-dom";
import { PanelLayout } from "../comunes/componentes/AdminLayout";
import { ComunicadosDocente } from "./ComunicadosDocente";
import { GrupoDocentePage } from "./GrupoDocentePage";
import { InicioDocente } from "./InicioDocente";
import { MENU } from "./constantes";
import { ConfirmarProvider } from "../comunes/componentes/Confirmar";

// Panel del docente de Deporte (RF-013 a RF-016): solo sus grupos.

export function DocentePanel() {
  return (
    <ConfirmarProvider>
      <PanelLayout menu={MENU} panel="deporte-docente">
        <Routes>
          <Route index element={<InicioDocente />} />
          <Route path="grupos/:id" element={<GrupoDocentePage />} />
          <Route path="comunicados" element={<ComunicadosDocente />} />
        </Routes>
      </PanelLayout>
    </ConfirmarProvider>
  );
}
