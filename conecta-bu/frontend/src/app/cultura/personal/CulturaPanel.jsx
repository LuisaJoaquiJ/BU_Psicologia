import { Route, Routes } from "react-router-dom";
import { Barra } from "../comun/Barra";
import { AgendaPersonal, ConvocatoriasPersonal, GruposPersonal, InicioPersonal } from "./Paginas";
import { ApoyoPersonal, EquipoPersonal, HistoricoPersonal, InformesPersonal, ItinerantePersonal, RedesPersonal } from "./Operacion";

export function CulturaPanel() {
  return (
    <div className="tema-cultura min-h-screen fondo-panel panel-moderno">
      <Barra variante="personal" />
      <Routes>
        <Route index element={<InicioPersonal />} />
        <Route path="grupos" element={<GruposPersonal />} />
        <Route path="agenda" element={<AgendaPersonal />} />
        <Route path="convocatorias" element={<ConvocatoriasPersonal />} />
        <Route path="redes" element={<RedesPersonal />} />
        <Route path="itinerante" element={<ItinerantePersonal />} />
        <Route path="apoyo" element={<ApoyoPersonal />} />
        <Route path="informes" element={<InformesPersonal />} />
        <Route path="historico" element={<HistoricoPersonal />} />
        <Route path="equipo" element={<EquipoPersonal />} />
      </Routes>
    </div>
  );
}
