/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1f5c90",
          dark: "#17436b",
          light: "#eaf2fa",
        },
        accent: {
          DEFAULT: "#2fb39a",
          light: "#e3f7f2",
        },
        ink: {
          900: "#2b2b2b",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
