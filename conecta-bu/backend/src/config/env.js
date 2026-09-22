require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa tu archivo .env (usa .env.example como guia).`);
  }
  return value;
}

const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  googleClientId: required("GOOGLE_CLIENT_ID"),
  allowedGoogleDomain: process.env.ALLOWED_GOOGLE_DOMAIN || "uniautonoma.edu.co",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};

module.exports = { config };
