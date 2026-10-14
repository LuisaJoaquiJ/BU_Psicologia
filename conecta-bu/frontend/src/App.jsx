import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./app/login/LoginPage";
import { LandingPage } from "./app/inicio/LandingPage";
import { PortalPage } from "./app/portal/PortalPage";
import { SaludPanel } from "./app/salud/SaludPanel";
import { SuperPanel } from "./app/super/SuperPanel";
import { SaludEstudiantePanel } from "./app/estudiante/SaludEstudiantePanel";
import { ReportesSstPanel } from "./app/sst/ReportesSstPanel";
import { DeportePanel } from "./app/deporte/DeportePanel";
import { MiDeportePanel } from "./app/deporte/MiDeportePanel";
import { EstudiantePanel } from "./app/estudiante/EstudiantePanel";
import { AdminPanel } from "./app/admin/AdminPanel";
import { ProtectedRoute } from "./lib/auth/ProtectedRoute";
import { useAuth } from "./lib/auth/AuthContext";
import { AyudaOrtografia } from "./components/AyudaOrtografia";
import { AsistenteFlotante } from "./components/AsistenteFlotante";

// "/" es el portal de Conecta BU con los cinco modulos de Bienestar.
// "/desarrollo-humano" es la pagina publica de este modulo; a quien ya tiene
// sesion lo lleva directo a su panel.
function PortalInicio() {
  const { cargando } = useAuth();
  if (cargando) return null;
  return <PortalPage />;
}

function DesarrolloHumano() {
  const { estaAutenticado, usuario, cargando } = useAuth();
  if (cargando) return null;
  if (!estaAutenticado) return <LandingPage />;
  if (usuario.rol === "Estudiante") return <Navigate to="/estudiante" replace />;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <>
      <AyudaOrtografia />
      <AsistenteFlotante />
      <Routes>
        <Route path="/" element={<PortalInicio />} />
        <Route path="/desarrollo-humano" element={<DesarrolloHumano />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/estudiante/*"
          element={
            <ProtectedRoute rolesPermitidos={["Estudiante"]}>
              <EstudiantePanel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute rolesPermitidos={["Administrador", "SuperAdministrador"]} modulo="desarrollo-humano">
              <AdminPanel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/salud/*"
          element={
            <ProtectedRoute rolesPermitidos={["Administrador", "SuperAdministrador"]} modulo="salud">
              <SaludPanel />
            </ProtectedRoute>
          }
        />

        {/* Area del estudiante en Salud integral, separada de Orientacion. */}
        <Route
          path="/mi-salud/*"
          element={
            <ProtectedRoute rolesPermitidos={["Estudiante"]}>
              <SaludEstudiantePanel />
            </ProtectedRoute>
          }
        />

        {/* Modulo Deporte: area del estudiante y panel del personal. */}
        <Route
          path="/mi-deporte/*"
          element={
            <ProtectedRoute rolesPermitidos={["Estudiante"]}>
              <MiDeportePanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deporte/*"
          element={
            <ProtectedRoute rolesPermitidos={["Administrador", "SuperAdministrador"]} modulo="deporte">
              <DeportePanel />
            </ProtectedRoute>
          }
        />

        {/* Salidas institucionales y reportes SST: cualquier persona con sesion. */}
        <Route
          path="/reportes-sst/*"
          element={
            <ProtectedRoute>
              <ReportesSstPanel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super/*"
          element={
            <ProtectedRoute rolesPermitidos={["SuperAdministrador"]}>
              <SuperPanel />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
