import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// HU-04: solo deja ver la ruta a quien esta autenticado y, si se indican
// roles permitidos, solo a quien tenga uno de esos roles.
export function ProtectedRoute({ children, rolesPermitidos }) {
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

  return children;
}
