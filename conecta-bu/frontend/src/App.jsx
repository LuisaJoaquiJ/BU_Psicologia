import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./app/login/LoginPage";
import { LandingPage } from "./app/desarrollo-humano/publico/LandingPage";
import { PortalPage } from "./app/portal/PortalPage";
import { SaludPanel } from "./app/salud/personal/SaludPanel";
import { SuperPanel } from "./app/super/SuperPanel";
import { SaludEstudiantePanel } from "./app/salud/estudiante/SaludEstudiantePanel";
import { ReportesSstPanel } from "./app/salud/sst/ReportesSstPanel";
import { DeportePanel, DocentePanel, MiDeportePanel } from "./app/deporte";
import { EstudiantePanel } from "./app/desarrollo-humano/estudiante/EstudiantePanel";
import { AdminPanel } from "./app/desarrollo-humano/personal/AdminPanel";
import { ProtectedRoute } from "./lib/auth/ProtectedRoute";
import { useAuth } from "./lib/auth/AuthContext";
import { AyudaOrtografia } from "./components/AyudaOrtografia";
import { inicioDirecto } from "./lib/modulos";
import { lazy, Suspense } from "react";

// Galeria de graficas con datos de ejemplo: solo existe en desarrollo (no entra al build).
const GaleriaGraficas = import.meta.env.DEV ? lazy(() => import("./components/graficas/Galeria")) : null;

// "/" es el portal de Conecta BU con los cinco modulos de Bienestar. El
// personal de un solo modulo y el superadministrador no lo ven: entran
// directo a su panel. "/desarrollo-humano" es la pagina publica de este
// modulo; a quien ya tiene sesion lo lleva directo a su panel.
function PortalInicio() {
  const { cargando, usuario } = useAuth();
  if (cargando) return null;
  const directo = inicioDirecto(usuario);
  if (directo) return <Navigate to={directo} replace />;
  return <PortalPage />;
}

function DesarrolloHumano() {
  const { estaAutenticado, usuario, cargando } = useAuth();
  if (cargando) return null;
  if (!estaAutenticado) return <LandingPage />;
  if (usuario.rol === "Estudiante") return <Navigate to="/estudiante" replace />;
  return <Navigate to={inicioDirecto(usuario) || "/"} replace />;
}

export default function App() {
  return (
    <>
      <AyudaOrtografia />
      <Routes>
        <Route path="/" element={<PortalInicio />} />
        <Route path="/desarrollo-humano" element={<DesarrolloHumano />} />
        <Route path="/login" element={<LoginPage />} />
        {GaleriaGraficas && (
          <Route
            path="/dev/graficas"
            element={
              <Suspense fallback={null}>
                <GaleriaGraficas />
              </Suspense>
            }
          />
        )}

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
            <ProtectedRoute rolesPermitidos={["Administrador"]} modulo="desarrollo-humano">
              <AdminPanel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/salud/*"
          element={
            <ProtectedRoute rolesPermitidos={["Administrador"]} modulo="salud">
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
            <ProtectedRoute rolesPermitidos={["Administrador"]} modulo="deporte">
              <DeportePanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deporte-docente/*"
          element={
            <ProtectedRoute rolesPermitidos={["Administrador"]} modulo="deporte-docente">
              <DocentePanel />
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
