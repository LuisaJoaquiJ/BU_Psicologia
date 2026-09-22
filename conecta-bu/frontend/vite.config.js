import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El proxy evita configurar CORS en desarrollo: el navegador le habla a
// http://localhost:5173/api/... y Vite lo reenvia al backend en el puerto 4000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
