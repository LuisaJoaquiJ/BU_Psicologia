import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { puedeAdministrar } from "../modulos";

// HU-04: solo deja ver la ruta a quien esta autenticado y, si se indican
// roles permitidos, solo a quien tenga uno de esos roles.
// Con "modulo", ademas exige que el personal tenga ese modulo asignado.
export function ProtectedRoute({ children, rolesPermitidos, modulo }) {
  const { estaAutenticado, usuario, cargando } = useAuth();

  if (cargando) {
    return <div className="p-8 text-center text-gray-500">Cargando sesion...</div>;
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return (
      <div className="p-8 text-center text-red-600">
        No tienes permiso para ver esta seccion con tu rol actual ({usuario.rol}).
      </div>
    );
  }

  if (modulo && !puedeAdministrar(usuario, modulo)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <p className="text-lg font-semibold text-primary">No tienes acceso a este módulo.</p>
          <p className="text-ink-500 mt-2">Pide al superadministrador de Conecta BU que asigne tu correo a este módulo.</p>
          <a href="/" className="inline-block mt-4 font-bold text-primary-soft">← Volver a los módulos</a>
        </div>
      </div>
    );
  }

  return children;
}
