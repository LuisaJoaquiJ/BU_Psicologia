-- Cada modulo con su propia agenda: Salud integral deja de compartir las
-- tablas de servicios, horarios, citas y bloqueos con Desarrollo Humano.
-- 1) Se crean las tablas de Salud, 2) se copian alli los datos de Salud,
-- 3) se borran de las tablas de Desarrollo Humano y 4) estas se renombran
-- a *_desarrollo (sin la columna "modulo", que ya no hace falta).

-- 1) Tablas de Salud ---------------------------------------------------------
CREATE TYPE "EstadoCitaSalud" AS ENUM ('Agendada', 'Cancelada', 'Atendida', 'NoAsistio');

CREATE TABLE "servicios_salud" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "servicios_salud_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "horarios_salud" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horaInicio" TIME NOT NULL,
    "horaFin" TIME NOT NULL,
    "cupo" INTEGER NOT NULL DEFAULT 1,
    "ocupado" BOOLEAN NOT NULL DEFAULT false,
    "sinCita" BOOLEAN NOT NULL DEFAULT false,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "horarios_salud_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bloqueos_salud" (
    "id" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "todoElDia" BOOLEAN NOT NULL DEFAULT true,
    "horaInicio" TIME,
    "horaFin" TIME,
    "motivo" VARCHAR(60) NOT NULL,
    "detalle" VARCHAR(300),
    "creadoPor" VARCHAR(200),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bloqueos_salud_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "citas_salud" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "horarioId" TEXT NOT NULL,
    "estado" "EstadoCitaSalud" NOT NULL DEFAULT 'Agendada',
    "fechaAgendamiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "citas_salud_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asistencias_cita_salud" (
    "id" TEXT NOT NULL,
    "citaId" TEXT NOT NULL,
    "asistio" BOOLEAN NOT NULL,
    "registradoPorId" TEXT NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asistencias_cita_salud_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bloqueos_salud_fechaInicio_idx" ON "bloqueos_salud"("fechaInicio");
CREATE UNIQUE INDEX "asistencias_cita_salud_citaId_key" ON "asistencias_cita_salud"("citaId");

ALTER TABLE "horarios_salud" ADD CONSTRAINT "horarios_salud_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "servicios_salud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "citas_salud" ADD CONSTRAINT "citas_salud_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "citas_salud" ADD CONSTRAINT "citas_salud_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "horarios_salud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asistencias_cita_salud" ADD CONSTRAINT "asistencias_cita_salud_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "citas_salud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asistencias_cita_salud" ADD CONSTRAINT "asistencias_cita_salud_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Copia de los datos de Salud ---------------------------------------------
INSERT INTO "servicios_salud" ("id", "nombre", "descripcion", "activo", "fechaCreacion")
SELECT "id", "nombre", "descripcion", "activo", "fechaCreacion" FROM "servicios" WHERE "modulo" = 'salud';

INSERT INTO "horarios_salud" ("id", "servicioId", "fecha", "horaInicio", "horaFin", "cupo", "ocupado", "sinCita", "fechaCreacion")
SELECT h."id", h."servicioId", h."fecha", h."horaInicio", h."horaFin", h."cupo", h."ocupado", h."sinCita", h."fechaCreacion"
FROM "horarios" h JOIN "servicios" s ON s."id" = h."servicioId" WHERE s."modulo" = 'salud';

INSERT INTO "citas_salud" ("id", "usuarioId", "horarioId", "estado", "fechaAgendamiento", "observaciones", "fechaActualizacion")
SELECT c."id", c."usuarioId", c."horarioId", c."estado"::text::"EstadoCitaSalud", c."fechaAgendamiento", c."observaciones", c."fechaActualizacion"
FROM "citas" c JOIN "horarios_salud" h ON h."id" = c."horarioId";

INSERT INTO "asistencias_cita_salud" ("id", "citaId", "asistio", "registradoPorId", "fechaRegistro")
SELECT a."id", a."citaId", a."asistio", a."registradoPorId", a."fechaRegistro"
FROM "asistencias_cita" a JOIN "citas_salud" c ON c."id" = a."citaId";

INSERT INTO "bloqueos_salud" ("id", "fechaInicio", "fechaFin", "todoElDia", "horaInicio", "horaFin", "motivo", "detalle", "creadoPor", "fechaCreacion")
SELECT "id", "fechaInicio", "fechaFin", "todoElDia", "horaInicio", "horaFin", "motivo", "detalle", "creadoPor", "fechaCreacion"
FROM "bloqueos_agenda" WHERE "modulo" = 'salud';

-- 3) Se quitan de las tablas de Desarrollo Humano ----------------------------
UPDATE "historial_estados" SET "citaId" = NULL WHERE "citaId" IN (SELECT "id" FROM "citas_salud");
DELETE FROM "asistencias_cita" WHERE "citaId" IN (SELECT "id" FROM "citas_salud");
DELETE FROM "citas" WHERE "id" IN (SELECT "id" FROM "citas_salud");
DELETE FROM "horarios" WHERE "id" IN (SELECT "id" FROM "horarios_salud");
DELETE FROM "servicios" WHERE "modulo" <> 'desarrollo-humano';
DELETE FROM "bloqueos_agenda" WHERE "modulo" <> 'desarrollo-humano';

