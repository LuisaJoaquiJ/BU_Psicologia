import { Route, Routes } from "react-router-dom";
import { Navbar } from "../comunes/componentes/Navbar";
import { AgendaCultura, ConvocatoriasCultura, GruposCultura, InicioCultura } from "./Paginas";

export function MiCulturaPanel() {
  return (
    // Misma barra que los demas modulos: arriba en pantalla grande y abajo en el celular.
    <div className="tema-cultura min-h-screen fondo-panel panel-moderno pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0">
      <Navbar modulo="cultura" />
      <Routes>
        <Route index element={<InicioCultura />} />
        <Route path="grupos" element={<GruposCultura />} />
        <Route path="agenda" element={<AgendaCultura />} />
        <Route path="convocatorias" element={<ConvocatoriasCultura />} />
      </Routes>
    </div>
  );
}
