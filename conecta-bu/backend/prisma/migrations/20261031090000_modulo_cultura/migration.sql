-- Arte y Cultura: grupos del periodo, agenda y convocatorias.

CREATE TABLE "cultura_areas" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "cultura_areas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cultura_areas_nombre_key" ON "cultura_areas"("nombre");

CREATE TABLE "cultura_grupos" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "periodo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "director" VARCHAR(150),
    "lugar" VARCHAR(150),
    "cupo" INTEGER NOT NULL DEFAULT 20,
    "horario" JSONB NOT NULL,
    "inscripcionesAbiertas" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cultura_grupos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cultura_grupos_periodo_idx" ON "cultura_grupos"("periodo");

CREATE TABLE "cultura_inscripciones" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Activa',
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRetiro" TIMESTAMP(3),
    CONSTRAINT "cultura_inscripciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cultura_inscripciones_grupoId_usuarioId_key" ON "cultura_inscripciones"("grupoId", "usuarioId");
CREATE INDEX "cultura_inscripciones_usuarioId_idx" ON "cultura_inscripciones"("usuarioId");

CREATE TABLE "cultura_sesiones" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "registradaPor" VARCHAR(120),
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cultura_sesiones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cultura_sesiones_grupoId_fecha_key" ON "cultura_sesiones"("grupoId", "fecha");

CREATE TABLE "cultura_asistencias" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "cultura_asistencias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cultura_asistencias_sesionId_usuarioId_key" ON "cultura_asistencias"("sesionId", "usuarioId");

CREATE TABLE "cultura_eventos" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "fecha" DATE NOT NULL,
    "horaInicio" VARCHAR(5) NOT NULL,
    "horaFin" VARCHAR(5) NOT NULL,
    "lugar" VARCHAR(150),
    "cupo" INTEGER NOT NULL,
    "fechaLimite" DATE NOT NULL,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Borrador',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cultura_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cultura_eventos_fecha_idx" ON "cultura_eventos"("fecha");

CREATE TABLE "cultura_eventos_inscripciones" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Activa',
    "asistio" BOOLEAN,
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cultura_eventos_inscripciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cultura_eventos_inscripciones_eventoId_usuarioId_key" ON "cultura_eventos_inscripciones"("eventoId", "usuarioId");
CREATE INDEX "cultura_eventos_inscripciones_usuarioId_idx" ON "cultura_eventos_inscripciones"("usuarioId");

CREATE TABLE "cultura_convocatorias" (
    "id" TEXT NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "cierra" DATE NOT NULL,
    "cupo" INTEGER,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Abierta',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cultura_convocatorias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cultura_postulaciones" (
    "id" TEXT NOT NULL,
    "convocatoriaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "motivacion" TEXT NOT NULL,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Recibida',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cultura_postulaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cultura_postulaciones_convocatoriaId_usuarioId_key" ON "cultura_postulaciones"("convocatoriaId", "usuarioId");
CREATE INDEX "cultura_postulaciones_usuarioId_idx" ON "cultura_postulaciones"("usuarioId");

ALTER TABLE "cultura_grupos" ADD CONSTRAINT "cultura_grupos_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "cultura_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cultura_inscripciones" ADD CONSTRAINT "cultura_inscripciones_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "cultura_grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cultura_inscripciones" ADD CONSTRAINT "cultura_inscripciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cultura_sesiones" ADD CONSTRAINT "cultura_sesiones_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "cultura_grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cultura_asistencias" ADD CONSTRAINT "cultura_asistencias_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "cultura_sesiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cultura_asistencias" ADD CONSTRAINT "cultura_asistencias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cultura_eventos_inscripciones" ADD CONSTRAINT "cultura_eventos_inscripciones_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "cultura_eventos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cultura_eventos_inscripciones" ADD CONSTRAINT "cultura_eventos_inscripciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cultura_postulaciones" ADD CONSTRAINT "cultura_postulaciones_convocatoriaId_fkey" FOREIGN KEY ("convocatoriaId") REFERENCES "cultura_convocatorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cultura_postulaciones" ADD CONSTRAINT "cultura_postulaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "cultura_areas" ("id", "nombre", "descripcion", "activa") VALUES
    ('c0a10000-0000-4000-8000-000000000001', 'Danza', 'Grupos de danza folclórica y contemporánea.', true),
    ('c0a10000-0000-4000-8000-000000000002', 'Música', 'Coro, ensambles y práctica instrumental.', true),
    ('c0a10000-0000-4000-8000-000000000003', 'Teatro', 'Montajes y club de teatro.', true),
    ('c0a10000-0000-4000-8000-000000000004', 'Artes visuales', 'Dibujo, pintura y exposiciones.', true);
