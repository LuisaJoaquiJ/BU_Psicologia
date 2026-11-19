// Asistente de Conecta BU: protocolo de emergencia y riesgo vital (prioridad
// maxima). La deteccion es determinista y corre en el backend ANTES de
// cualquier otra logica y antes de consultar a Gemini o a n8n, para que
// funcione igual con o sin IA. Si hay señales de crisis:
//   Paso A. Al estudiante se le responde con un mensaje de contencion calido
//           (varias variantes) que SIEMPRE trae TEXTO_OBLIGATORIO y el correo.
//   Paso B. Se arma el bloque «ALERTA ROJA» con un motivo de 1-2 lineas (nunca
//           el historial) y se avisa al personal de Desarrollo Humano. El
//           bloque nunca se muestra al estudiante.

// --- Datos de contacto (faciles de cambiar) ---------------------------------
// LINEA_APOYO_URGENTE (opcional) permite cambiar el telefono o WhatsApp sin
// tocar el codigo; por defecto, la linea 123.
const LINEA_POR_DEFECTO = "123";
const lineaApoyo = () => String(process.env.LINEA_APOYO_URGENTE || "").trim() || LINEA_POR_DEFECTO;
const CORREO_PSICOLOGIA = "psicologoinstitucional@uniautonoma.edu.co";

// Instruccion obligatoria y literal del Paso A.
const textoObligatorio = (linea = lineaApoyo()) =>
  `Por favor, comunícate ahora mismo a nuestra línea de apoyo urgente: ${linea} o acércate al área de Psicología. ` +
  "Hay profesionales listos para escucharte y acompañarte en este preciso momento. No estás solo/a.";

// Aperturas de contencion: validan la emocion sin juzgar. Se elige una al azar.
const APERTURAS = [
  "Gracias por confiarme lo que estás sintiendo. Sé que no es fácil ponerlo en palabras, y lo que sientes es real e importa muchísimo. En la universidad nos importas, y mereces apoyo ahora mismo.",
  "Siento mucho que estés pasando por un momento tan doloroso. Lo que sientes es válido, y el hecho de que lo cuentes ya es un acto de valentía. No tienes que cargar con esto tú solo/a.",
  "Lamento de corazón que te sientas así. Cuando todo pesa tanto es normal sentirse sin salida, pero ese dolor puede aliviarse con ayuda, y tú mereces recibirla hoy.",
  "Te leo y quiero que sepas que me importa lo que te pasa. Lo que estás viviendo suena muy difícil, y está bien no poder con todo solo/a. Hay personas en la universidad que quieren acompañarte.",
];

function respuestaCrisis({ azar = Math.random, linea = lineaApoyo() } = {}) {
  const apertura = APERTURAS[Math.floor(azar() * APERTURAS.length) % APERTURAS.length];
  return (
    `${apertura}\n\n**${textoObligatorio(linea)}**\n\n` +
    `También puedes escribir a Desarrollo Humano: ${CORREO_PSICOLOGIA}. Estamos aquí para ti. 💙`
  );
}

// Reconoce la respuesta de contencion (propia o de la IA) por su texto obligatorio.
const esRespuestaCrisis = (texto) => /comunícate ahora mismo a nuestra línea de apoyo urgente/i.test(String(texto || ""));

// --- Bloque de alerta para el personal (Paso B) -----------------------------
const TITULO_ALERTA = "🚨 ALERTA ROJA: POSIBLE RIESGO VITAL 🚨";
const ACCION_ALERTA = "🛑 Acción requerida: Intervención inmediata de Psicología.";
const bloqueAlerta = (motivo) => `${TITULO_ALERTA}\n${ACCION_ALERTA}\n📌 Motivo detectado: ${lineaMotivo(motivo)}`;

// --- Normalizacion tolerante ------------------------------------------------
// Minusculas, sin tildes ni emojis, letras repetidas recortadas («quierooo»),
// numeros usados como letras («m0rir»), abreviaturas de chat («q», «xq», «toy»,
// «kiero») y faltas de ortografia en las palabras clave (por sonido: v/b, z/s/c,
// h muda, qu/k, letras dobles; y, en las palabras muy especificas, un error de
// una letra: «suicdarme», «envenarme»).
const ABREVIATURAS = [
  [/\b(q|k|ke|qe)\b/g, "que"],
  [/\b(xq|pq|porq|xk|xke|xq?ue|porke|porqe)\b/g, "porque"],
  [/\b(toy|toi|stoy|estoi|ttoy)\b/g, "estoy"],
  [/\b(tas|stas)\b/g, "estas"],
  [/\b(ta|sta)\b/g, "esta"],
  [/\b(kiero|qiero|qero|quero|kero|quiro|qiiero|kiro|kieroo|qiro|quieor|qiuero)\b/g, "quiero"],
  [/\b(kisiera|qisiera|kiciera|quiciera|quisira)\b/g, "quisiera"],
  [/\b(keria|qeria)\b/g, "queria"],
  [/\b(m)\b/g, "me"],
  [/\b(t)\b/g, "te"],
  [/\b(d)\b/g, "de"],
  [/\b(dl)\b/g, "del"],
  [/\b(x)\b/g, "por"],
  [/\b(pa)\b/g, "para"],
  [/\b(aki|aqi|aca|aqui)\b/g, "aqui"],
  [/\b(tmb|tb|tbn|tambn)\b/g, "tambien"],
  [/\b(nd|nda)\b/g, "nada"],
  [/\b(nadien|naide|nadi)\b/g, "nadie"],
  [/\b(ns)\b/g, "no se"],
  [/\b(mjr|mejr)\b/g, "mejor"],
  [/\b(kmo|cmo)\b/g, "como"],
  [/\b(cn)\b/g, "con"],
  [/\b(ia|lla|yaa|yap)\b/g, "ya"],
  [/\b(nomas|nomaz)\b/g, "no mas"],
  [/\b(maz|mas)\b/g, "mas"],
  [/\b(vda|bda)\b/g, "vida"],
  [/\b(vivr|vivi r)\b/g, "vivir"],
  [/\b(dano|danio|danyo|dao)\b/g, "dano"],
  [/\b(ojla|ojal|ojalaa)\b/g, "ojala"],
  [/\b(despues|dsps|dps)\b/g, "despues"],
  [/\b(kms)\b/g, "matarme"],
  [/\b(matar|cortar|morir|ahorcar|envenenar|colgar|lanzar|tirar|disparar|ahogar|quemar|asfixiar|suicidar|lastimar|desangrar|rajar|golpear|herir) (me)\b/g, "$1me"],
  [/\bauto ?lesi/g, "autolesi"],
  [/(suisid|suicd|sucid|suisd|suicdi|suiscid|suiced|suisid|suizid|suicih|siucid|suucid)/g, "suicid"],
  [/\bsobre ?dosis\b/g, "sobredosis"],
];

// Clave fonetica de una palabra: asi «bida», «suisidio», «aorcarme», «matarrme»
// y «kiero» se reconocen como «vida», «suicidio», «ahorcarme», «matarme» y «quiero».
function fonetica(palabra) {
  return palabra
    .replace(/ch/g, "1")
    .replace(/h/g, "")
    .replace(/1/g, "ch")
    .replace(/qu/g, "k")
    .replace(/c(?=[ei])/g, "s")
    .replace(/c/g, "k")
    .replace(/z/g, "s")
    .replace(/x/g, "s")
    .replace(/v/g, "b")
    .replace(/w/g, "gu")
    .replace(/ll/g, "y")
    .replace(/(.)\1+/g, "$1");
}

