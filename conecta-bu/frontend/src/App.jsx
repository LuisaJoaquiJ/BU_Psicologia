import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./app/login/LoginPage";
import { LandingPage } from "./app/inicio/LandingPage";
import { PortalPage } from "./app/portal/PortalPage";
import { EstudiantePanel } from "./app/estudiante/EstudiantePanel";
import { AdminPanel } from "./app/admin/AdminPanel";
import { ProtectedRoute } from "./lib/auth/ProtectedRoute";
import { useAuth } from "./lib/auth/AuthContext";

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
  return <Navigate to={usuario.rol === "Administrador" ? "/admin" : "/estudiante"} replace />;
}

export default function App() {
  return (
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
          <ProtectedRoute rolesPermitidos={["Administrador"]}>
            <AdminPanel />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
