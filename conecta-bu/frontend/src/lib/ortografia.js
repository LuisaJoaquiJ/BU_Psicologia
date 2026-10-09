// Ayuda de ortografia para lo que escribe el personal y los estudiantes.
// Solo corrige casos seguros del español (sin depender de un servicio
// externo, para no enviar fuera textos que pueden tener datos personales):
//  - palabras terminadas en -cion / -sion, que siempre llevan tilde
//    (atencion -> atención, sesion -> sesión);
//  - una lista corta de palabras frecuentes sin ambigüedad (tambien, dia...);
//  - espacios dobles, espacio antes de coma o punto y mayuscula inicial.
// El corrector del navegador (subrayado rojo) complementa esta ayuda.

const PALABRAS = {
  tambien: "también",
  despues: "después",
  aqui: "aquí",
  alli: "allí",
  dia: "día",
  dias: "días",
  psicologia: "psicología",
  psicologica: "psicológica",
  psicologicas: "psicológicas",
  psicologico: "psicológico",
  psicologicos: "psicológicos",
  psicologo: "psicólogo",
  psicologa: "psicóloga",
  academico: "académico",
  academica: "académica",
  academicos: "académicos",
  academicas: "académicas",
  telefono: "teléfono",
  sabado: "sábado",
  miercoles: "miércoles",
  facil: "fácil",
  dificil: "difícil",
  ultimo: "último",
  ultima: "última",
  proximo: "próximo",
  proxima: "próxima",
  energia: "energía",
  tecnologia: "tecnología",
  matematicas: "matemáticas",
  medico: "médico",
  medica: "médica",
  medicos: "médicos",
  enfermeria: "enfermería",
  rectoria: "rectoría",
  basico: "básico",
  basica: "básica",
  tecnica: "técnica",
  tecnico: "técnico",
  pagina: "página",
  autonoma: "autónoma",
  todavia: "todavía",
  estan: "están",
  segun: "según",
  ademas: "además",
  asi: "así",
  jovenes: "jóvenes",
  examenes: "exámenes",
  reunion: "reunión",
  capacitacion: "capacitación",
  vocacion: "vocación",
};

function conMayusculaComo(original, corregida) {
  if (original === original.toUpperCase() && original.length > 1) return corregida.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return corregida[0].toUpperCase() + corregida.slice(1);
  return corregida;
}

function corregirPalabra(palabra) {
  const min = palabra.toLowerCase();
  if (PALABRAS[min] && PALABRAS[min] !== min) return conMayusculaComo(palabra, PALABRAS[min]);
  if (min.length > 5 && /(c|s)ion$/.test(min)) {
    return conMayusculaComo(palabra, min.replace(/ion$/, "ión"));
  }
  return palabra;
}

// Devuelve { texto, cambios: [[antes, despues], ...] }.
export function revisarOrtografia(texto, { mayusculaInicial = false } = {}) {
  if (!texto || /https?:\/\/|www\.|@/.test(texto)) return { texto, cambios: [] };
  const cambios = [];
  let nuevo = texto.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (p) => {
    const c = corregirPalabra(p);
    if (c !== p) cambios.push([p, c]);
    return c;
  });
  const espacios = nuevo.replace(/ {2,}/g, " ").replace(/ +([,.;:])/g, "$1");
  if (espacios !== nuevo) cambios.push(["espacios de más", "corregidos"]);
  nuevo = espacios;
  if (mayusculaInicial) {
    const conMayus = nuevo.replace(/^(\s*)([a-záéíóúñ])/, (_, esp, letra) => esp + letra.toUpperCase());
    if (conMayus !== nuevo) cambios.push(["inicio en minúscula", "mayúscula"]);
    nuevo = conMayus;
  }
  return { texto: nuevo, cambios };
}
