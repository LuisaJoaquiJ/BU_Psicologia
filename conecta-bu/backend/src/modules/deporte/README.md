# Módulo Deporte (backend)

Organizado por capas, con clases. Ningún archivo pasa de 300 líneas.

```
deporte/
├── index.js          Routers que monta app.js
├── routes/           Rutas de Express (solo conectan URL → controlador)
│   ├── estudiante.routes.js   /api/v1/deporte
│   ├── admin.routes.js        /api/v1/deporte/admin
│   ├── docente.routes.js      /api/v1/deporte/docente
│   └── imagenes.routes.js     /api/v1/deporte/imagenes
├── controllers/      Clases que leen la petición y responden (BaseController)
├── services/         Clases con las reglas del negocio (una por tema)
├── repositories/     Clases de acceso a datos con Prisma (BaseRepository)
├── archivos/         Clases que generan el PDF y los Excel
└── utils/            Funciones puras: horarios, periodos, categorías, formato
```

Flujo de una petición:

```
ruta → controlador → servicio → repositorio → Prisma (PostgreSQL)
```

- **Controlador:** toma `req` (parámetros, cuerpo, usuario) y responde con `res`.
- **Servicio:** valida y aplica las reglas (cupos, cruces de horario, ventana de asistencia…).
- **Repositorio:** única capa que habla con Prisma.

Cada servicio se exporta como una sola instancia (`module.exports = new GrupoService()`).