// Palabras clave que se corrigen por sonido (cualquier largo).
const CLAVES = [
  "quiero", "quisiera", "vida", "vivir", "viviendo", "morir", "morirme", "muerto", "muerta", "muera", "matarme", "matar", "mato",
  "suicidio", "suicidarme", "suicidarse", "suicidar", "suicida", "cortarme", "cortar", "corte", "corto", "venas", "venitas", "munecas",
  "ahorcarme", "ahorcar", "ahorco", "colgarme", "envenenarme", "veneno", "pastillas", "pepas", "sobredosis", "lanzarme", "tirarme",
  "dispararme", "disparo", "ahogarme", "quemarme", "asfixiarme", "desaparecer", "existir", "extranaria", "extranar", "despedida",
  "despertar", "sentido", "lastimarme", "lastimo", "hacerme", "dano", "golpearme", "violaron", "violacion", "abusaron", "aguanto",
  "soporto", "carga", "salida", "nadie", "nunca", "hacer", "puente", "edificio", "soga", "cuchilla", "navaja", "raticida", "acabar",
  "terminar", "todo", "matarte", "sangrar", "desangrarme", "rajarme", "herirme", "cuello", "arma", "tiro", "balazo",
];
// Solo estas (muy especificas) aceptan ademas un error de una letra.
const CLAVES_DIFUSAS = ["suicidio", "suicidarme", "suicidarse", "envenenarme", "ahorcarme", "sobredosis", "autolesion", "autolesionarme", "desangrarme", "asfixiarme", "dispararme", "despedida", "desaparecer"];
// Palabras reales parecidas que NO se deben corregir.
const NO_CORREGIR = new Set(["contarme", "portarme", "acortarme", "ahorrarme", "cansarme", "mandarme", "matare", "marcarme", "notarme", "cortarte", "mato", "nada", "carga", "cargar", "salida", "salir", "todo", "toda", "acabe", "termine", "tiro", "aparecer", "desaparecio", "despedir", "parecer", "pastilla"]);

const PORFONETICA = new Map(CLAVES.map((c) => [fonetica(c), c]));
const DIFUSAS = CLAVES_DIFUSAS.map((c) => [fonetica(c), c]);
const NO_CORREGIR_FONETICA = new Set([...NO_CORREGIR].map(fonetica));
// Vocabulario de los patrones (se arma al final del archivo): cualquier palabra
// escrita «por sonido» («bentana», «kabeyo», «asta») vuelve a su forma correcta.
const VOCABULARIO = new Set();
const VOCAB_FONETICA = new Map();

function unaLetraDeDiferencia(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let cambios = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    cambios += 1;
    if (cambios > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else if (a[i + 1] === b[j] && a[i] === b[j + 1]) {
      i += 2; // letras cambiadas de lugar
      j += 2;
    } else {
      i += 1;
      j += 1;
    }
  }
  return cambios + (a.length - i) + (b.length - j) <= 1;
}

function corregirPalabra(p) {
  if (p.length < 2 || NO_CORREGIR.has(p) || VOCABULARIO.has(p)) return p;
  const f = fonetica(p);
  if (NO_CORREGIR_FONETICA.has(f)) return p;
  const exacta = PORFONETICA.get(f) || VOCAB_FONETICA.get(f);
  if (exacta) return exacta;
  if (p.length >= 7) for (const [fd, c] of DIFUSAS) if (unaLetraDeDiferencia(f, fd)) return c;
  return p;
}

function normalizarCrisis(texto) {
  let t = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // «m0rir», «suic1d4rme»: numeros usados como letras dentro de una palabra.
    .replace(/(?<=[a-z])[0134@$](?=[a-z0134@$]*[a-z])/g, (d) => ({ 0: "o", 1: "i", 3: "e", 4: "a", "@": "a", $: "s" })[d])
    .replace(/(.)\1{2,}/g, "$1");
  t = t.replace(/[^a-z0-9.!?;:,\n]+/g, " ");
  for (const [patron, reemplazo] of ABREVIATURAS) t = t.replace(patron, reemplazo);
  t = t.replace(/[a-z]+/g, corregirPalabra);
  for (const [patron, reemplazo] of ABREVIATURAS.slice(-4)) t = t.replace(patron, reemplazo);
  return t.replace(/ +/g, " ").trim();
}

// --- Patrones -----------------------------------------------------------------
// Cada mensaje se revisa por clausulas (se corta en signos de puntuacion y en
// «pero»/«aunque») para distinguir hiperboles comunes («me muero de risa», «el
// parcial me va a matar», «me corte el pelo»). Principio: ANTE LA DUDA, SE DETECTA.
// Cada patron puede traer «no» (contexto que lo vuelve hiperbole o accidente),
// salvo que la clausula traiga una señal grave (GRAVE), que siempre gana.
const GRAVE = /(a proposito|aproposito|adrede|para (morir|morirme|matarme|no despertar|desaparecer|sentir (algo|dolor)|castigarme|acabar)|hasta (sangrar|morir|que sangre|desangrarme)|venas|munecas|suicid|no quiero (vivir|seguir|despertar)|otra vez|de nuevo|cada (vez|noche|dia)|todos los dias|sangre|sangrar|cicatri)/;

// Intencion en primera persona (presente, futuro o pasado reciente).
const QUIERO =
  "(?:quiero|quisiera|queria|deseo|necesito|prefiero|planeo|pienso|voy a|vo a|iba a|ire a|estoy por|estoy a punto de|estoy pensando en|estuve pensando en|he pensado en|pense en|pensando en|ando pensando en|pienso en|tengo ganas de|me dan ganas de|me dieron ganas de|siento ganas de|ganas de|deberia|debería|podria|me gustaria|tengo que|ya decidi|decidi|estoy decidid[oa] a|tengo planeado|tengo pensado|intente|intento|trate de|quise|hoy voy a|esta noche voy a|ya voy a|ya quiero|solo quiero|a veces quiero|me provoca|se me pasa por la cabeza|se me ocurre|fantaseo con|sueno con)";
const ADV = "(?:\\w+ ){0,3}"; // hasta tres palabras en medio («quiero ya de una vez cortarme»)
// «me quiero cortar», «me voy a matar»: el pronombre antes del verbo auxiliar.
const meQuiero = (verbo) => new RegExp(`\\bme ${ADV}${QUIERO} ${ADV}${verbo}\\b`);

const HIPERBOLE_MORIR = "(?! (de|del) (la |el |tanta |tanto |puro |pura )?(risa|hambre|sueno|frio|calor|verguenza|pena|amor|ganas|aburrimiento|envidia|ternura|cansancio|nervios|miedo|emocion|susto|felicidad|alegria|curiosidad|sed|aburricion|mamera|pereza|flojera|antojo|celos|rabia|ira|ansias|gusto|placer|dolor de cabeza|calor))";
const POR_ANHELO = "(?! por (ir|verte|ver|conocer|tener|comer|salir|que|un|una|el|la|los|las|estar|viajar|probar|saber|ser|volver|ganar|descansar|dormir|vacaciones|tu|su|mi|esa|ese))";
const ACADEMICO = "(parcial|parciales|tarea|tareas|trabajo|trabajos|materia|materias|examen|examenes|clase|clases|profe|profesor|profesora|quiz|proyecto|proyectos|exposicion|semestre|tesis|entrega|entregas|taller|talleres|calculo|fisica|quimica|matematicas|ingles|universidad|carrera|jefe|turno|trafico|ruido|calor|frio|gente|fila|tesis)";
const SUJETO_HIPERBOLE = "(mi mama|mi papa|mama|papa|mi mami|mi papi|mis papas|mi madre|mi padre|mi vieja|mi viejo|mi cucha|mi cucho|el profe|la profe|el profesor|la profesora|mi jefe|mi jefa|mi novia|mi novio|mi hermana|mi hermano|mi abuela|mi abuelo|mi tia|mi tio|el parcial|este parcial|ese parcial|la tarea|esta tarea|el examen|este examen|esta materia|la materia|el semestre|este semestre|el calor|este calor|el trafico|esta clase|la clase|el trabajo|este trabajo|la tesis|el estres|mi equipo|la entrega|mi familia|ese man|ese tipo|mi amiga|mi amigo)";

