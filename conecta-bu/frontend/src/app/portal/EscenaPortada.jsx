import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

// Escena 3D de la portada: un objeto por dimension, con su color, flota sobre
// la foto de la sede y sigue al mouse con un leve paralaje.
//   Desarrollo Humano  corazon que late (bienestar emocional)
//   Deporte            balon de futbol
//   Salud              cruz medica
//   Arte y Cultura     nota musical
//   Permanencia        birrete de grado
// Los objetos se arman con piezas de Three.js (no se descargan modelos).
// Es decorativa: no recibe clics ni la leen los lectores de pantalla.
//
// Cuidados:
// - Se carga aparte (React.lazy), asi Three.js no pesa en el resto del sitio.
// - Solo anima mientras la portada se ve y la pestana esta abierta.
// - Con "reducir movimiento" se dibuja una vez y queda quieta.
// - Si el navegador no tiene WebGL, no muestra nada y la portada sigue igual.

// Ocupan la mitad derecha de la portada (el titulo esta a la izquierda y la
// cinta de dimensiones va en su propia seccion, mas abajo). En pantallas de
// menos de 1280 px se muestran los tres primeros.
const OBJETOS = [
  { objeto: "corazon", color: "#7FB0FF", x: 0.56, y: 0.02, escala: 0.82 }, // Desarrollo Humano
  { objeto: "balon", color: "#FFB08A", x: 0.86, y: 0.42, escala: 0.72 }, // Deporte
  { objeto: "nota", color: "#C9B8FF", x: 0.66, y: 0.56, escala: 0.62 }, // Arte y Cultura
  { objeto: "cruz", color: "#5DE0C6", x: 0.88, y: -0.3, escala: 0.58 }, // Salud
  { objeto: "birrete", color: "#F3D27A", x: 0.62, y: -0.5, escala: 0.58 }, // Permanencia
];

// Material con brillo de vidrio en el color de la dimension.
function vidrio(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.16,
    roughness: 0.25,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    ...extra,
  });
}

const BISEL = { bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 6, curveSegments: 32 };

function corazon(color) {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 4, ...BISEL, bevelThickness: 1.4, bevelSize: 1.2 });
  geo.center();
  geo.rotateZ(Math.PI); // la figura base viene con la punta hacia arriba
  geo.scale(0.1, 0.1, 0.1);
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(geo, vidrio(color)));
  return grupo;
}

// Balon de futbol clasico (icosaedro truncado): 12 pentagonos negros en los
// vertices de un icosaedro y 20 hexagonos blancos en el centro de sus caras.
// Cada punto de una esfera fina pertenece a la cara cuyo plano corta primero
// su radio; cerca del limite entre dos caras se hunde un poco (la costura) y
// el centro de cada panel queda abombado, como un balon cosido.
function balon() {
  const base = new THREE.IcosahedronGeometry(1, 0).getAttribute("position");
  const vertices = [];
  for (let i = 0; i < base.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(base, i).normalize();
    if (!vertices.some((u) => u.distanceTo(v) < 1e-4)) vertices.push(v);
  }
  const centros = [];
  for (let i = 0; i < base.count; i += 3) {
    centros.push(new THREE.Vector3().fromBufferAttribute(base, i).add(new THREE.Vector3().fromBufferAttribute(base, i + 1)).add(new THREE.Vector3().fromBufferAttribute(base, i + 2)).normalize());
  }
  // Distancia de cada cara al centro, relativa (pentagono / hexagono).
  const caras = [...vertices.map((n) => ({ n, d: 1.02653, pentagono: true })), ...centros.map((n) => ({ n, d: 1, pentagono: false }))];

  let geo = new THREE.IcosahedronGeometry(1, 56);
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  geo = mergeVertices(geo);
  const pos = geo.getAttribute("position");
  const colores = new Float32Array(pos.count * 3);
  const negro = new THREE.Color("#16181E");
  const blanco = new THREE.Color("#F6F5F0");
  const costura = new THREE.Color("#3A3D45");
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize();
    let mejor = -Infinity;
    let segundo = -Infinity;
    let cara = null;
    for (const f of caras) {
      const valor = p.dot(f.n) / f.d;
      if (valor > mejor) {
        segundo = mejor;
        mejor = valor;
        cara = f;
      } else if (valor > segundo) segundo = valor;
    }
    const brecha = mejor - segundo; // 0 justo en la costura
    const enCostura = 1 - THREE.MathUtils.smoothstep(brecha, 0.002, 0.014);
    const abombado = THREE.MathUtils.smoothstep(brecha, 0, 0.09);
    p.multiplyScalar(0.975 + 0.025 * abombado - 0.012 * enCostura);
    pos.setXYZ(i, p.x, p.y, p.z);
    c.copy(cara.pentagono ? negro : blanco).lerp(costura, enCostura * 0.85);
    colores.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colores, 3));
  geo.computeVertexNormals();
  const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.3 });
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(geo, material));
  return grupo;
}

