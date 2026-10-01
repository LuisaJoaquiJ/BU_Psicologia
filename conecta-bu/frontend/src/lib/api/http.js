import axios from "axios";

// Si VITE_API_URL no esta definida, usamos el proxy de Vite (/api/v1) que
// vite.config.js ya reenvia al backend en desarrollo.
const baseURL = import.meta.env.VITE_API_URL || "/api/v1";

export const http = axios.create({ baseURL });

// Adjunta el JWT guardado en localStorage a cada peticion.
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("conectabu_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const EVENTO_SESION_EXPIRADA = "conectabu:sesion-expirada";

// Si el backend responde 401 (sesion invalida o expirada), limpiamos la sesion local
// y avisamos a AuthContext para que la interfaz vuelva al login sin recargar.
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("conectabu_token")) {
      localStorage.removeItem("conectabu_token");
      window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
    }
    return Promise.reject(error);
  }
);