const LANZAR = "(tirarme|lanzarme|arrojarme|aventarme|botarme|echarme|me (tiro|tire|lanzo|lance|arrojo|aviento|boto)|me (\\w+ )?(quiero|voy a|vo a|pienso|ganas de|quisiera|iba a) (\\w+ )?(tirar|lanzar|arrojar|aventar|botar))";
const TOMAR = "(tomarme|tomar|tragarme|tragar|beberme|beber|me tome|me trague|me tomo|me voy a tomar|me quiero tomar|tomarmelas|tomarmelos|me las voy a tomar|me las tome|me las tomo|tomarse|me tomaria)";

const P = (tipo, re, no = null) => ({ tipo, re: typeof re === "string" ? new RegExp(re) : re, no: typeof no === "string" ? new RegExp(no) : no });
const IDEACION = "Ideación suicida";
const METODO = "Método de suicidio o autolesión";
const PLAN = "Despedida o plan suicida";
const AUTO = "Autolesión";
const DESESP = "Desesperanza extrema";
const GRAVE_T = "Crisis grave";

const PASTILLAS = "(pastillas|pastias|pastiyas|pastilas|pastiillas|pastas|pepas|pildoras|tabletas|capsulas|medicamentos|medicinas|remedios|clonazepam|rivotril|alprazolam|diazepam|fluoxetina|sertralina|acetaminofen|paracetamol|ibuprofeno|tramadol|antidepresivos|calmantes|somniferos|pastillas para dormir|ansioliticos|benzodiacepinas)";
const LIQUIDOS = "(veneno|raticida|matarratas|mata ratas|insecticida|cloro|varsol|thinner|tiner|gasolina|acido|acido muriatico|soda caustica|creolina|limpiador|limpiavidrios|desinfectante|liquido de frenos|anticongelante|lejia|blanqueador|fumigante|herbicida|glifosato|cianuro|arsenico|liquido)";
const ALTURA = "(puente|edificio|piso|pisos|ventana|balcon|terraza|techo|azotea|tejado|vacio|abismo|precipicio|barranco|risco|acantilado|torre|puente peatonal|mirador|cerro|montana|edificio mas alto|ultimo piso|segundo piso|tercer piso|quinto piso)";
const VEHICULO = "(carro|carros|bus|buses|tren|metro|metrocable|transmilenio|camion|tractomula|mula|moto|motos|via|autopista|carretera|avenida|rieles|linea del tren)";
const AGUA = "(rio|mar|lago|laguna|represa|piscina|tina|banera|quebrada|canal|cauca|magdalena|agua)";
const AGUA_PELIGRO = "(rio|represa|quebrada|cauca|rio cauca|magdalena|rio magdalena|precipicio|abismo|vacio)";
const CUERPO = "(venas|vena|venitas|munecas|muneca|brazos|brazo|piernas|pierna|muslos|muslo|piel|abdomen|panza|estomago|cuello|garganta|antebrazos|antebrazo|tobillos)";