-- 4) Tablas de Desarrollo Humano con nombre propio ---------------------------
ALTER TABLE "servicios" DROP COLUMN "modulo";
ALTER TABLE "servicios" RENAME TO "servicios_desarrollo";
ALTER TABLE "servicios_desarrollo" RENAME CONSTRAINT "servicios_pkey" TO "servicios_desarrollo_pkey";

ALTER TABLE "horarios" RENAME TO "horarios_desarrollo";
ALTER TABLE "horarios_desarrollo" RENAME CONSTRAINT "horarios_pkey" TO "horarios_desarrollo_pkey";
ALTER TABLE "horarios_desarrollo" RENAME CONSTRAINT "horarios_servicioId_fkey" TO "horarios_desarrollo_servicioId_fkey";

ALTER TABLE "citas" RENAME TO "citas_desarrollo";
ALTER TABLE "citas_desarrollo" RENAME CONSTRAINT "citas_pkey" TO "citas_desarrollo_pkey";
ALTER TABLE "citas_desarrollo" RENAME CONSTRAINT "citas_usuarioId_fkey" TO "citas_desarrollo_usuarioId_fkey";
ALTER TABLE "citas_desarrollo" RENAME CONSTRAINT "citas_horarioId_fkey" TO "citas_desarrollo_horarioId_fkey";

ALTER TABLE "asistencias_cita" RENAME TO "asistencias_cita_desarrollo";
ALTER TABLE "asistencias_cita_desarrollo" RENAME CONSTRAINT "asistencias_cita_pkey" TO "asistencias_cita_desarrollo_pkey";
ALTER TABLE "asistencias_cita_desarrollo" RENAME CONSTRAINT "asistencias_cita_citaId_fkey" TO "asistencias_cita_desarrollo_citaId_fkey";
ALTER TABLE "asistencias_cita_desarrollo" RENAME CONSTRAINT "asistencias_cita_registradoPorId_fkey" TO "asistencias_cita_desarrollo_registradoPorId_fkey";
ALTER INDEX "asistencias_cita_citaId_key" RENAME TO "asistencias_cita_desarrollo_citaId_key";

DROP INDEX "bloqueos_agenda_modulo_fechaInicio_idx";
ALTER TABLE "bloqueos_agenda" DROP COLUMN "modulo";
ALTER TABLE "bloqueos_agenda" RENAME TO "bloqueos_desarrollo";
ALTER TABLE "bloqueos_desarrollo" RENAME CONSTRAINT "bloqueos_agenda_pkey" TO "bloqueos_desarrollo_pkey";
CREATE INDEX "bloqueos_desarrollo_fechaInicio_idx" ON "bloqueos_desarrollo"("fechaInicio");
