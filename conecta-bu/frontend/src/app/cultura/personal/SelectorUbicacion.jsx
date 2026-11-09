import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { campo } from "./Marco";
import { buscarLugares } from "./lugares";

const CENTRO = [2.4448, -76.6147]; // Popayán
const RADIOS = [50, 100, 150, 200, 300];

// Lee coordenadas escritas («2.4448, -76.6147») o dentro de un enlace de Google Maps.
export function leerCoordenadas(texto) {
  let t = String(texto || "");
  try {
    t = decodeURIComponent(t);
  } catch {
    /* se usa el texto tal cual */
  }
  const m =
    t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
    t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    t.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)[, +]+(-?\d+\.\d+)/) ||
    t.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const latitud = Number(m[1]);
  const longitud = Number(m[2]);
  return Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180 ? { latitud, longitud } : null;
}

const pin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:22px;height:22px;border-radius:50%;background:#6d4cc4;border:3px solid #fff;box-shadow:0 2px 8px rgba(31,17,71,.5)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const hayPunto = (v) => v && v.latitud !== null && v.latitud !== undefined && v.longitud !== null && v.longitud !== undefined;

// Mapa para marcar donde se va a tomar la asistencia: clic en el mapa, arrastrar el
// punto, usar la ubicacion actual o pegar un enlace de Google Maps. El radio es
// la distancia a la que los estudiantes pueden marcar.
// valor: { latitud, longitud, radioM }. alCambiar recibe el valor nuevo.
export function SelectorUbicacion({ valor, alCambiar }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const marcador = useRef(null);
  const circulo = useRef(null);
  const ultimo = useRef({ valor, alCambiar });
  ultimo.current = { valor, alCambiar };
  const [aviso, setAviso] = useState("");
  const [enlace, setEnlace] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState(null); // null: sin busqueda; []: sin resultados
  const [consultando, setConsultando] = useState(false);
  const [textoBuscado, setTextoBuscado] = useState("");
  const pedido = useRef(null);
  const interno = useRef(false); // el cambio vino del propio mapa (clic o arrastre)

  async function buscarNombre(texto) {
    const q = texto.trim();
    pedido.current?.abort();
    if (q.length < 3) {
      setResultados(null);
      return;
    }
    const control = new AbortController();
    pedido.current = control;
    setConsultando(true);
    setTextoBuscado(q);
    try {
      setResultados(await buscarLugares(q, control.signal));
      setAviso("");
    } catch (err) {
      if (err.name === "AbortError") return;
      setResultados(null);
      setAviso("No pudimos buscar el lugar ahora. Márcalo en el mapa o pega un enlace de Google Maps.");
    } finally {
      if (pedido.current === control) setConsultando(false);
    }
  }

  useEffect(() => () => pedido.current?.abort(), []);

  function elegirResultado(r) {
    elegir(r.latitud, r.longitud);
    mapa.current?.setView([r.latitud, r.longitud], 18);
    setResultados(null);
    setAviso("");
  }
  const radioM = valor?.radioM || 100;

  const elegir = (latitud, longitud) => ultimo.current.alCambiar({ latitud, longitud, radioM: ultimo.current.valor?.radioM || 100 });

  // El mapa se crea una vez.
  useEffect(() => {
    const m = L.map(contenedor.current, { scrollWheelZoom: false }).setView(hayPunto(valor) ? [valor.latitud, valor.longitud] : CENTRO, hayPunto(valor) ? 17 : 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    m.on("click", (e) => {
      interno.current = true;
      elegir(e.latlng.lat, e.latlng.lng);
    });
    mapa.current = m;
    const t = setTimeout(() => m.invalidateSize(), 250); // por si se abre dentro de una ventana animada
    return () => {
      clearTimeout(t);
      m.remove();
      mapa.current = marcador.current = circulo.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El punto y el circulo siguen al valor.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!hayPunto(valor)) {
      marcador.current?.remove();
      circulo.current?.remove();
      marcador.current = circulo.current = null;
      return;
    }
    const centro = [valor.latitud, valor.longitud];
    if (!marcador.current) {
      marcador.current = L.marker(centro, { icon: pin, draggable: true }).addTo(m);
      marcador.current.on("dragend", () => {
        const p = marcador.current.getLatLng();
        interno.current = true;
        elegir(p.lat, p.lng);
      });
      circulo.current = L.circle(centro, { radius: radioM, color: "#6d4cc4", weight: 2, fillOpacity: 0.12 }).addTo(m);
    } else {
      marcador.current.setLatLng(centro);
      circulo.current.setLatLng(centro).setRadius(radioM);
    }
    if (interno.current) interno.current = false;
    else m.setView(centro, Math.max(m.getZoom(), 17));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor?.latitud, valor?.longitud, radioM]);

  function usarMiUbicacion() {
    setAviso("");
    if (!navigator.geolocation) {
      setAviso("Este navegador no permite usar la ubicación. Márcala en el mapa.");
      return;
    }
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        elegir(pos.coords.latitude, pos.coords.longitude);
        mapa.current?.setView([pos.coords.latitude, pos.coords.longitude], 18);
        setBuscando(false);
      },
      () => {
        setAviso("No pudimos leer tu ubicación. Permite el acceso en el navegador o márcala en el mapa.");
        setBuscando(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function pegar() {
    if (!enlace.trim()) return;
    const punto = leerCoordenadas(enlace);
    if (!punto) {
      // No son coordenadas ni un enlace con coordenadas: se busca por nombre.
      if (/^https?:\/\//i.test(enlace.trim())) {
        setAviso("Ese enlace no trae coordenadas (los enlaces abreviados no sirven). Abre el lugar en Google Maps y copia el enlace de la barra de direcciones.");
        return;
      }
      buscarNombre(enlace);
      return;
    }
    setAviso("");
    setEnlace("");
    elegir(punto.latitud, punto.longitud);
    mapa.current?.setView([punto.latitud, punto.longitud], 17);
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={contenedor} className="isolate relative z-0 h-[240px] w-full rounded-xl overflow-hidden border border-gray-200" role="application" aria-label="Mapa para marcar el sitio del evento" />
      <p className="m-0 text-[13px] text-ink-500">
        {hayPunto(valor) ? "Arrastra el punto o toca otro lugar del mapa para moverlo." : "Toca el mapa donde será la actividad. Ahí los estudiantes podrán marcar su asistencia."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={usarMiUbicacion} disabled={buscando} className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold disabled:opacity-60">
          {buscando ? "Buscando…" : "Usar mi ubicación actual"}
        </button>
        <label className="text-sm font-semibold flex items-center gap-2">
          Radio
          <select value={radioM} onChange={(e) => alCambiar({ latitud: valor?.latitud ?? null, longitud: valor?.longitud ?? null, radioM: Number(e.target.value) })} className={`${campo} !min-h-[40px] py-1`}>
            {RADIOS.map((m) => (
              <option key={m} value={m}>
                {m} m
              </option>
            ))}
          </select>
        </label>
        {hayPunto(valor) && (
          <>
            <a href={`https://www.google.com/maps?q=${valor.latitud},${valor.longitud}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary">
              Ver en Google Maps
            </a>
            <button type="button" onClick={() => alCambiar({ latitud: null, longitud: null, radioM })} className="text-sm font-semibold text-red-700 underline">
              Quitar punto
            </button>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={enlace}
          onChange={(e) => setEnlace(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              pegar();
            }
          }}
          onPaste={(e) => {
            const punto = leerCoordenadas(e.clipboardData.getData("text"));
            if (punto) {
              e.preventDefault();
              setAviso("");
              elegir(punto.latitud, punto.longitud);
              mapa.current?.setView([punto.latitud, punto.longitud], 17);
            }
          }}
          placeholder="Busca un lugar, o pega un enlace de Google Maps o «latitud, longitud»"
          aria-label="Buscar un lugar, enlace de Google Maps o coordenadas"
          className={`${campo} flex-1 min-w-0`}
        />
        <button type="button" onClick={pegar} className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold">
          Usar
        </button>
      </div>
      {consultando && <p className="m-0 text-sm text-ink-500">Buscando «{textoBuscado}»…</p>}
      {!consultando && resultados && (
        <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
          <p className="m-0 px-3 py-2 text-[13px] text-ink-500 border-b border-gray-100">
            {resultados.length ? `Lugares para «${textoBuscado}». Elige uno para marcarlo en el mapa:` : `No encontré «${textoBuscado}». Prueba con otro nombre o márcalo en el mapa.`}
          </p>
          <ul className="list-none m-0 p-0">
            {resultados.map((r) => (
              <li key={`${r.latitud},${r.longitud}`} className="border-t border-gray-100 first:border-t-0">
                <button type="button" onClick={() => elegirResultado(r)} className="w-full text-left min-h-[48px] px-3 py-2 hover:bg-primary-light/50">
                  <span className="block text-sm font-bold text-primary-dark">{r.nombre}</span>
                  {r.detalle && <span className="block text-[13px] text-ink-500 truncate">{r.detalle}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {aviso && <p className="m-0 text-sm text-red-700">{aviso}</p>}
    </div>
  );
}