const PATRONES = [
  // ---- Ideacion suicida explicita ------------------------------------------
  P(IDEACION, /suicid\w*/),
  P(IDEACION, /\b(kill myself|killing myself|suicide|i want to die|wanna die|want to die|end my life|self harm|selfharm|self-harm|unalive)\b/),
  P(IDEACION, /quitar(me|se)? (la|mi) (propia )?vida/),
  P(IDEACION, /(acabar|terminar|terminare|acabare|acabo|termino) con (mi|la) (propia )?(vida|existencia)/),
  P(IDEACION, /(acabar|terminar|acabo|termino|acabare|terminare) con (todo|esto)( ya| de una vez| para siempre| hoy| esta noche| de una| ya mismo)?$/),
  P(IDEACION, /(acabar|terminar) con (todo|esto) (de una vez|para siempre|hoy|esta noche|ya mismo)/),
  P(IDEACION, /(acabar|terminar) con (mi|este|tanto) (sufrimiento|dolor|tormento|agonia)/),
  P(IDEACION, `matarme(?! (estudiando|trabajando|de (la )?risa|del cansancio|en el (gym|gimnasio)|haciendo|corriendo|entrenando|con (el|la|los|las|este|esta|estos|estas) ${ACADEMICO}))`),
  P(IDEACION, meQuiero("matar"), `me ${ADV}matar (estudiando|trabajando|de (la )?risa|en el (gym|gimnasio)|con (el|la|este|esta) ${ACADEMICO})`),
  P(IDEACION, /(^|(?<!\bde )\b(ya|yo|mejor|hoy|creo que hoy|creo que|entonces|pues|asi que|manana|ahorita|ahora|que|o|si no|sino|juro que|te juro que|al final|por eso) )me (mato|matare)( ya| hoy| de una vez| ahora| esta noche| mañana| manana| en serio)?$/),
  P(IDEACION, /\bme (voy|vo) a matar$/),
  P(IDEACION, /\b(me|nos) (quiero|quisiera|deseo|prefiero|voy a|vo a|ganas de|quiero ya) (\w+ )?morir(me)?\b/, `morir(me)?${HIPERBOLE_MORIR.replace("(?!", "(?=")}|morir(me)? (con|por|en) (el|la|los|las|este|esta|estos|estas|mi|mis|tanto|tanta)? ?${ACADEMICO}|morir(me)? si |morir(me)? (de|del) (la )?(risa|pena|verguenza)`),
  P(IDEACION, new RegExp(`\\b(quiero|quisiera|deseo|prefiero|necesito|ganas de|solo quiero|ya quiero|tengo ganas de|me dan ganas de) (\\w+ )?morir(me)?\\b${HIPERBOLE_MORIR}`)),
  P(IDEACION, new RegExp(`\\bmorirme${HIPERBOLE_MORIR}${POR_ANHELO}`), `morirme (de|del) (la |el )?(risa|hambre|sueno|frio|calor|verguenza|pena|ganas)`),
  P(IDEACION, /ojala (me muera|me muriera|morir|morirme|estuviera muert|estar muert|no despertar|no despierte|no despertara|no existiera|no existir|no haber nacido|nunca hubiera nacido|desaparecer|me pase algo|me atropell|me mate|me matara|me matasen|todo se acabe|se acabe todo)/),
  P(IDEACION, /(mejor|prefiero estar|estaria mejor|estaria mas feliz|seria mejor estar|quisiera estar|quiero estar) muert[oa]s?/),
  P(IDEACION, /(dormirme|dormir|me duermo|acostarme|irme a dormir) y no (volver a )?despertar/),
  P(IDEACION, /no (volver a |quiero volver a )?despertar(me)? (nunca|jamas|mas|mañana|manana)/),
  P(IDEACION, /no me quiero (volver a )?despertar|no quiero (volver a )?(amanecer|ver otro dia|ver el amanecer|que llegue mañana|que llegue manana)/),
  P(IDEACION, /mejor (me muero|me mato|me muriera|me desaparezco|morir|morirme|matarme|desaparecer)( ya| de una vez)?$|mejor (me muero|me mato|morir|morirme)(?! (de|del) (risa|hambre|sueno|pena|verguenza))/),
  P(DESESP, /si (me muero|me mato|desaparezco|no estoy|me voy) (\w+ )?(nadie|a nadie|ni cuenta|no pasa nada|nadie lo)/),
  P(IDEACION, /dormir para siempre/),
  P(IDEACION, /(quisiera|quiero|deseo|prefiero|preferiria|ojala) (\w+ )?no (existir|haber nacido|estar aqui|estar en este mundo|estar viv[oa])/),
  P(IDEACION, /dejar de existir|no existir mas|desaparecer (para siempre|del mundo|de este mundo|de la tierra|de la faz de la tierra|de todo|del todo)|irme (para siempre|de este mundo|de esta vida)/),
  P(IDEACION, /(ya )?no quiero estar (aqui|aca|mas aqui|en este mundo|vivo|viva|presente|en esta vida)(?! (en|de) (la|esta|este|mi) (u|universidad|clase|carrera|ciudad|casa|materia|trabajo|grupo|chat|semestre|salon))/),
  P(IDEACION, /(pienso|pense|he pensado|ando pensando|estoy pensando|pensando|pensar|pensado|piensa|pensamientos de|ideas de) (mucho |seguido |a veces |todo el tiempo |solo |siempre )?(en )?(matarme|morir|morirme|la muerte|quitarme la vida|acabar con (todo|mi vida)|suicid|cortarme|ahorcarme|tirarme|lanzarme|envenenarme|desaparecer|las pastillas|tomarme las pastillas|no despertar|dejar de existir)/),
  P(IDEACION, /no (merezco|meresco) (vivir|estar viv|existir|seguir|la vida|respirar)/),
  P(IDEACION, /(la gente como yo|alguien como yo|personas como yo|gente como yo) (no merece|deberia|no deberia) (vivir|morir|existir|estar)/),
  P(IDEACION, /(quiero|voy a|necesito|ganas de|pienso) (\w+ )?(irme|partir|descansar) (para siempre|de este mundo|en paz para siempre)/),
  P(IDEACION, /(la )?muerte (es|seria) (la )?(unica )?(salida|solucion|opcion|descanso|lo mejor)/),
  P(IDEACION, /(quiero|ganas de|deseo) (\w+ )?(la muerte|estar con dios ya|reunirme con)/),

  // ---- Metodos: cortarse ----------------------------------------------------
  P(METODO, `(cortar|cortarme|cortarse|abrir|abrirme|rajar|rajarme|abrirse) ${ADV}(las|mis|la|mi)? ?(venas|vena|venitas|munecas|muneca)`),
  P(METODO, `(venas|munecas) ${ADV}(cortad|abiert|rajad)`),
  P(AUTO, meQuiero("cortar"), `me ${ADV}cortar (el|los|las|la|mi|mis) (pelo|cabello|unas|una|fleco|barba|flequillo|puntas|melena|bigote|cejas|cabeza)|cortar (con|de) (el|la|mi) (novia|novio|pareja|grupo)|cortar (el|la|los|las) (cebolla|tomate|papa|carne|pan|verdura|tela|papel|cable|luz|agua|cuento|rollo)`),
  P(AUTO, `(cortarme|rajarme)(?! (el|los|las|la|mi|mis) (pelo|cabello|unas|una|fleco|barba|flequillo|puntas|melena|bigote|cejas))`),
  P(AUTO, /\bme (corto|corte|cortaba|he cortado|estoy cortando|volvi a cortar|vuelvo a cortar|cortare|corte otra vez|he estado cortando|rajo|raje)\b/, `\\bme (corto|corte|cortaba|he cortado|cortare|rajo|raje) (el|los|las|la|mi|mis|un|una) (pelo|cabello|unas|una|fleco|barba|flequillo|puntas|melena|bigote|cejas|dedo|dedos|labio|cara|mano|rodilla|pie)|(cocinando|picando|pelando|afeitando|afeitandome|rasurando|rasurandome|jugando|trabajando|arreglando|sin querer|por accidente|accidentalmente|con (un|una|el|la) (papel|hoja|lata|cuchillo de cocina|tijera))|me corte (con|de) (el|la|mi) (novia|novio|pareja)|me corte el (cable|internet|agua|servicio)`),
  P(AUTO, `(cuchilla|cuchillas|navaja|bisturi|vidrio|cuchillo|tijeras|gillette|cuchilla de afeitar) ${ADV}(para )?(cortarme|hacerme dano|lastimarme|las venas|los brazos|las piernas|las munecas|mis brazos|mis piernas)`),
  P(AUTO, `me (corto|corte|rajo|raje|abro|abri|rayo|raye|raspo|raspe) ${ADV}${CUERPO}`),
  P(AUTO, `(rayarme|rasparme|rayandome) ${ADV}${CUERPO}|(rayarme|me rayo|me raye) (con|los|las) ${ADV}(cuchilla|navaja|vidrio|bisturi|brazos|piernas|munecas)`),
  P(AUTO, /\b(cutting|cutter|cortes en (los|mis) (brazos|piernas|munecas))\b/),

  // ---- Metodos: pastillas, veneno ------------------------------------------
  P(METODO, /sobredosis|overdose/),
  P(METODO, /envenenarme|envenenarse|me (envenene|envenenare|voy a envenenar|quiero envenenar)/),
  P(METODO, `${TOMAR} ${ADV}((todas|todos|muchas|muchos|un monton|varias|varios|mil|20|30|50|cien|demasiadas|bastantes)( de)?( las| los| mis| esas| unas)? ${PASTILLAS}|(un|el|todo el) (frasco|tarro|blister)|(la|una|toda la) caja( de ${PASTILLAS})?|un (punado|puno)( de ${PASTILLAS})?)`),
  P(METODO, `(tomarme|tomar|tragarme|me tome|me trague|me voy a tomar|me quiero tomar) ${ADV}${PASTILLAS} ${ADV}(para (morir|no despertar|dormir para siempre|matarme|acabar|desaparecer)|de una vez|hasta morir|todas juntas|juntas)`),
  P(METODO, `(tomarme|tomar|beberme|beber|tragarme|tragar|me tome|me trague|me voy a tomar|me quiero tomar|me tomo) ${ADV}(el |la |un |una |del |de )?${LIQUIDOS}(?! (de|del) (frenos|la bateria))`, `(tomar|tomo|tome) (agua|liquido) (para|porque|cuando) |tomar mucho liquido`),
  P(METODO, /(veneno|raticida|matarratas|mata ratas|cianuro|arsenico) (para (mi|morir|matarme|acabar)|me lo tomo|me voy a tomar|y me lo|para tomarmelo)/),
  P(METODO, /(comprar|compre|conseguir|consegui|tengo|ya tengo|busco|buscar) (\w+ )?(veneno|raticida|matarratas|cianuro)/),
  P(METODO, `(pensando en|pienso en|ya compre|ya tengo|consegui|ahorre|guarde|estoy guardando|junte|estoy juntando|tengo guardad[ao]s) ${ADV}(las|mis|unas|todas las|varias)? ?${PASTILLAS}`),
  P(METODO, `${PASTILLAS} (para (morir|matarme|no despertar|acabar|dormir para siempre|suicid|quitarme))`),
  P(PLAN, `(tengo|ya tengo|aqui tengo|estoy con) (las|todas las|mis|unas|muchas|un monton de) ${PASTILLAS} (en la mano|listas|aqui|conmigo|al lado|frente a mi|en frente)`),

  // ---- Metodos: ahorcarse --------------------------------------------------
  P(METODO, /ahorcarme|ahorcarse|me (ahorco|ahorque|ahorcare|voy a ahorcar|quiero ahorcar)|\bahorcar\b/, `(ahorque|ahorco|ahorcad[oa]|ahorcarme|ahorcar) (\\w+ )?(en|con|de) (el|la|los|las|este|esta|mis|mi)? ?(${ACADEMICO}|plata|dinero|tiempo|deudas|pagos|cuentas|gastos|arriendo)|(jaja|jeje)`),
  P(METODO, `colgarme ${ADV}(del|de un|de una|de la|con|en el|en la)? ?(soga|lazo|cuerda|cuello|techo|viga|arbol|cinturon|correa|sabana|cable|ducha|baranda|lampara|puerta|closet)`),
  P(METODO, meQuiero("colgar"), `colgar (con|en) (la|el|las|los) ${ACADEMICO}|colgar (la|el) (ropa|cuadro|llamada|telefono|foto|hamaca)`),
  P(METODO, /(quiero|voy a|pienso|ganas de) (\w+ )?colgarme$/),
  P(METODO, /(soga|lazo|cuerda|cinturon|correa) (al|en el|alrededor del) cuello|\buna soga\b|\bla soga\b|nudo (de la horca|corredizo)|\bhorca\b/, /soga (de|para) (la clase|educacion|saltar|jugar|tirar|amarrar|el gimnasio|deporte|la tienda|ropa)|saltar (la )?soga|juego de la soga|soga de saltar/),

  // ---- Metodos: lanzarse ----------------------------------------------------
  P(METODO, `${LANZAR} ${ADV}(de|desde|del|por) (un |una |el |la |los |las |mi |este |ese |lo mas alto de )?${ALTURA}`, `(tirar|tiro|tire|echar|echo) (\\w+ )?(de|del) (la )?(cama|risa|pelo)`),
  P(METODO, `${LANZAR} ${ADV}(al|a la|a|a los|en el|en la|bajo el|bajo la|bajo|frente a|delante de|debajo de|contra) (un |una |el |la |los |las |este |ese )?(${VEHICULO}|${AGUA_PELIGRO})`),
  P(METODO, /(saltar|brincar) (de|desde|del|por) (un |una |el |la )?(puente|edificio|piso|ventana|balcon|terraza|techo|azotea|precipicio|abismo|vacio)/),
  P(METODO, /(atravesar(me|se)?|meter(me)?|cruzar(me)?|me (atravieso|meto|cruzo|atravesare)) (\w+ )?(frente a|delante de|bajo|debajo de|al paso de) (un |una |el |la )?(carro|bus|tren|metro|camion|tractomula|mula|moto|transmilenio)/),
  P(METODO, /(dejarme|dejar que me) (atropellar|arrollar|pisar)|que me atropelle (un|el|una)/),

  // ---- Metodos: armas ------------------------------------------------------
  P(METODO, /pegar(me)? un (tiro|balazo|disparo|plomazo|pepazo)|dispararme|dispararse|me (disparo|dispare|voy a disparar|quiero disparar|pego un tiro|pegare un tiro)|volarme (la cabeza|los sesos)|tiro en la (cabeza|sien|boca)/),
  P(METODO, /(arma|pistola|revolver|escopeta|fierro|changon) (para (matarme|mi|acabar|suicid|pegarme)|y (me|acabar|terminar))|(conseguir|consegui|comprar|compre|tengo|ya tengo) (\w+ )?(un arma|una pistola|un revolver|una escopeta)/),
  P(METODO, /(cuchillo|cuchilla|navaja|machete|punal) (para (matarme|clavarmelo|enterrarmelo|acabar|cortarme)|en el (pecho|corazon|cuello|estomago))|clavarme (un|el|una|la) (cuchillo|navaja|punal)|apunalarme|acuchillarme/),

  // ---- Metodos: ahogarse, quemarse, asfixiarse, hambre ---------------------
  P(METODO, `ahogarme(?! (en|con) (tareas|trabajos|deudas|${ACADEMICO}|un vaso de agua|el agua))`),
  P(METODO, meQuiero("ahogar"), `ahogar (en|con) (las|los|un|una|el|la)? ?(tareas|trabajos|deudas|${ACADEMICO}|vaso de agua)`),
  P(METODO, `(meterme|tirarme|lanzarme|hundirme) ${ADV}(al|en el|en la|a la) ${AGUA} (y no salir|para (no salir|ahogarme|morir))`),
  P(METODO, /quemarme (viv[oa]|a proposito|con (gasolina|fuego|cigarrill|encendedor|aceite)|la piel|los brazos)|prenderme fuego|prenderme candela|echarme gasolina|me (quiero|voy a) quemar (viv[oa]|con)/),
  P(METODO, /asfixiarme|asfixiarse|me (quiero|voy a) asfixiar|(ponerme|meterme) una bolsa (en la cabeza|plastica)|(gas|monoxido) (para (morir|matarme|dormir))|abrir el gas (y|para)|encerrarme con el (carro|gas) prendido/),
  P(METODO, /dejar de comer (hasta morir|para morir|para (desaparecer|matarme|acabar)|hasta desaparecer|para siempre)|matarme de hambre|dejarme morir( de hambre)?|no (volver a )?comer nunca mas (hasta|para)/),
  P(METODO, /desangrarme|desangrarse|morir desangrad/),

  // ---- Despedidas y planes ---------------------------------------------------
  P(PLAN, /(esta es|este es|esto es) (mi|la) (despedida|ultimo mensaje|ultima carta|ultima vez)|(les|te|os) (dejo|escribo|mando) (esta|mi|una) (despedida|carta de despedida|ultima carta)|\b(mi|esta) despedida( de todos| para todos| final)?$|mi (carta|mensaje|nota) de despedida|carta de despedida|nota (de )?suicid|mi ultim[oa] (mensaje|carta|vez que hablo)(?! (de|del|en) (la|el|clase|semestre|grupo|chat|trabajo))|(es|sera|hoy es) mi ultim[oa] (dia|noche)( en este mundo| de vida| aqui| con vida)?$|mi ultim[oa] (dia|noche) (en este mundo|de vida|con vida|aqui)/),
  P(PLAN, /adios (a todos|a todo el mundo|para siempre|mundo|mundo cruel|vida|familia|a mi familia|a la vida)|me despido (de todos|de ustedes|para siempre|de este mundo|de la vida|de mi familia)|(hasta|hasta aqui) (llegue|llego)( yo)?$|(este|hoy) es (mi )?(el )?fin$/),
  P(PLAN, /ya no me (volveran a ver|van a volver a ver|veran|vas a ver|van a ver mas|veran mas|vas a volver a ver)|no me (volveran|van a volver) a ver nunca|nunca mas (sabran|van a saber) de mi|pronto (ya )?no (voy a estar|estare)( aqui| mas)?$|nadie (me )?(va a|volvera a|vuelve a) ver(me)? (mas|nunca)|(ya )?nadie me va a ver mas/),
  P(PLAN, /(quiero|ojala|espero|solo pido|pido) que (mi familia|mis papas|mi mama|mi papa|ustedes|todos|mis amigos|mi novia|mi novio|dios) me (perdone|perdonen)|(prepare|deje listo|organice|tengo listo|alliste|aliste) todo para (irme|partir|morir|el final|cuando me vaya)|todo listo para irme$/),
  P(PLAN, /(cuiden|cuidenme|cuida|cuidad|por favor cuiden) (a|de) (mi|mis) (familia|mama|papa|mami|papi|hermanos|hermanas|hermano|hermana|hijo|hija|hijos|perro|perrito|gato|gatito|mascota|abuela|abuelo|novia|novio)/),
  P(PLAN, /(deje|escribi|tengo escrita|ya escribi|voy a dejar) (una|la|mi) carta( de despedida| para| a| en| y|$)/),
  P(PLAN, /ya (lo )?tengo (todo )?(planeado|planificado|preparado|decidido|listo|pensado|resuelto)(?! para (el|la|mi|mis) (viaje|parcial|examen|exposicion|fiesta|evento|presentacion|entrega|clase|trabajo|tarea|cita|semestre|matricula))/),
  P(PLAN, /ya (lo )?decidi( hoy| esta noche| que hoy| que esta noche| no hay vuelta atras| y no hay vuelta atras)?$|ya tome la decision( de (acabar|irme|terminar|hacerlo))?$|no hay vuelta atras$/),
  P(PLAN, /hoy es el dia$|hoy es el dia (en )?que (me|lo|acabo|termino|todo)|esta noche (lo hago|lo voy a hacer|me voy|me mato|termino|acabo|se acaba|todo termina|es la noche)|lo (hago|voy a hacer) esta noche$|hoy (me voy|me mato|lo hago) para siempre/),
  P(PLAN, `ya (compre|tengo|consegui|deje listas?|deje listos?) (las|la|el|los|unas|una) (${PASTILLAS}|soga|cuerda|veneno|raticida|arma|pistola|cuchilla|navaja)`),
  P(PLAN, /(regalar|regalando|regale|voy a regalar|repartir|repartiendo|deshacerme de) (todas )?(mis|todas mis) (cosas|pertenencias|ropa|libros|cosas personales)/),
  P(PLAN, /(perdon(enme|ame|eme|en)?|perdonen|disculpen(me)?) (por|x) (lo que (voy a|vamos a|estoy por) hacer|todo lo que (voy a|he) hacer|irme asi|lo que (hare|hice)|todo)$|lo siento por todo$|lo siento (mama|papa|mami|papi|familia) (por|perdon)/),
  P(PLAN, /(dejar|deje) (todo )?(arreglado|en orden|organizado) (antes de (irme|morir|partir)|para cuando (me vaya|no este))|cuando (yo )?(ya )?no este (aqui|mas|presente|con ustedes)/),

  // ---- Autolesion ------------------------------------------------------------
  P(AUTO, /autolesi/),
  P(AUTO, /(hacerme|me hago|me hice|me hare|me voy a hacer|me he hecho|quiero hacerme|me quiero hacer|ganas de hacerme|me estoy haciendo) (\w+ )?(cortes|cortaditas|heridas|quemaduras|moretones)/),
  P(AUTO, /(y|luego|despues|siempre|ahi|alli|cuando) me (golpeo|pego|corto|lastimo|quemo)$|^me (golpeo|lastimo)$/),
  P(AUTO, `(hacerme|me hago|me hice|me estoy haciendo|me he hecho|me hare|me voy a hacer|quiero hacerme|me quiero hacer|ganas de hacerme) (\\w+ )?dano(?! (jugando|entrenando|en el (partido|entrenamiento|gym|gimnasio)|haciendo (ejercicio|deporte)|en la (cancha|pierna|rodilla|espalda|tobillo)))`),
  P(AUTO, `(lastimarme|herirme|danarme|lastimarme a mi mism|me lastimo|me lastime|me lastimaba|me hiero|me heri)(?! (jugando|entrenando|en el (partido|entrenamiento|gym|gimnasio)|haciendo (ejercicio|deporte)|la (rodilla|espalda|pierna|mano|tobillo|muneca|cadera|hombro|cuello) (jugando|entrenando|en|haciendo|cargando|corriendo)))`, `(lastime|lastimo|heri) (la|el|mi) (rodilla|espalda|pierna|mano|tobillo|hombro|dedo|pie) (jugando|entrenando|en el|haciendo|cargando|corriendo|bailando|en la cancha)|sin querer|por accidente`),
  P(AUTO, meQuiero("(lastimar|herir|golpear|danar|rasgunar|aranar|desangrar)")),
  P(AUTO, /me (golpeo|golpee|pego|pegue|doy golpes|daba golpes) (a mi mism|contra (la|las) (pared|paredes|piso|puerta|mesa)|la cabeza contra|hasta (sangrar|que|sentir|hacerme)|cuando (me siento|estoy) (mal|triste|sola|solo|ansios))|golpearme (a mi mism|la cabeza|contra|hasta)|darme golpes (contra|en la cabeza|hasta)/),
  P(AUTO, /me (quemo|queme|he quemado) (a proposito|con (cigarrillos?|encendedor|un fosforo|fosforos|la plancha|cucharas?)|los brazos|la piel|para sentir)/),
  P(AUTO, /(me )?(rasguno|rasgune|rasgunarme|arano|arane|aranarme|rasco|rascarme|arranco|arrancarme) (\w+ ){0,3}(hasta (sangrar|que sangre|hacerme sangre|abrirme)|la piel|los brazos|las piernas|las costras)/),
  P(AUTO, /hasta (sangrar|que sangre|hacerme sangre|que me sangre)/),
  P(AUTO, /golpearme(?! (jugando|entrenando|sin querer|con (la|el) (mesa|puerta|pared) sin querer))/),
  P(AUTO, /(quiero|necesito|me gusta|ganas de|busco) (\w+ )?sentir (dolor( fisico)?|algo de dolor|que me duela|el dolor en (mi|el) cuerpo)/),
  P(AUTO, /(castigarme|me castigo) (fisicamente|lastimandome|haciendome dano|golpeandome|cortandome|con dolor|sin comer)/),
  P(AUTO, /(vomitar|vomito|me provoco el vomito) (\w+ )?(todo lo que como|a proposito|para castigarme|cada vez que como)|no como (nada )?(para castigarme|hace dias porque no merezco)/),

  // ---- Desesperanza extrema --------------------------------------------------
  P(DESESP, /no quiero (seguir )?(vivir|viviendo|existir|existiendo|estar viv|respirar|seguir en este mundo|seguir aqui)/),
  P(DESESP, /no quiero seguir( asi)?( mas)?$|ya no quiero seguir( con (esto|mi vida|la vida|esta vida|todo))?$/),
  P(DESESP, /(cansad[oa]|harto|harta|aburrid[oa]|agotad[oa]|fastidiad[oa]|me canse|me harte|me aburri) de (vivir|la vida|mi vida|esta vida|existir|estar viv|seguir viv|respirar|todo y de todos)/),
  P(DESESP, /(no vale la pena|no tiene sentido|para que|de que sirve|para que sigo|no le veo caso a) (seguir )?(vivir|viviendo|existir|estar viv|seguir viv|la vida)|(ya )?no (vale|tiene) (la pena|sentido) seguir( asi| viv[oa]| aqui| luchando| intentando)?$/),
  P(DESESP, /no (le )?(veo|encuentro|tiene|hay|le hallo) (ningun |el )?sentido (a |en |de )?(la|mi|esta|seguir|vivir|nada|existir|estar)/),
  P(DESESP, /(mi|la|esta) vida (ya )?no (tiene|vale) (sentido|nada|la pena|ningun sentido)|(mi|la) vida es una mierda y (quiero|no)/),
  P(DESESP, /(ya )?nada tiene sentido|nada vale la pena( ya)?$/),
  P(DESESP, /no tengo (razones|motivos|ganas|razon|por que|porque|para que) (para |de )?(vivir|seguir viviendo|seguir viv|seguir|existir|levantarme)/),
  P(DESESP, /(sin|no tengo|perdi|he perdido|estoy perdiendo|ya no tengo|se me fueron|se me acabaron) (\w+ ){0,2}(ganas de vivir|esperanza|ganas de seguir|ganas de nada|razones para vivir)/),
  P(DESESP, /no deberia (existir|estar viv|haber nacido|estar aqui)|nunca debi (haber )?nacer|ojala nunca hubiera nacido/),
  P(DESESP, /no quiero (volver a )?despertar(me)?/),
  P(DESESP, /quiero desaparecer(?! (de|del) (este |ese |esta |esa |la |el |los |las |mi )?(grupo|chat|clase|curso|salon|whatsapp|reunion|pantalla|foto|mapa|fiesta|u|universidad|trabajo|casa|ciudad|redes))/),
  P(DESESP, /nadie (me )?(extranaria|va a extranar|me echaria de menos|lo notaria|se daria cuenta si (me muero|desaparezco|no estoy|me voy)|notaria si (me muero|desaparezco|no estoy|me voy)|me quiere|me necesita|me va a extranar)/),
  P(DESESP, /a nadie le (importaria|importa|va a importar|importo) si (me muero|desaparezco|no estoy|me pasa algo|me mato|me voy)|a nadie le importo/),
  P(DESESP, /(serian|estarian|seria|estaria|vivirian) (mas )?(felices|mejor|tranquil[oa]s|en paz) si (me muero|desaparezco|no estoy|me voy|me mato|ya no estoy)|(todos|todo el mundo|mi familia|mis papas|mi mama|mi papa|los demas|ustedes|el mundo) (estarian|estaria|vivirian|serian|seria|estarán|estaran|va a estar|van a estar) (mejor|mas felices|mas tranquil[oa]s|bien) sin mi/),
  P(DESESP, /(soy|solo soy|me siento|me he vuelto|me volvi) (una carga|un estorbo|un problema para todos|un peso|una molestia para todos)(?! (de|en) (trabajo|tareas))/),
  P(DESESP, /no aguanto (mas )?(la vida|mi vida|vivir|esta vida|seguir viviendo|seguir viv|existir|estar viv)|ya no (puedo|aguanto|soporto) (mas )?con (mi vida|la vida|esta vida|todo esto|todo|vivir|esto)$/),
  P(DESESP, new RegExp(`(siento que |ya |de verdad |en serio )?no (puedo|aguanto|doy|soporto|resisto) mas(?! ((con|de|por) )?(el|la|los|las|este|esta|estos|estas|tanto|tanta|tantos|tantas|mi|mis)? ?${ACADEMICO})(?! (de|del) (risa|hambre|sueno|calor|frio))`)),
  P(DESESP, /no sirvo para nada|no valgo nada|soy un fracaso total y (quiero|no)|soy (una|un) (basura|mierda|desperdicio) y (quiero|no merezco|mejor)/, /no sirvo para nada (en|con|cocinando|bailando|jugando|haciendo|para (la|el|las|los) )/),
  P(DESESP, /no (hay|tengo|veo|le veo|encuentro|le encuentro|existe) (ninguna |otra )?salida(?! (de|para|del) (el|la|este|esta)? ?(parqueadero|edificio|metro|bus|salon|clase|campus|universidad))|(estoy |me siento )?atrapad[oa] (y )?sin salida|sin salida$|callejon sin salida en mi vida/),
  P(DESESP, /nada (va a|nunca va a|jamas va a) (mejorar|cambiar|estar bien|salir bien)|nunca (va a|nada va a) (mejorar|cambiar)|(esto|mi vida|todo) (nunca|jamas) va a (mejorar|cambiar|estar bien)|no (va a|hay como) mejorar nunca|(ya )?no hay esperanza|perdi toda esperanza/),
  P(DESESP, /(quiero|quisiera|deseo|solo quiero|ojala pudiera) (\w+ )?(rendirme|dejar de sentir|que todo (se acabe|termine|pare)|que se acabe todo|que todo acabe|apagarme|que el dolor (pare|se acabe)|que se acabe (el|este) (dolor|sufrimiento)|que (termine|pare) (el|este) (dolor|sufrimiento))/),
  P(DESESP, /(me (siento|siento tan|siento muy)|estoy) (vaci[oa] por dentro|muert[oa] (por dentro|en vida)|sin ganas de vivir|en el fondo del pozo|destruid[oa] y (quiero|no))/),
  P(DESESP, /(estoy|me siento) (muy|demasiado|super|tan|terriblemente|gravemente|profundamente|re|bien|horriblemente) deprimid[oa]|depresion (severa|grave|muy fuerte|profunda|horrible)/),
  P(DESESP, /(no tengo ganas de nada|ya no tengo fuerzas (para (nada|seguir|vivir))?|ya no tengo fuerzas$|no me quedan fuerzas)/),

  // ---- Crisis grave: violencia, abuso, panico, voces -------------------------
  P(GRAVE_T, /abus(o|aron|ando|aba|an) de mi|me (violaron|violo|viola|violan|abusaron|abuso|abusa|abusan|tocaron sin|toco sin|drogaron y|forzaron|obligaron a tener)|abusaron (sexualmente )?de mi|abuso sexual|violacion|acoso sexual|abusador|me (estan|esta) (acosando sexualmente|violando|abusando)/, /violacion (de|del|a) (la |los |el )?(norma|normas|reglamento|datos|privacidad|contrato|transito|politica|ley|codigo|derechos de autor)|me abuso de (la |su )?confianza/),
  P(GRAVE_T, /me (estan|esta|siguen|sigue) (golpeando|pegando|maltratando|amenazando|pegando en la casa)|me (pega|pegan|pego|pegaron|golpea|golpean|golpeo|golpearon|maltrata|maltratan|maltrato|maltrataron) (mi |el |la )?(novio|novia|pareja|esposo|esposa|papa|mama|padrastro|madrastra|tio|tia|hermano|hermana|ex|exnovio|exnovia|abuelo|abuela|jefe|profesor|profe|primo|prima|vecino)|me (pegan|golpean|maltratan) en (la|mi) casa|violencia (en (mi |la )?casa|intrafamiliar|domestica|de pareja|de genero)|(mi )?(novio|novia|pareja|esposo|esposa|papa|mama|padrastro|madrastra|tio|hermano|exnovio|ex) me (pega|golpea|maltrata|amenaza|viola|abusa|toca|quiere matar|va a matar)/, /me (va|van) a matar (si|cuando|porque|por)|(va|van) a matar (si|cuando)/),
  P(GRAVE_T, new RegExp(`(?<!${SUJETO_HIPERBOLE} )me (quieren|quiere|van a|va a|vienen a|amenazaron con|amenazan con) (matar|hacer dano|desaparecer|violar|secuestrar)(?! si| cuando| con (el|la|este|esta) ${ACADEMICO})`), `${SUJETO_HIPERBOLE} me (va|van) a matar|me (va|van) a matar (si|cuando|porque perdi|por perder|por llegar)`),
  P(GRAVE_T, /amenaza(s|ron|ndo)? de muerte|me amenazaron|tengo miedo (por|de perder) mi vida|temo por mi vida|mi vida (esta|corre) (en )?peligro|tengo miedo de que me maten|me estan buscando para (matarme|hacerme dano)/),
  P(GRAVE_T, /ataque de (panico|ansiedad) (y|que) (no puedo|siento que)|(estoy teniendo|tengo|me dio|me esta dando) (un )?ataque de (panico|ansiedad)|no puedo respirar(?! (bien )?(por|con) (la|el) (gripa|gripe|resfriado|congestion|nariz|tapabocas|calor|humo))|siento que me (ahogo|muero|voy a morir)(?! (de|del) (risa|calor|hambre|sueno))|crisis (emocional|nerviosa|de panico|de ansiedad)|estoy (teniendo|en) (una )?crisis|tengo una crisis/),
  P(GRAVE_T, /(escucho|oigo|siento) (unas |las )?voces|las voces (me dicen|me piden|me ordenan)|(una )?voz (me dice|me pide|me ordena) que (me|haga)|me dicen que me (haga dano|mate|lastime|corte)/),
  P(GRAVE_T, /(estoy|me siento) (en peligro|en riesgo)|corro peligro|necesito ayuda (urgente|ya|ahora|por favor ayuda)|ayudenme por favor|auxilio/, /(necesito ayuda|ayudenme) (urgente |ya |ahora |por favor )?(con|para|en) |auxilio (economico|de transporte|alimentario|alimenticio|educativo|de alimentacion|monetario|estudiantil|de matricula|para|de sostenimiento|de conectividad)|en riesgo (academico|de perder|de bajo)/),
];

