import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { http } from "../api/http";

const AuthContext = createContext(null);

const TOKEN_KEY = "conectabu_token";

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // RF-002: al abrir la aplicacion, si hay un token guardado, se valida
  // contra GET /auth/me para saber si la sesion sigue siendo valida.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setCargando(false);
      return;
    }
    http
      .get("/auth/me")
      .then((res) => setUsuario(res.data.usuario))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = useCallback((token, usuarioAutenticado) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUsuario(usuarioAutenticado);
  }, []);

  // HU-03: cierre de sesion desde cualquier pantalla.
  const cerrarSesion = useCallback(async () => {
    try {
      await http.post("/auth/logout");
    } catch (err) {
      // Si el backend no responde, igual cerramos la sesion en el cliente.
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUsuario(null);
    }
  }, []);

  const value = {
    usuario,
    cargando,
    estaAutenticado: Boolean(usuario),
    iniciarSesion,
    cerrarSesion,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