function cruz(color) {
  const brazo = 0.36; // medio ancho de cada brazo
  const largo = 1; // medio largo de la cruz
  const s = new THREE.Shape();
  s.moveTo(-brazo, largo);
  s.lineTo(brazo, largo);
  s.lineTo(brazo, brazo);
  s.lineTo(largo, brazo);
  s.lineTo(largo, -brazo);
  s.lineTo(brazo, -brazo);
  s.lineTo(brazo, -largo);
  s.lineTo(-brazo, -largo);
  s.lineTo(-brazo, -brazo);
  s.lineTo(-largo, -brazo);
  s.lineTo(-largo, brazo);
  s.lineTo(-brazo, brazo);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.42, ...BISEL });
  geo.center();
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(geo, vidrio(color)));
  return grupo;
}

function nota(color) {
  const material = vidrio(color);
  const grupo = new THREE.Group();
  // Cabeza ovalada e inclinada.
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), material);
  cabeza.scale.set(1.25, 0.88, 0.7);
  cabeza.rotation.z = 0.45;
  cabeza.position.set(-0.32, -0.95, 0);
  grupo.add(cabeza);
  // Plica.
  const plica = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.95, 16), material);
  plica.position.set(0.15, 0.02, 0);
  grupo.add(plica);
  // Bandera curva.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.15, -0.25, 0.75, -0.35, 0.62, -1.05);
  s.bezierCurveTo(0.58, -0.7, 0.3, -0.55, 0, -0.42);
  s.closePath();
  const bandera = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 24 }), material);
  bandera.position.set(0.15, 0.98, -0.05);
  grupo.add(bandera);
  return grupo;
}

function birrete(color) {
  const grupo = new THREE.Group();
  const tela = vidrio(color);
  const oscuro = vidrio("#B8892A", { emissiveIntensity: 0.1 });
  // Base que va en la cabeza.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.6, 40), oscuro);
  base.position.y = -0.3;
  grupo.add(base);
  // Tablero cuadrado.
  const tablero = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.9), tela);
  tablero.position.y = 0.04;
  grupo.add(tablero);
  // Boton, cordon y borla.
  const boton = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), oscuro);
  boton.position.y = 0.11;
  grupo.add(boton);
  const cordon = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.96, 8), oscuro);
  cordon.position.set(0.48, 0.1, 0);
  cordon.rotation.z = Math.PI / 2;
  grupo.add(cordon);
  const caida = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8), oscuro);
  caida.position.set(0.98, -0.17, 0);
  grupo.add(caida);
  const borla = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 16), oscuro);
  borla.position.set(0.98, -0.5, 0);
  grupo.add(borla);
  grupo.rotation.x = 0.35; // se ve el tablero desde arriba
  return grupo;
}

const CONSTRUIR = { corazon, balon, cruz, nota, birrete };

