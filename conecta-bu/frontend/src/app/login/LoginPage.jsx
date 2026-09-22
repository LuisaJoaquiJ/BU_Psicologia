import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";

// RF-001 y HU-01/HU-02: pantalla de inicio de sesion institucional.
export function LoginPage() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSuccess(credentialResponse) {
    setError("");
    setCargando(true);
    try {
      const idToken = credentialResponse.credential;
      const { data } = await http.post("/auth/google", { idToken });
      iniciarSesion(data.token, data.usuario);
      navigate(data.usuario.rol === "Administrador" ? "/admin" : "/estudiante");
    } catch (err) {
      // HU-02: mensaje claro cuando la cuenta no es institucional o esta deshabilitada.
      setError(
        err.response?.data?.message ||
          "No fue posible iniciar sesion. Intenta nuevamente."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-light px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-primary mb-2">Conecta BU</h1>
        <p className="text-gray-600 mb-8">
          Bienestar Universitario · Desarrollo Humano / Orientacion
        </p>

        <div className="flex justify-center mb-4">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError("No fue posible conectar con Google. Intenta de nuevo.")}
            text="signin_with"
            locale="es"
          />
        </div>

        {cargando && <p className="text-sm text-gray-500">Verificando tu cuenta...</p>}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 mt-4">{error}</p>
        )}

        <p className="text-xs text-gray-400 mt-8">
          Ingresa unicamente con tu cuenta institucional. Si tu cuenta no pertenece a la
          universidad, el sistema no permitira el acceso.
        </p>
      </div>
    </div>
  );
}
