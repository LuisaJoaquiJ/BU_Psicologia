/** @type {import('tailwindcss').Config} */
// Paleta de NOVA (nova.uniautonoma.edu.co): marino #1E3A5F en títulos,
// bandas y botones; crema #F3EDE1 de fondo; dorado #FFC107 y naranja
// #FF9800 / #E8740E solo como acento. El marino lleva el texto.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // El color interactivo sale del tema del modulo (index.css: azul por
        // defecto, verde en Salud, naranja en Deporte, dorado en Super).
        // "dark" es el azul noche de los titulares y no cambia.
        primary: {
          DEFAULT: "rgb(var(--primario) / <alpha-value>)",
          hover: "rgb(var(--primario-hover) / <alpha-value>)",
          dark: "#1E3A5F", // marino de NOVA: titulares, botones y bandas
          light: "rgb(var(--primario-claro) / <alpha-value>)",
          soft: "rgb(var(--primario) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "#FFC107", // dorado de los iconos activos de NOVA
          soft: "#FFE082",
          light: "#FFF8E1",
        },
        accent: {
          DEFAULT: "#E8740E", // naranja de las etiquetas de NOVA
          light: "#FFF3E0",
        },
        teal: {
          DEFAULT: "#1E9E9A", // turquesa de la esfera del escudo
          dark: "#0E625F",
          light: "#E3F5F4",
        },
        cream: "#F3EDE1", // crema de la portada de NOVA
        cyan: { DEFAULT: "#FFC107", dark: "#8C6A10", light: "#FFF8E1" },
        ink: {
          900: "#1E3A5F", // texto, el mismo marino de NOVA
          600: "#2C3E50",
          500: "#6B7A8D", // texto secundario de NOVA
        },
        // Grises neutros con un leve tinte frio (bordes, fondos suaves).
        gray: {
          50: "#FAFAFA",
          100: "#F3F3F6",
          200: "#E8E8EC", // bordes
          300: "#D6D6DE",
          400: "#73737E", // texto atenuado (contraste AA sobre blanco)
          500: "#6B6B76",
          600: "#4A4B57",
          700: "#34353F",
          800: "#1F2029",
          900: "#0E1222",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["General Sans", "DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      // Radios del sistema: 6 px botones y campos, 8 px paneles, 12 px tarjetas.
      borderRadius: {
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "12px",
        "3xl": "12px",
      },
      boxShadow: {
        tarjeta: "0 8px 30px rgba(14, 18, 34, 0.08)",
        primario: "0 4px 12px rgba(30, 58, 95, 0.35)",
      },
      keyframes: {
        flota: {
          "0%, 100%": { transform: "translateY(0) rotate(-6deg)" },
          "50%": { transform: "translateY(-8px) rotate(-6deg)" },
        },
        // Aurora del inicio: manchas de luz que se desplazan despacio.
        "deriva-a": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(90px, 40px) scale(1.15)" },
        },
        "deriva-b": {
          "0%, 100%": { transform: "translate(0, 0) scale(1.1)" },
          "50%": { transform: "translate(-120px, 60px) scale(0.9)" },
        },
        "deriva-c": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(60px, -50px)" },
        },
        brillo: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "0.9" },
        },
        // Entrada del inicio: cada bloque aparece y sube 8 px (con reducir
        // movimiento, solo el fundido).
        aparecer: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        "aparecer-suave": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Barras que crecen desde la izquierda hasta su valor.
        "crecer-x": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        // Trazo de un anillo SVG: desde --desde (oculto) hasta su valor.
        trazo: {
          from: { strokeDashoffset: "var(--desde)" },
          to: { strokeDashoffset: "0" },
        },
      },
      transitionTimingFunction: {
        salida: "cubic-bezier(0.23, 1, 0.32, 1)",
      },
      animation: {
        flota: "flota 4s ease-in-out infinite",
        "deriva-a": "deriva-a 18s ease-in-out infinite",
        "deriva-b": "deriva-b 22s ease-in-out infinite",
        "deriva-c": "deriva-c 16s ease-in-out infinite",
        brillo: "brillo 6s ease-in-out infinite",
        aparecer: "aparecer 260ms cubic-bezier(0.23, 1, 0.32, 1) both",
        "aparecer-suave": "aparecer-suave 200ms ease both",
        "crecer-x": "crecer-x 450ms cubic-bezier(0.23, 1, 0.32, 1) both",
        trazo: "trazo 600ms cubic-bezier(0.23, 1, 0.32, 1) both",
      },
    },
  },
  plugins: [],
};
