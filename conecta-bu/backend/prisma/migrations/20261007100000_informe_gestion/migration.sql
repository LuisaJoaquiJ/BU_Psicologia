-- Informe de gestion (INFBI-002) que se envia al superadministrador.

-- AlterTable
ALTER TABLE "salud_actividades" ADD COLUMN     "pendientes" TEXT;

-- CreateEnum
CREATE TYPE "EstadoInformeGestion" AS ENUM ('Borrador', 'Enviado', 'Devuelto', 'Aprobado');

-- CreateTable
CREATE TABLE "informes_gestion" (
    "id" TEXT NOT NULL,
    "modulo" VARCHAR(40) NOT NULL DEFAULT 'salud',
    "periodo" VARCHAR(10) NOT NULL,
    "fechaPresentacion" DATE,
    "responsable" VARCHAR(200),
    "accionMejora" BOOLEAN NOT NULL DEFAULT true,
    "accionCorrectiva" BOOLEAN NOT NULL DEFAULT true,
    "accionPreventiva" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,
    "justificacion" TEXT,
    "alineacion" TEXT,
    "objetivos" JSONB,
    "logros" TEXT,
    "dificultades" TEXT,
    "accionesMejora" TEXT,
    "estado" "EstadoInformeGestion" NOT NULL DEFAULT 'Borrador',
    "version" INTEGER NOT NULL DEFAULT 0,
    "enviadoPor" VARCHAR(120),
    "fechaEnvio" TIMESTAMP(3),
    "observacionRevision" TEXT,
    "revisadoPor" VARCHAR(120),
    "fechaRevision" TIMESTAMP(3),
    "datosEnviados" JSONB,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "informes_gestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salud_historicos" (
    "id" TEXT NOT NULL,
    "periodo" VARCHAR(10) NOT NULL,
    "estudiantes" INTEGER NOT NULL DEFAULT 0,
    "docentes" INTEGER NOT NULL DEFAULT 0,
    "administrativos" INTEGER NOT NULL DEFAULT 0,
    "externos" INTEGER NOT NULL DEFAULT 0,
    "egresados" INTEGER NOT NULL DEFAULT 0,
    "enfermeria" INTEGER,
    "poblacionGeneral" INTEGER,

    CONSTRAINT "salud_historicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "informes_gestion_modulo_periodo_key" ON "informes_gestion"("modulo", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "salud_historicos_periodo_key" ON "salud_historicos"("periodo");

-- Cifras historicas del informe de gestion (hoja "ESTADISTICAS POBLACION ATENDIDA").
INSERT INTO "salud_historicos" ("id", "periodo", "estudiantes", "docentes", "administrativos", "externos", "egresados", "enfermeria", "poblacionGeneral") VALUES
(gen_random_uuid()::text, '2014', 1153, 24, 105, 0, 0, NULL, NULL),
(gen_random_uuid()::text, '2015', 626, 0, 6, 0, 0, 655, NULL),
(gen_random_uuid()::text, '2016', 2440, 11, 260, 0, 0, 2625, NULL),
(gen_random_uuid()::text, '2017', 1879, 34, 342, 0, 0, 1748, NULL),
(gen_random_uuid()::text, '2018', 1652, 71, 986, 0, 0, 388, 2420),
(gen_random_uuid()::text, '2019', 2462, 67, 1372, 56, 0, 3031, 3553),
(gen_random_uuid()::text, '2020', 4441, 4536, 6136, 339, 0, 311, 1545),
(gen_random_uuid()::text, '2021', 2884, 3903, 14832, 1430, 0, 1091, 2322),
(gen_random_uuid()::text, '2022', 2830, 2130, 9633, 550, 0, 1345, 2367),
(gen_random_uuid()::text, '2023', 4656, 325, 2278, 172, 3, 1422, 7422),
(gen_random_uuid()::text, '2024', 2324, 581, 1436, 90, 3, 1514, 4434),
(gen_random_uuid()::text, '2025', 3385, 990, 1232, 6, 1, 779, 5614)
ON CONFLICT ("periodo") DO NOTHING;
