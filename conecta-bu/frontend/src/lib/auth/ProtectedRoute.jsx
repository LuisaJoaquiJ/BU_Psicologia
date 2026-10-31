import { Link, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { puedeAdministrar } from "../modulos";

function AvisoAcceso({ titulo, texto }) {
  return (
    <div role="alert" className="min-h-screen flex items-center justify-center p-8 text-center bg-[#F6F8FB]">
      <div className="max-w-md">
        <p className="text-lg font-semibold text-primary">{titulo}</p>
        <p className="text-ink-500 mt-2">{texto}</p>
        <Link to="/" className="inline-flex items-center mt-4 min-h-[44px] font-bold text-primary">
          Volver al portal
        </Link>
      </div>
    </div>
  );
}

// HU-04: solo deja ver la ruta a quien esta autenticado y, si se indican
// roles permitidos, solo a quien tenga uno de esos roles.
// Con "modulo", ademas exige que el personal tenga ese modulo asignado.
export function ProtectedRoute({ children, rolesPermitidos, modulo }) {
  const { estaAutenticado, usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div role="status" className="min-h-screen flex items-center justify-center p-8 text-center text-ink-500 bg-[#F6F8FB]">
        Cargando tu sesión…
      </div>
    );
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />;
  }

  // El superadministrador solo trabaja en su panel: cualquier otra seccion
  // (modulos, area del estudiante, reportes SST) lo devuelve a /super.
  if (usuario.rol === "SuperAdministrador" && !rolesPermitidos?.includes("SuperAdministrador")) {
    return (
      <Navigate
        to="/super"
        replace
        state={{ aviso: "Tu cuenta es de superadministrador. Desde tu panel asignas quién entra a cada módulo; el trabajo diario lo hace su personal." }}
      />
    );
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return (
      <AvisoAcceso
        titulo="Esta sección no corresponde a tu rol."
        texto={`Entraste como ${usuario.rol}. Vuelve al portal y abre el área que sí te corresponde.`}
      />
    );
  }

  if (modulo && !puedeAdministrar(usuario, modulo)) {
    return (
      <AvisoAcceso
        titulo="No tienes acceso a este módulo."
        texto="Pide al superadministrador de Conecta BU que asigne tu correo a este módulo."
      />
    );
  }

  return children;
}
