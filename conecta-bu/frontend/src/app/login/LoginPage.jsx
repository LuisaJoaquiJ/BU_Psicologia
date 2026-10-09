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
      setError(
        err.response?.data?.message ||
          "No fue posible iniciar sesion. Intenta nuevamente."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Panel marca */}
      <div className="hidden lg:flex relative w-[560px] shrink-0 flex-col justify-center gap-7 overflow-hidden bg-primary p-[72px]">
        <div className="absolute left-[72px] top-[240px] w-[420px] h-[420px] rounded-full bg-white/15" />
        <div className="absolute left-[72px] top-[320px] w-[260px] h-[260px] rounded-full bg-accent" />

        <div className="relative bg-white rounded-[14px] px-[14px] py-[10px] w-fit">
          <p className="font-bold text-[22px] text-primary">UA</p>
        </div>
        <p className="relative font-semibold text-[20px] text-white">Uniautónoma</p>
        <p className="relative font-bold text-[40px] leading-[1.16] text-white w-[400px]">
          Bienestar Universitario
        </p>
        <p className="relative font-medium text-[18px] text-white/90 w-[400px]">
          Desarrollo Humano · Orientación
        </p>
        <p className="relative font-normal text-[15px] leading-[1.5] text-white/85 w-[380px]">
          Consulta servicios, agenda tus citas de orientación y entérate de los
          eventos de Bienestar, todo desde un solo lugar.
        </p>
      </div>

      {/* Panel formulario */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-[400px] flex flex-col gap-3">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-accent uppercase">
            Bienestar · Área de Psicología
          </p>
          <h1 className="text-[30px] font-bold text-ink-900">Bienvenido/a a Conecta BU</h1>
          <p className="text-[15px] leading-[1.5] text-gray-500">
            Inicia sesión con tu cuenta institucional de Google Workspace para
            acceder a los servicios de orientación.
          </p>

          <div className="mt-3 flex justify-center">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError("No fue posible conectar con Google. Intenta de nuevo.")}
              text="signin_with"
              locale="es"
            />
          </div>

          {cargando && <p className="text-sm text-gray-500">Verificando tu cuenta...</p>}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md p-3">{error}</p>
          )}

          <p className="text-[12px] text-gray-500">
            Solo cuentas institucionales @uniautonoma.edu.co
          </p>

          <p className="mt-8 text-[12px] text-gray-500">
            ¿Problemas para ingresar? Escribe a psicologiabienestar@uniautonoma.edu.co
          </p>
        </div>
      </div>
    </div>
  );
}
