import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { botonPrimario } from "../comunes/componentes/ui";
import { MENSAJE_EXPIRADO } from "../comunes/lib/ventanaAsistencia";

const ID_LECTOR = "lector-qr-asistencia";

// El QR contiene una URL como .../asistencia/<codigo>. Tomamos el último segmento.
function extraerCodigo(texto) {
  try {
    return new URL(texto).pathname.split("/").filter(Boolean).pop() || null;
  } catch {
    return null;
  }
}

// Sin código en la URL: abre la cámara y lee el QR del administrador.
// Con código (/asistencia/:codigo, al escanear con la cámara nativa): registra la asistencia.
export function EscanearAsistenciaPage() {
  const { codigo: codigoUrl } = useParams();
  const [codigo, setCodigo] = useState(codigoUrl || null);
  const [estado, setEstado] = useState({ fase: codigoUrl ? "cargando" : "escanear" });
  // Evita un segundo envío: en desarrollo React ejecuta los efectos dos veces.
  const enviado = useRef(null);

  // Registra la asistencia cuando hay un código.
  useEffect(() => {
    if (!codigo || enviado.current === codigo) return;
    enviado.current = codigo;
    setEstado({ fase: "cargando" });
    http
      .post("/eventos/asistencia/escanear", { codigo })
      .then((res) =>
        setEstado({ fase: res.data.yaRegistrada ? "ya" : "ok", evento: res.data.evento })
      )
      .catch((err) =>
        setEstado({
          fase: "error",
          mensaje: err.response?.data?.message || "No fue posible registrar tu asistencia.",
          // ASISTENCIA_EXPIRADA / ASISTENCIA_NO_INICIADA: fuera de [inicio, fin + 30 min].
          codigo: err.response?.data?.codigo,
        })
      );
  }, [codigo]);

  // Abre la cámara solo en la fase de escaneo.
  useEffect(() => {
    if (estado.fase !== "escanear") return;

    const scanner = new Html5Qrcode(ID_LECTOR);
    const detener = () => (scanner.isScanning ? scanner.stop().catch(() => {}) : Promise.resolve());
    let leido = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (texto) => {
          // El lector puede disparar varias veces con el mismo QR.
          if (leido) return;
          leido = true;
          await detener();
          const nuevo = extraerCodigo(texto);
          if (nuevo) setCodigo(nuevo);
          else setEstado({ fase: "error", mensaje: "El QR no es válido." });
        },
        () => {}
      )
      .catch(() =>
        setEstado({
          fase: "error",
          mensaje: "No se pudo acceder a la cámara. Revisa los permisos del navegador.",
        })
      );

    return () => {
      detener();
    };
  }, [estado.fase]);

  const contenido = {
    escanear: {
      icono: "imagen",
      color: "bg-gray-100 text-ink-600",
      titulo: "Escanea el QR de asistencia",
      texto: "Apunta la cámara al QR que muestra el administrador.",
    },
    cargando: {
      icono: "reloj",
      color: "bg-gray-100 text-ink-600",
      titulo: "Registrando tu asistencia…",
      texto: "Un momento.",
    },
    ok: {
      icono: "check",
      color: "bg-[#D5EFEA] text-[#0B6B61]",
      titulo: "Asistencia registrada",
      texto: estado.evento,
    },
    ya: {
      icono: "check",
      color: "bg-[#D5EFEA] text-[#0B6B61]",
      titulo: "Ya tenías registrada tu asistencia",
      texto: estado.evento,
    },
    error: {
      icono: "alerta",
      color: "bg-red-50 text-red-700",
      titulo: estado.codigo === "ASISTENCIA_EXPIRADA" ? MENSAJE_EXPIRADO : "No pudimos registrar tu asistencia",
      texto: estado.codigo === "ASISTENCIA_EXPIRADA" ? null : estado.mensaje,
    },
  }[estado.fase];

  return (
    <main className="max-w-[560px] mx-auto px-4 py-16 text-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-10 flex flex-col items-center gap-4">
        <span className={`w-16 h-16 rounded-2xl flex items-center justify-center ${contenido.color}`}>
          <Icono nombre={contenido.icono} size={28} strokeWidth={2} />
        </span>
        <h1 className="m-0 text-2xl font-extrabold text-ink-900">{contenido.titulo}</h1>
        {contenido.texto && <p className="m-0 text-ink-500">{contenido.texto}</p>}

        {estado.fase === "escanear" && <div id={ID_LECTOR} className="w-full max-w-sm" />}

        {estado.fase === "error" && estado.codigo !== "ASISTENCIA_EXPIRADA" && (
          <>
            {!estado.codigo && (
              <p className="m-0 text-sm text-ink-500">
                Si el código venció, escanea el QR que aparece en pantalla en ese momento.
              </p>
            )}
            <button
              onClick={() => {
                enviado.current = null;
                setCodigo(null);
                setEstado({ fase: "escanear" });
              }}
              className="text-sm font-semibold boton-liquido rounded-full px-4 py-1.5"
            >
              Intentar de nuevo
            </button>
          </>
        )}

        <Link to="/estudiante/eventos" className={`${botonPrimario} mt-2`}>
          Ver mis eventos
        </Link>
      </div>
    </main>
  );
}