// Vocabulario: palabras de los patrones y de sus excepciones. Si dos palabras
// suenan igual («vez» y «ves»), esa clave no se corrige.
(function armarVocabulario() {
  const fuentes = [GRAVE.source, ...PATRONES.flatMap(({ re, no }) => [re.source, no ? no.source : ""])];
  const ambiguas = new Set();
  for (const fuente of fuentes) {
    for (const palabra of fuente.replace(/\\[a-z]/gi, " ").match(/[a-z]{2,}/g) || []) {
      VOCABULARIO.add(palabra);
      const f = fonetica(palabra);
      const previa = VOCAB_FONETICA.get(f);
      if (previa && previa !== palabra) ambiguas.add(f);
      else VOCAB_FONETICA.set(f, palabra);
    }
  }
  for (const f of ambiguas) VOCAB_FONETICA.delete(f);
})();

// Revisa tambien el texto pegado («mequieromorir»): solo frases inequivocas.
const COMPACTAS = /(suicid|mequieromorir|quieromorir|mequieromatar|quieromatarme|matarme|quitarmelavida|cortarmelasvenas|mequierocortar|ahorcarme|envenenarme|noquierovivir|sobredosis|tirarmedeunpuente)/;

// Clausulas: se corta en signos de puntuacion, saltos de linea y en «pero»/«aunque».
const clausulasDe = (normal) =>
  normal
    .split(/[.!?;:,\n]+| pero | aunque | sino /)
    .map((c) => c.trim())
    .filter(Boolean);

