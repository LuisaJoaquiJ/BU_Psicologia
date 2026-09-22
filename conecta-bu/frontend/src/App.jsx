import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./app/login/LoginPage";
import { EstudiantePanel } from "./app/estudiante/EstudiantePanel";
import { AdminPanel } from "./app/admin/AdminPanel";
import { ProtectedRoute } from "./lib/auth/ProtectedRoute";
import { useAuth } from "./lib/auth/AuthContext";

function InicioRedirect() {
  const { estaAutenticado, usuario, cargando } = useAuth();
  if (cargando) return null;
  if (!estaAutenticado) return <Navigate to="/login" replace />;
  return <Navigate to={usuario.rol === "Administrador" ? "/admin" : "/estudiante"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InicioRedirect />} />
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
