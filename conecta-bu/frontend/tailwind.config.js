/** @type {import('tailwindcss').Config} */
// Paleta "Campus" (propuesta B): el azul del logo de la Uniautónoma, un azul
// noche para encabezados y el cian del lema "Somos el motor de la innovación",
// sobre un fondo gris azulado claro. El dorado de la bandera queda para detalles.
// Los nombres "primary" y "accent" se mantienen para que las pantallas
// existentes tomen la nueva paleta sin reescribirlas una por una.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#19407B", // azul del logo institucional
          dark: "#0B2347", // azul noche: encabezados y fondos
          light: "#E6EEFA",
          soft: "#1F4E94",
        },
        gold: {
          DEFAULT: "#E8B23A", // botones y detalles
          soft: "#F7DF9E", // resaltado de titulares
          light: "#FBF3E0",
        },
        accent: {
          DEFAULT: "#9A6B07", // dorado oscuro para textos (contraste AA)
          light: "#FBF3E0",
        },
        cream: "#F3F6FB", // fondo general
        cyan: { DEFAULT: "#7FE8FF", dark: "#0E5F73", light: "#E4FAFF" }, // lema institucional (solo sobre azul o como fondo)
        ink: {
          900: "#0E1726",
          600: "#3D4659",
          500: "#5B6478",
        },
        // Grises azulados para bordes y fondos suaves (propuesta B).
        gray: {
          50: "#F7F9FC",
          100: "#EEF2F7",
          200: "#E3E8F0",
          // Los tonos de texto siguen la tinta de la marca (azul grisáceo) en
          // lugar del gris frío por defecto de Tailwind: mejor contraste sobre
          // el marfil y el mismo tono en todas las pantallas.
          300: "#D3DBE8",
          400: "#6B7385",
          500: "#5B6478",
          600: "#3D4659",
          700: "#2D3547",
          800: "#1D2434",
          900: "#0E1726",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        flota: {
          "0%, 100%": { transform: "translateY(0) rotate(-6deg)" },
          "50%": { transform: "translateY(-8px) rotate(-6deg)" },
        },
      },
      animation: {
        flota: "flota 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