// Devuelve { tipo, frase, motivo } o null. «frase» es solo el fragmento que
// activo la alerta (no el mensaje completo ni la conversacion).
function detectarCrisis(texto) {
  const normal = normalizarCrisis(String(texto || "").slice(0, 5000));
  if (!normal) return null;
  const encontrada = (tipo, frase) => {
    const corta = frase.trim().slice(0, 80);
    return { tipo, frase: corta, motivo: lineaMotivo(`El/la estudiante escribió «${corta}» (${tipo.toLowerCase()}).`) };
  };
  const clausulas = clausulasDe(normal);
  for (const clausula of clausulas) {
    const grave = GRAVE.test(clausula);
    for (const { tipo, re, no } of PATRONES) {
      const m = clausula.match(re);
      if (!m) continue;
      if (no && !grave && no.test(clausula)) continue;
      return encontrada(tipo, m[0]);
    }
  }
  // Palabras pegadas largas («mequieromorir»): solo frases inequivocas.
  for (const palabra of normal.split(/[^a-z]+/)) {
    if (palabra.length < 10) continue;
    const m = palabra.match(COMPACTAS);
    if (m && !/(estudiando|trabajando|derisa|delarisa|delapena|delaverguenza|dehambre|desueno|elpelo|elcabello)/.test(palabra)) return encontrada(IDEACION, m[0]);
  }
  return null;
}