export default function EscenaPortada() {
  const contenedor = useRef(null);

  useEffect(() => {
    const raiz = contenedor.current;
    if (!raiz) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return undefined; // sin WebGL: la portada queda con la foto, como antes
    }
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const angosta = window.matchMedia("(max-width: 1279px)").matches; // portatil pequeno: menos objetos y menos detalle
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, angosta ? 1.5 : 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    raiz.appendChild(renderer.domElement);

    const escena = new THREE.Scene();
    const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camara.position.set(0, 0, 10);

    // Luz: una base suave y dos focos de colores que dan el brillo de "vidrio".
    escena.add(new THREE.AmbientLight(0xbfd4ff, 0.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.8);
    sol.position.set(4, 6, 8);
    escena.add(sol);
    const calida = new THREE.PointLight(0xffb36b, 40, 30);
    calida.position.set(-6, -3, 5);
    escena.add(calida);
    const fria = new THREE.PointLight(0x7fe8ff, 35, 30);
    fria.position.set(7, 4, 3);
    escena.add(fria);

    const lista = (angosta ? OBJETOS.slice(0, 3) : OBJETOS).map((o, i) => {
      const pivote = new THREE.Group(); // mueve y gira; el objeto conserva su pose
      pivote.add(CONSTRUIR[o.objeto](o.color));
      escena.add(pivote);
      return { ...o, malla: pivote, fase: i * 1.7, flota: 0.16 + (i % 2) * 0.08 };
    });

    // Polvo de luz al fondo, para dar profundidad.
    const puntos = new THREE.BufferGeometry();
    const cuantos = angosta ? 120 : 260;
    const posiciones = new Float32Array(cuantos * 3);
    for (let i = 0; i < cuantos; i++) {
      posiciones[i * 3] = (Math.random() - 0.5) * 22;
      posiciones[i * 3 + 1] = (Math.random() - 0.5) * 12;
      posiciones[i * 3 + 2] = -2 - Math.random() * 8;
    }
    puntos.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
    const polvo = new THREE.Points(puntos, new THREE.PointsMaterial({ color: 0xdfe9ff, size: 0.045, transparent: true, opacity: 0.6, depthWrite: false }));
    escena.add(polvo);

    // Ubica los objetos segun el tamano de la vista, a la derecha (el titulo
    // esta a la izquierda). En el celular la portada no monta la escena.
    let mitadAlto = 1;
    let mitadAncho = 1;
    let tamano = 1;
    function acomodar() {
      const { clientWidth: ancho, clientHeight: alto } = raiz;
      if (!ancho || !alto) return;
      renderer.setSize(ancho, alto, false);
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();
      mitadAlto = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) * camara.position.z;
      mitadAncho = mitadAlto * camara.aspect;
      tamano = Math.min(1.2, Math.max(0.5, mitadAncho / 6.5));
      for (const o of lista) {
        o.base = new THREE.Vector3(o.x * mitadAncho * 0.92, o.y * mitadAlto * 0.88, 0);
        o.malla.scale.setScalar(o.escala * tamano);
      }
    }
    acomodar();
    const observadorTamano = new ResizeObserver(acomodar);
    observadorTamano.observe(raiz);

    // Paralaje con el mouse (amortiguado, sin saltos).
    const objetivo = new THREE.Vector2(0, 0);
    const actual = new THREE.Vector2(0, 0);
    function alMover(e) {
      objetivo.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    }
    window.addEventListener("pointermove", alMover, { passive: true });

    let anterior = performance.now();
    let tiempo = 0;
    function dibujar() {
      const ahora = performance.now();
      const delta = Math.min((ahora - anterior) / 1000, 0.05);
      anterior = ahora;
      tiempo += delta;
      actual.x = THREE.MathUtils.damp(actual.x, objetivo.x, 3, delta);
      actual.y = THREE.MathUtils.damp(actual.y, objetivo.y, 3, delta);
      for (const o of lista) {
        if (!o.base) continue;
        const t = tiempo + o.fase;
        o.malla.position.set(
          o.base.x + actual.x * 0.35 * (1 + o.escala),
          o.base.y + Math.sin(t * 0.6) * o.flota - actual.y * 0.25 * (1 + o.escala),
          Math.sin(t * 0.4) * 0.6
        );
        // Giran poco para que se reconozcan siempre de frente; el balon si rueda.
        if (o.objeto === "balon") {
          o.malla.rotation.y += delta * 0.7;
          o.malla.rotation.x += delta * 0.25;
        } else {
          o.malla.rotation.y = Math.sin(t * 0.5) * 0.55 + actual.x * 0.25;
          o.malla.rotation.x = Math.sin(t * 0.35) * 0.18 + actual.y * 0.15;
          o.malla.rotation.z = Math.sin(t * 0.3) * 0.1;
        }
        // El corazon late: dos golpes cortos y una pausa.
        if (o.objeto === "corazon") {
          const ciclo = tiempo % 1.4;
          const latido = Math.exp(-((ciclo - 0.1) ** 2) / 0.003) * 0.08 + Math.exp(-((ciclo - 0.35) ** 2) / 0.003) * 0.05;
          o.malla.scale.setScalar(o.escala * tamano * (1 + latido));
        }
      }
      polvo.rotation.y = actual.x * 0.06 + tiempo * 0.01;
      polvo.position.y = -actual.y * 0.15;
      renderer.render(escena, camara);
    }

    // Anima solo mientras se ve la portada.
    let visible = true;
    const arrancar = () => {
      anterior = performance.now();
      renderer.setAnimationLoop(dibujar);
    };
    if (reducir) {
      dibujar();
    } else {
      arrancar();
    }
    const observadorVista = new IntersectionObserver(([entrada]) => {
      if (reducir) return;
      if (entrada.isIntersecting && !visible) arrancar();
      if (!entrada.isIntersecting && visible) renderer.setAnimationLoop(null);
      visible = entrada.isIntersecting;
    });
    observadorVista.observe(raiz);

    return () => {
      renderer.setAnimationLoop(null);
      observadorVista.disconnect();
      observadorTamano.disconnect();
      window.removeEventListener("pointermove", alMover);
      escena.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={contenedor} aria-hidden="true" className="pointer-events-none absolute inset-0 animate-aparecer motion-reduce:animate-aparecer-suave" />;
}
