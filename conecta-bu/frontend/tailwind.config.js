/** @type {import('tailwindcss').Config} */
// Paleta institucional con el estilo "Genesis" (editorial y sobria): el azul
// del escudo de la Uniautonoma para lo interactivo (botones, enlaces, foco,
// estado activo), el dorado del escudo solo para la marca y el turquesa de la
// esfera como acento de Salud y de los graficos. Fondo gris muy claro,
// superficies blancas y bordes sutiles. Los nombres (primary, gold, cream,
// ink...) se mantienen para que todas las pantallas tomen la paleta.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1D4E9E", // azul del escudo: CTA, enlaces, estado activo
          hover: "#173F82",
          dark: "#0B2347", // azul noche: titulares y bandas
          light: "#EBF1FA",
          soft: "#1D4E9E",
        },
        gold: {
          DEFAULT: "#C9A23F", // dorado metalico del escudo (marca)
          soft: "#EAD8A2",
          light: "#F8F2E1",
        },
        accent: {
          DEFAULT: "#8A6410", // dorado oscuro para textos (contraste AA)
          light: "#F8F2E1",
        },
        teal: {
          DEFAULT: "#1E9E9A", // turquesa de la esfera del escudo
          dark: "#0E625F",
          light: "#E3F5F4",
        },
        cream: "#FAFAFA", // fondo de la pagina
        cyan: { DEFAULT: "#7FE8FF", dark: "#0E5F73", light: "#E4FAFF" },
        ink: {
          900: "#0E1222", // texto principal (casi negro)
          600: "#4A4B57",
          500: "#6B6B76", // texto secundario
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
        primario: "0 4px 12px rgba(29, 78, 158, 0.35)",
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