// Una sola linea (o dos, unidas), sin caracteres de control ni barras
// verticales, maximo 300 caracteres.
function lineaMotivo(texto) {
  return String(texto || "")
    .replace(/[\r\n\t|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300) || "Señales de posible crisis emocional";
}

// Si la IA devolvio el bloque «ALERTA ROJA» (o la etiqueta antigua
// [ALERTA_CRISIS_PSICOLOGICA]), todo desde ahi se quita del texto (nunca lo ve
// el estudiante) y se devuelve el motivo para disparar la alerta.
const INICIO_ALERTA = /(🚨\s*)?ALERTA ROJA|\[?\s*ALERTA_CRISIS_PSICOLOGICA/i;
function extraerAlerta(texto) {
  const original = String(texto || "");
  const m = original.match(INICIO_ALERTA);
  if (!m) return { texto: original, motivo: null };
  const bloque = original.slice(m.index);
  const motivo = bloque.match(/Motivo(?: detectado)?\s*:\s*([\s\S]*)/i);
  const linea = motivo ? lineaMotivo(motivo[1].replace(/^\[|\]$/g, "")) : "";
  return {
    texto: original.slice(0, m.index).replace(/[\s📌🛑🚨]+$/u, "").trim(),
    motivo: linea || "Señales de posible crisis emocional (detectadas por la IA)",
  };
}

// --- Alerta al personal -------------------------------------------------------
// CADA mensaje de riesgo genera su alerta: la seguridad del estudiante va antes
// que evitar avisos repetidos. Solo se agrupa el MISMO mensaje del mismo
// estudiante repetido en menos de 1 minuto (doble clic o reenvio). Antes habia
// un limite de 1 alerta cada 10 minutos por estudiante que podia callar una
// alerta nueva (incluso si la anterior no le llego a nadie).
const VENTANA_DUPLICADO_MS = 60 * 1000;
const ultimasAlertas = new Map();

function debeAlertar(usuarioId, texto = "", ahora = Date.now()) {
  const clave = `${usuarioId || "anonimo"}|${normalizarCrisis(texto)}`;
  const ultima = ultimasAlertas.get(clave);
  if (ultima && ahora - ultima < VENTANA_DUPLICADO_MS) return false;
  ultimasAlertas.set(clave, ahora);
  if (ultimasAlertas.size > 5000) {
    for (const [k, t] of ultimasAlertas) if (ahora - t >= VENTANA_DUPLICADO_MS) ultimasAlertas.delete(k);
  }
  return true;
}

const limpiarAlertasCrisis = () => ultimasAlertas.clear();

// Mensaje de la notificacion (maximo 500 caracteres): estudiante, accion y
// motivo. Si no cabe, se recorta el motivo, nunca el resto.
const MAX_MENSAJE = 500;
function mensajeAlerta(nombre, correo, motivo) {
  const inicio = `Estudiante: ${nombre} (${correo})\n${ACCION_ALERTA}\n📌 Motivo detectado: `;
  const espacio = Math.max(MAX_MENSAJE - inicio.length, 40);
  let linea = lineaMotivo(motivo);
  if (linea.length > espacio) linea = `${linea.slice(0, espacio - 1)}…`;
  return `${inicio}${linea}`.slice(0, MAX_MENSAJE);
}

// Avisa al personal de Desarrollo Humano (centro de notificaciones) y, si esta
// configurado, a n8n. Solo viajan nombre, correo y el motivo (nunca el
// historial). Nunca lanza errores: la respuesta al estudiante no depende de esto.
// «texto»: el mensaje del estudiante, solo para reconocer duplicados (no se guarda ni se envia).
async function dispararAlertaCrisis(usuario, motivo, { texto } = {}) {
  const linea = lineaMotivo(motivo);
  const bloque = bloqueAlerta(linea);
  try {
    if (!debeAlertar(usuario?.id, texto || linea)) {
      console.warn(`${bloque}\n(mismo mensaje repetido en menos de 1 minuto; ya se avisó)`);
      return { enviada: false, duplicada: true, bloque };
    }
    console.warn(bloque);
    const nombre = usuario?.nombre || "Estudiante";
    const correo = usuario?.emailInstitucional || "sin correo";
    const avisos = require("../../notificaciones/service");
    const destinatarios = await avisos.avisarAlPersonal("desarrollo-humano", {
      modulo: "desarrollo-humano",
      tipo: "alerta-crisis",
      titulo: TITULO_ALERTA,
      mensaje: mensajeAlerta(nombre, correo, linea),
      ruta: null,
    });
    try {
      const { notificar } = require("../../../integrations/n8n.client");
      notificar("asistente.alerta_crisis", { estudiante: { id: usuario?.id, nombre, email: correo }, motivo: linea, alerta: bloque });
    } catch (err) {
      console.error(`[asistente] No se pudo avisar a n8n de la alerta: ${err.message}`);
    }
    if (!destinatarios) console.error("[asistente] ALERTA DE CRISIS SIN DESTINATARIOS: no hay personal con acceso a Desarrollo Humano. Asigna al menos una persona en Super > Accesos.");
    return { enviada: destinatarios > 0, destinatarios, bloque };
  } catch (err) {
    console.error(`[asistente] No se pudo enviar la alerta de crisis: ${err.message}`);
    return { enviada: false, bloque };
  }
}

module.exports = {
  CORREO_PSICOLOGIA,
  TITULO_ALERTA,
  ACCION_ALERTA,
  lineaApoyo,
  textoObligatorio,
  respuestaCrisis,
  esRespuestaCrisis,
  bloqueAlerta,
  normalizarCrisis,
  detectarCrisis,
  extraerAlerta,
  dispararAlertaCrisis,
  limpiarAlertasCrisis,
};
