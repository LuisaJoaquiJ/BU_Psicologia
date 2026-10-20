const { Router } = require("express");
const { manejar } = require("./manejar");
const c = require("../controllers/ImagenController");

// /api/v1/deporte/imagenes/:tipo/:id: fotos publicas (sin sesion).
const imagenes = Router();
imagenes.get("/:tipo/:id", manejar(c.servir));

module.exports = imagenes;
