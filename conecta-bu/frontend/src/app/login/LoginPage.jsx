import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";
import { Icono } from "../../components/Iconos";
import { MODULOS, inicioDirecto } from "../../lib/modulos";

// RF-001 y HU-01/HU-02: pantalla de inicio de sesion institucional
// (rediseño "Aurora con vidrio": luces de la marca en movimiento y una
// tarjeta de vidrio con el boton de Google).

// Punto de color de cada dimension (sobre fondo oscuro).
const PUNTO = { "desarrollo-humano": "#7FE8FF", salud: "#9EF5DD", deporte: "#FFC48F", permanencia: "#EAD8A2", cultura: "#C9B8FF" };

// Entrada al cargar: la tarjeta y las dimensiones aparecen en cascada.
const ENTRA = "animate-aparecer motion-reduce:animate-aparecer-suave";

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
      // Tras iniciar sesion: el personal de un solo modulo (y el
      // superadministrador) entra directo a su panel; los demas, al portal.
      navigate(inicioDirecto(data.usuario) || "/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible iniciar sesion. Intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071A38] text-white flex flex-col items-center justify-center gap-7 px-4 py-10">
      {/* Aurora: manchas de luz que se mueven despacio (quietas si se pidio reducir movimiento). */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[760px] h-[760px] -left-52 -top-64 rounded-full blur-[30px] bg-[radial-gradient(circle,rgba(29,78,158,0.95)_0%,rgba(29,78,158,0)_70%)] animate-deriva-a motion-reduce:animate-none" />
        <div className="absolute w-[700px] h-[700px] -right-40 top-16 rounded-full blur-[40px] bg-[radial-gradient(circle,rgba(30,158,154,0.8)_0%,rgba(30,158,154,0)_70%)] animate-deriva-b motion-reduce:animate-none" />
        <div className="absolute w-[600px] h-[600px] left-[28%] -bottom-80 rounded-full blur-[40px] bg-[radial-gradient(circle,rgba(201,162,63,0.55)_0%,rgba(201,162,63,0)_70%)] animate-deriva-c motion-reduce:animate-none" />
        <div className="absolute w-[380px] h-[380px] right-[20%] -bottom-40 rounded-full blur-[40px] bg-[radial-gradient(circle,rgba(235,104,52,0.4)_0%,rgba(235,104,52,0)_70%)] animate-deriva-a motion-reduce:animate-none" />
      </div>

      <section aria-labelledby="titulo-ingreso" className={`vidrio-claro relative w-full max-w-[460px] rounded-[36px] px-6 sm:px-9 pt-10 pb-8 flex flex-col items-center gap-5 text-center ${ENTRA}`}>
        <Link to="/" aria-label="Ir al portal de Conecta BU" className="rounded-[18px] bg-white/95 px-3.5 py-2.5">
          <img src="/img/logo-uniautonoma-marca.png" alt="Uniautónoma del Cauca" className="h-[46px] w-auto block" />
        </Link>
        <div>
          <h1
            id="titulo-ingreso"
            className="m-0 font-sans text-[34px] sm:text-[40px] leading-[1.05] tracking-[-0.04em] font-extrabold bg-[linear-gradient(100deg,#FFFFFF_0%,#FFFFFF_45%,#B8F4FF_75%,#EAD8A2_100%)] bg-clip-text text-transparent"
          >
            Entra a Conecta BU
          </h1>
          <p className="mt-2.5 mb-0 text-base leading-normal text-white/[0.82]">Citas, talleres, horas de deporte y salud, con tu cuenta institucional.</p>
        </div>

        {/* Boton oficial de Google (lo dibuja Google): blanco, en pildora y del ancho de la tarjeta. */}
        <div className="w-full flex justify-center min-h-[44px]">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError("No fue posible conectar con Google. Intenta de nuevo.")}
            text="continue_with"
            theme="outline"
            shape="pill"
            size="large"
            width="300"
            locale="es"
          />
        </div>

        {cargando && (
          <p role="status" className="m-0 text-sm text-white/85">
            Verificando tu cuenta…
          </p>
        )}
        {error && (
          <p role="alert" className="m-0 w-full text-left text-sm text-red-800 bg-red-50 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}

        <p className="m-0 inline-flex items-center gap-2 min-h-[36px] px-3.5 rounded-full bg-white/10 border border-white/20 text-[13px] text-white/90">
          <Icono nombre="escudo" size={14} strokeWidth={2.2} className="shrink-0 text-[#B8F4FF]" />
          Solo cuentas @uniautonoma.edu.co
        </p>
        <p className="m-0 text-[13px] leading-normal text-white/70">Docentes de Deporte: entra con el correo que registró la coordinación.</p>

        <div className="w-full h-px bg-white/[0.18]" />
        <div className="w-full flex flex-wrap justify-between gap-2.5 text-[13px]">
          <Link to="/" className="inline-flex items-center min-h-[36px] font-bold text-[#B8F4FF] no-underline hover:text-white">
            Volver al portal
          </Link>
          <a
            href="mailto:psicologiabienestar@uniautonoma.edu.co"
            title="psicologiabienestar@uniautonoma.edu.co"
            className="inline-flex items-center min-h-[36px] font-semibold text-[#B8F4FF] hover:text-white"
          >
            ¿Problemas para entrar?
          </a>
        </div>
      </section>

      <ul aria-label="Dimensiones de Bienestar" style={{ animationDelay: "120ms" }} className={`relative list-none m-0 p-0 flex flex-wrap justify-center gap-2 max-w-[640px] ${ENTRA}`}>
        {MODULOS.map((m) => (
          <li
            key={m.id}
            className={`vidrio-claro min-h-[38px] inline-flex items-center gap-2 px-4 rounded-full text-sm font-semibold ${m.estado === "disponible" ? "text-white" : "text-white/75"}`}
          >
            <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: PUNTO[m.id] || "#FFFFFF" }} />
            {m.nombre}
            {m.estado !== "disponible" && <span className="text-xs font-normal">· pronto</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
