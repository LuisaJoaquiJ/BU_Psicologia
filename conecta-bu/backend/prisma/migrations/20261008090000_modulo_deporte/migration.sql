-- Modulo Deporte: disciplinas, grupos por periodo, inscripciones, sesiones con asistencia y horas.

-- CreateTable
CREATE TABLE "deporte_disciplinas" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" TEXT,
    "tipo" VARCHAR(30) NOT NULL DEFAULT 'Individual',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deporte_disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deporte_grupos" (
    "id" TEXT NOT NULL,
    "disciplinaId" TEXT NOT NULL,
    "periodo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "instructor" VARCHAR(150),
    "lugar" VARCHAR(150),
    "cupo" INTEGER NOT NULL DEFAULT 25,
    "horario" JSONB NOT NULL,
    "inscripcionesAbiertas" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deporte_grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deporte_inscripciones" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Activa',
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRetiro" TIMESTAMP(3),

    CONSTRAINT "deporte_inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deporte_sesiones" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "inicio" VARCHAR(5) NOT NULL,
    "fin" VARCHAR(5) NOT NULL,
    "horas" DOUBLE PRECISION NOT NULL,
    "tema" VARCHAR(200),
    "registradaPor" VARCHAR(120),
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deporte_sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deporte_asistencias" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "deporte_asistencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deporte_horas_manuales" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "disciplinaId" TEXT,
    "fecha" DATE NOT NULL,
    "horas" DOUBLE PRECISION NOT NULL,
    "motivo" VARCHAR(200) NOT NULL,
    "registradoPor" VARCHAR(120),
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deporte_horas_manuales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deporte_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "horasRequeridas" INTEGER NOT NULL DEFAULT 40,
    "maxGruposPorPeriodo" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "deporte_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deporte_disciplinas_nombre_key" ON "deporte_disciplinas"("nombre");

-- CreateIndex
CREATE INDEX "deporte_grupos_periodo_idx" ON "deporte_grupos"("periodo");

-- CreateIndex
CREATE INDEX "deporte_inscripciones_usuarioId_idx" ON "deporte_inscripciones"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "deporte_inscripciones_grupoId_usuarioId_key" ON "deporte_inscripciones"("grupoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "deporte_sesiones_grupoId_fecha_inicio_key" ON "deporte_sesiones"("grupoId", "fecha", "inicio");

-- CreateIndex
CREATE INDEX "deporte_asistencias_usuarioId_idx" ON "deporte_asistencias"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "deporte_asistencias_sesionId_usuarioId_key" ON "deporte_asistencias"("sesionId", "usuarioId");

-- CreateIndex
CREATE INDEX "deporte_horas_manuales_usuarioId_idx" ON "deporte_horas_manuales"("usuarioId");

-- AddForeignKey
ALTER TABLE "deporte_grupos" ADD CONSTRAINT "deporte_grupos_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "deporte_disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deporte_inscripciones" ADD CONSTRAINT "deporte_inscripciones_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "deporte_grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deporte_inscripciones" ADD CONSTRAINT "deporte_inscripciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deporte_sesiones" ADD CONSTRAINT "deporte_sesiones_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "deporte_grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deporte_asistencias" ADD CONSTRAINT "deporte_asistencias_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "deporte_sesiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deporte_asistencias" ADD CONSTRAINT "deporte_asistencias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deporte_horas_manuales" ADD CONSTRAINT "deporte_horas_manuales_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deporte_horas_manuales" ADD CONSTRAINT "deporte_horas_manuales_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "deporte_disciplinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Configuracion inicial: 40 horas requeridas.
INSERT INTO "deporte_config" ("id", "horasRequeridas", "maxGruposPorPeriodo") VALUES (1, 40, 2) ON CONFLICT ("id") DO NOTHING;

-- Disciplinas que oferta la Universidad (se pueden editar desde el panel).
INSERT INTO "deporte_disciplinas" ("id", "nombre", "descripcion", "tipo") VALUES
(gen_random_uuid()::text, 'Natación', 'Técnica de estilos, resistencia y seguridad en el agua.', 'Individual'),
(gen_random_uuid()::text, 'Running', 'Entrenamiento de carrera: resistencia, técnica y preparación para competencias.', 'Individual'),
(gen_random_uuid()::text, 'Voleibol', 'Fundamentos, táctica de juego y práctica en equipo.', 'Colectivo'),
(gen_random_uuid()::text, 'Fútbol', 'Fundamentos técnicos, táctica y juego en equipo.', 'Colectivo'),
(gen_random_uuid()::text, 'Ajedrez', 'Aperturas, táctica, estrategia y práctica de partidas.', 'Mental'),
(gen_random_uuid()::text, 'Baloncesto', 'Fundamentos, sistemas de juego y práctica en equipo.', 'Colectivo'),
(gen_random_uuid()::text, 'Tenis de mesa', 'Golpes básicos, saque y juego.', 'Individual')
ON CONFLICT ("nombre") DO NOTHING;
