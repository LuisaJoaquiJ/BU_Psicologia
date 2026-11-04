import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { PanelLayout } from "../comunes/componentes/AdminLayout";
import { ConfirmarProvider } from "../comunes/componentes/Confirmar";
import { InicioPersonal } from "./Inicio";
import { AgendaPersonal, ConvocatoriasPersonal, GruposPersonal } from "./Paginas";
import { InventarioPersonal, PendientesPersonal } from "./Logistica";
import { ApoyoPersonal, EquipoPersonal, HistoricoPersonal, InformesPersonal, ItinerantePersonal, RedesPersonal } from "./Operacion";
import { Aviso, Marco } from "./Marco";

// Panel del personal de Arte y Cultura (/cultura): solo entran los correos
// que el superadministrador asigno al modulo. Redes, Apoyo, Informes y Equipo
// son de la coordinacion (rol administrador); docentes y monitores no los ven.
const SOLO_ADMIN = ["administrador"];
const MENU_CULTURA = [
  { to: "/cultura", label: "Inicio", icono: "tablero", end: true },
  { to: "/cultura/grupos", label: "Grupos y talleres", icono: "musica" },
  { to: "/cultura/agenda", label: "Agenda", icono: "calendario" },
  { to: "/cultura/pendientes", label: "Pendientes", icono: "lista" },
  { to: "/cultura/convocatorias", label: "Convocatorias", icono: "estrella" },
  { to: "/cultura/redes", label: "Redes", icono: "trofeo", roles: SOLO_ADMIN },
  { to: "/cultura/itinerante", label: "Pausas creativas", icono: "ubicacion" },
  { to: "/cultura/apoyo", label: "Apoyo a colegios y ferias", icono: "chat", roles: SOLO_ADMIN },
  { to: "/cultura/inventario", label: "Inventario", icono: "cuadricula" },
  { to: "/cultura/informes", label: "Informes", icono: "grafica", roles: SOLO_ADMIN },
  { to: "/cultura/historico", label: "Histórico", icono: "reloj" },
  { to: "/cultura/equipo", label: "Equipo", icono: "usuarios", roles: SOLO_ADMIN },
];

// Las paginas internas van en el mismo contenedor; el Inicio no, porque su
// banda ocupa todo el ancho como en los demas modulos.
function Pagina({ children }) {
  return <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-28">{children}</div>;
}

function SinPermiso() {
  return (
    <Marco titulo="Solo para la coordinación" texto="Esta sección la maneja quien tiene el rol de administrador en Arte y Cultura.">
      <Aviso tono="azul">Si necesitas entrar, pide a la coordinación que cambie tu rol en Equipo.</Aviso>
    </Marco>
  );
}

export function CulturaPanel() {
  const [rol, setRol] = useState(null);
  useEffect(() => {
    http.get("/cultura/admin/mi-rol").then((r) => setRol(r.data.rol)).catch(() => setRol("administrador"));
  }, []);
  const menu = MENU_CULTURA.filter((m) => !m.roles || !rol || m.roles.includes(rol));
  const soloAdmin = (elemento) => (!rol || rol === "administrador" ? elemento : <SinPermiso />);

  return (
    <ConfirmarProvider>
      <PanelLayout menu={menu} panel="cultura">
        <Routes>
          <Route index element={<InicioPersonal rol={rol || "administrador"} />} />
          <Route path="grupos" element={<Pagina><GruposPersonal /></Pagina>} />
          <Route path="agenda" element={<Pagina><AgendaPersonal /></Pagina>} />
          <Route path="pendientes" element={<Pagina><PendientesPersonal /></Pagina>} />
          <Route path="inventario" element={<Pagina><InventarioPersonal /></Pagina>} />
          <Route path="convocatorias" element={<Pagina><ConvocatoriasPersonal /></Pagina>} />
          <Route path="redes" element={<Pagina>{soloAdmin(<RedesPersonal />)}</Pagina>} />
          <Route path="itinerante" element={<Pagina><ItinerantePersonal /></Pagina>} />
          <Route path="apoyo" element={<Pagina>{soloAdmin(<ApoyoPersonal />)}</Pagina>} />
          <Route path="informes" element={<Pagina>{soloAdmin(<InformesPersonal />)}</Pagina>} />
          <Route path="historico" element={<Pagina><HistoricoPersonal /></Pagina>} />
          <Route path="equipo" element={<Pagina>{soloAdmin(<EquipoPersonal />)}</Pagina>} />
        </Routes>
      </PanelLayout>
    </ConfirmarProvider>
  );
}
