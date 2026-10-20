-- Jornadas y campanas de Salud integral publicadas para los estudiantes:
-- datos de la publicacion en la actividad e inscripciones de los estudiantes.
ALTER TABLE "salud_actividades"
    ADD COLUMN "publicada" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "descripcion" TEXT,
    ADD COLUMN "lugar" VARCHAR(200),
    ADD COLUMN "horaInicio" VARCHAR(5),
    ADD COLUMN "horaFin" VARCHAR(5),
    ADD COLUMN "cupos" INTEGER;

CREATE TABLE "salud_actividades_inscripciones" (
    "id" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Inscrita',
    "asistio" BOOLEAN NOT NULL DEFAULT false,
    "atencionId" TEXT,
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salud_actividades_inscripciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "salud_actividades_inscripciones_actividadId_usuarioId_key" ON "salud_actividades_inscripciones"("actividadId", "usuarioId");
CREATE INDEX "salud_actividades_inscripciones_usuarioId_idx" ON "salud_actividades_inscripciones"("usuarioId");

ALTER TABLE "salud_actividades_inscripciones" ADD CONSTRAINT "salud_actividades_inscripciones_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "salud_actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
