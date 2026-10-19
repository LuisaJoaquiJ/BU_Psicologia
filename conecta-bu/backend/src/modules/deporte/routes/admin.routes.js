const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../../common/middlewares/roles.middleware");
const { manejar } = require("./manejar");
const coordinacion = require("../controllers/CoordinacionController");
const grupos = require("../controllers/GrupoController");
const estudiantes = require("../controllers/EstudianteController");
const docentes = require("../controllers/DocenteController");
const eventos = require("../controllers/EventoController");
const inventario = require("../controllers/InventarioController");
const imagenes = require("../controllers/ImagenController");
const imagenService = require("../services/ImagenService");

// /api/v1/deporte/admin: personal del modulo Deporte (coordinacion).
const admin = Router();
admin.use(authMiddleware, requireModulo("deporte"));

// Inicio, tablero (?periodo=semana|mes|trimestre|anio), catalogos y disciplinas.
admin.get("/resumen", manejar(coordinacion.resumen));
admin.get("/tablero", manejar(coordinacion.tablero));
admin.get("/catalogos", manejar(coordinacion.catalogos));
admin.put("/config", manejar(coordinacion.guardarConfig));
admin.post("/disciplinas", manejar(coordinacion.crearDisciplina));
admin.patch("/disciplinas/:id", manejar(coordinacion.actualizarDisciplina));

// Grupos, inscritos y asistencia.
admin.get("/grupos", manejar(grupos.listar));
admin.post("/grupos", manejar(grupos.crear));
admin.get("/grupos/:id", manejar(grupos.detalle));
admin.patch("/grupos/:id", manejar(grupos.actualizar));
admin.post("/grupos/:id/inscritos", manejar(grupos.inscribir));
admin.delete("/grupos/:id/inscritos/:usuarioId", manejar(grupos.retirar));
admin.post("/grupos/:id/sesiones", manejar(grupos.registrarSesion));
admin.put("/sesiones/:id", manejar(grupos.actualizarSesion));
admin.delete("/sesiones/:id", manejar(grupos.eliminarSesion));
admin.get("/reporte", manejar(grupos.reporte));

// Estudiantes y horas.
admin.get("/estudiantes", manejar(estudiantes.listar));
admin.get("/estudiantes/:id", manejar(estudiantes.detalle));
admin.get("/estudiantes/:id/constancia", manejar(estudiantes.constancia));
admin.post("/estudiantes/:id/horas", manejar(estudiantes.reconocerHoras));
admin.put("/estudiantes/:id/categoria", manejar(estudiantes.categoria));
admin.delete("/horas/:id", manejar(estudiantes.eliminarHoras));

// Docentes (RF-004, RF-007).
admin.get("/docentes", manejar(docentes.listar));
admin.post("/docentes", manejar(docentes.crear));
admin.post("/docentes/csv", manejar(docentes.cargarCsv));
admin.patch("/docentes/:id", manejar(docentes.actualizar));

// Eventos deportivos (RF-002) y comunicados (RF-011).
admin.get("/eventos", manejar(eventos.listar));
admin.post("/eventos", manejar(eventos.crear));
admin.get("/eventos/:id", manejar(eventos.detalle));
admin.patch("/eventos/:id", manejar(eventos.actualizar));
admin.put("/eventos/:id/asistencia", manejar(eventos.asistencia));
admin.get("/alertas", manejar(eventos.listarAlertas));
admin.post("/alertas", manejar(eventos.crearAlerta));
admin.delete("/alertas/:id", manejar(eventos.eliminarAlerta));

// Inventario de implementos.
admin.get("/inventario", manejar(inventario.listar));
admin.get("/inventario/reporte", manejar(inventario.reporte));
admin.post("/inventario", manejar(inventario.crear));
admin.get("/inventario/:id", manejar(inventario.detalle));
admin.patch("/inventario/:id", manejar(inventario.actualizar));
admin.post("/inventario/:id/movimientos", manejar(inventario.ajustar));
admin.post("/inventario/:id/prestamos", manejar(inventario.prestar));
admin.post("/prestamos/:id/devolucion", manejar(inventario.devolver));

// Fotos (JPG, PNG o WEBP, hasta 5 MB): campo "imagen" en multipart.
for (const [ruta, tipo] of [["eventos", "eventos"], ["disciplinas", "disciplinas"], ["inventario", "implementos"], ["alertas", "alertas"]]) {
  admin.post(`/${ruta}/:id/imagen`, imagenService.recibirImagen(tipo), manejar(imagenes.subir(tipo)));
  admin.delete(`/${ruta}/:id/imagen`, manejar(imagenes.quitar(tipo)));
}

module.exports = admin;
