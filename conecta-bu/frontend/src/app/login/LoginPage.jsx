import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";
import { IMAGENES } from "../../lib/imagenes";
import { Logo } from "../../components/Logo";
import { Icono } from "../../components/Iconos";

// RF-001 y HU-01/HU-02: pantalla de inicio de sesion institucional
// (rediseño: panel con la sede de la universidad + tarjeta de acceso).
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
      setError(err.response?.data?.message || "No fue posible iniciar sesion. Intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-wrap bg-cream">
      {/* Panel institucional con la foto de la sede */}
      <section className="relative flex-[1_1_480px] overflow-hidden bg-primary text-white px-8 py-10 sm:p-14 flex flex-col justify-between gap-12">
        <img
          src={IMAGENES.sede.src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "50% 40%" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,42,91,0.72)_0%,rgba(11,42,91,0.88)_55%,rgba(11,42,91,0.97)_100%)]"
        />
        <div className="relative">
          <Logo invertido />
        </div>
        <div className="relative max-w-[460px]">
          <h1 className="m-0 mb-4 text-[40px] sm:text-[48px] leading-[1.08] font-semibold text-white">
            Un espacio para cuidarte mientras estudias.
          </h1>
          <p className="m-0 text-[17px] leading-relaxed text-[#D6DDEC]">
            Citas de orientación, eventos de Desarrollo Humano y un asistente que te guía, en un solo lugar.
          </p>
        </div>
        <div className="relative flex flex-col gap-4">
          <ul className="list-none m-0 p-0 flex flex-col gap-3.5 text-[15px] text-[#E5EAF4]">
            {[
              "Agenda y cancela tus citas cuando quieras",
              "Inscríbete a talleres y charlas del campus",
              "Tu información es confidencial",
            ].map((texto) => (
              <li key={texto} className="flex gap-3 items-center">
                <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
                {texto}
              </li>
            ))}
          </ul>
          <p className="m-0 text-xs text-white/70">{IMAGENES.sede.alt}</p>
        </div>
      </section>

      {/* Tarjeta de acceso */}
      <section className="flex-[1_1_480px] flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-[420px] bg-white border border-gray-200 rounded-[28px] px-8 sm:px-10 py-11 flex flex-col gap-6 shadow-[0_20px_50px_rgba(11,42,91,0.06)]">
          <div>
            <p className="m-0 mb-2 text-[13px] font-bold tracking-[0.14em] uppercase text-accent">Bienvenida/o</p>
            <h2 className="m-0 text-[32px] font-semibold">Inicia sesión</h2>
            <p className="mt-2.5 mb-0 text-[15px] leading-relaxed text-ink-500">
              Usa tu cuenta institucional de Google. Si es tu primera vez, tu perfil se crea automáticamente.
            </p>
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError("No fue posible conectar con Google. Intenta de nuevo.")}
              text="continue_with"
              shape="pill"
              size="large"
              locale="es"
            />
          </div>

          {cargando && <p className="m-0 text-sm text-ink-500 text-center">Verificando tu cuenta...</p>}
          {error && <p className="m-0 text-sm text-red-700 bg-red-50 rounded-xl p-3">{error}</p>}

          <div className="flex gap-3 items-start bg-gold-light rounded-[14px] px-4 py-3.5 text-sm leading-normal text-[#5C4206]">
            <Icono nombre="alerta" size={20} strokeWidth={2} className="shrink-0 mt-px" />
            <span>
              Solo se permiten cuentas <strong>@uniautonoma.edu.co</strong>.
            </span>
          </div>

          <p className="m-0 text-[13px] leading-relaxed text-ink-500 text-center">
            ¿Problemas para ingresar? Escribe a psicologiabienestar@uniautonoma.edu.co
          </p>
          <Link to="/" className="text-center text-sm font-semibold text-primary-soft">
            ← Volver al inicio
          </Link>
        </div>
      </section>
    </div>
  );
}
