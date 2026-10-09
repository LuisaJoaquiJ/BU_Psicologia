/** @type {import('tailwindcss').Config} */
// Paleta del rediseño (Claude Design): azul institucional + dorado sobre fondo marfil.
// Los nombres "primary" y "accent" se mantienen para que las pantallas
// existentes tomen la nueva paleta sin reescribirlas una por una.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0B2A5B", // azul marino institucional
          dark: "#071D40",
          light: "#EEF2FA",
          soft: "#163F86",
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
        cream: "#FBF7EE", // fondo general
        ink: {
          900: "#0E1726",
          600: "#3D4659",
          500: "#5B6478",
        },
        // Grises cálidos para bordes y fondos suaves sobre el marfil.
        gray: {
          50: "#F7F2E7",
          100: "#F3EDE0",
          200: "#EDE5D3",
        },
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
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
