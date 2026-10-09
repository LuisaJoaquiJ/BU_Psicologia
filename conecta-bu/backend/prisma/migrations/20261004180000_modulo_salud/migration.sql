-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'TI', 'CE', 'PA', 'RC', 'OTRO');

-- CreateEnum
CREATE TYPE "PoblacionSalud" AS ENUM ('Estudiante', 'Docente', 'Administrativo', 'Egresado', 'Externo');

-- CreateEnum
CREATE TYPE "CategoriaActividadSalud" AS ENUM ('AtencionEnfermeria', 'PromocionPrevencion', 'CampanaSalud', 'DonacionSangre', 'MedicinaLaboral', 'Otra');

-- CreateEnum
CREATE TYPE "ExamenMedicoLaboral" AS ENUM ('Ingreso', 'Egreso', 'Periodico', 'EnfasisAlturas', 'PostIncapacidad');

-- AlterTable
ALTER TABLE "servicios" ADD COLUMN     "modulo" VARCHAR(40) NOT NULL DEFAULT 'desarrollo-humano';

-- CreateTable
CREATE TABLE "salud_personas" (
    "id" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'CC',
    "numeroDocumento" VARCHAR(30) NOT NULL,
    "codigoEstudiantil" VARCHAR(30),
    "nombres" VARCHAR(120) NOT NULL,
    "apellidos" VARCHAR(120) NOT NULL,
    "telefono" VARCHAR(30),
    "correo" VARCHAR(120),
    "poblacion" "PoblacionSalud" NOT NULL DEFAULT 'Estudiante',
    "programa" VARCHAR(150),
    "consentimientoDatos" BOOLEAN NOT NULL DEFAULT false,
    "fechaConsentimiento" TIMESTAMP(3),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salud_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salud_actividades" (
    "id" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "periodo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "categoria" "CategoriaActividadSalud" NOT NULL,
    "tipoSnies" INTEGER NOT NULL DEFAULT 1,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "permanente" BOOLEAN NOT NULL DEFAULT false,
    "clinica" BOOLEAN NOT NULL DEFAULT false,
    "meta" INTEGER,
    "presupuesto" INTEGER,
    "horasDedicacion" INTEGER,
    "responsableDocumento" VARCHAR(30),
    "avances" TEXT,
    "dificultades" TEXT,
    "aprendizajes" TEXT,
    "observaciones" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salud_actividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salud_atenciones" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "poblacion" "PoblacionSalud" NOT NULL,
    "programa" VARCHAR(150),
    "examenLaboral" "ExamenMedicoLaboral",
    "insumo" VARCHAR(200),
    "tensionArterial" VARCHAR(15),
    "frecuenciaCardiaca" INTEGER,
    "frecuenciaRespiratoria" INTEGER,
    "pesoKg" DOUBLE PRECISION,
    "tallaCm" INTEGER,
    "glucometria" VARCHAR(20),
    "descripcion" TEXT,
    "remitido" BOOLEAN NOT NULL DEFAULT false,
    "origen" VARCHAR(20) NOT NULL DEFAULT 'registro',
    "registradoPorId" TEXT,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salud_atenciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salud_evidencias" (
    "id" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" VARCHAR(300),
    "nombreArchivo" VARCHAR(255) NOT NULL,
    "ruta" VARCHAR(400) NOT NULL,
    "tipoMime" VARCHAR(100) NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "subidoPorId" TEXT,
    "fechaSubida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salud_evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salud_personas_numeroDocumento_key" ON "salud_personas"("numeroDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "salud_personas_codigoEstudiantil_key" ON "salud_personas"("codigoEstudiantil");

-- CreateIndex
CREATE INDEX "salud_personas_apellidos_nombres_idx" ON "salud_personas"("apellidos", "nombres");

-- CreateIndex
CREATE UNIQUE INDEX "salud_actividades_periodo_codigo_key" ON "salud_actividades"("periodo", "codigo");

-- CreateIndex
CREATE INDEX "salud_atenciones_fecha_idx" ON "salud_atenciones"("fecha");

-- CreateIndex
CREATE INDEX "salud_atenciones_personaId_idx" ON "salud_atenciones"("personaId");

-- CreateIndex
CREATE INDEX "salud_atenciones_actividadId_idx" ON "salud_atenciones"("actividadId");

-- CreateIndex
CREATE INDEX "salud_evidencias_actividadId_idx" ON "salud_evidencias"("actividadId");

-- AddForeignKey
ALTER TABLE "salud_atenciones" ADD CONSTRAINT "salud_atenciones_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "salud_personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salud_atenciones" ADD CONSTRAINT "salud_atenciones_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "salud_actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salud_atenciones" ADD CONSTRAINT "salud_atenciones_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salud_evidencias" ADD CONSTRAINT "salud_evidencias_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "salud_actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salud_evidencias" ADD CONSTRAINT "salud_evidencias_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
