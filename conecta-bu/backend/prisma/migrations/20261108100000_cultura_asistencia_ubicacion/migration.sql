-- AlterTable
ALTER TABLE "cultura_grupos" ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION,
ADD COLUMN     "radioM" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "cultura_eventos" ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION,
ADD COLUMN     "radioM" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "cultura_asistencias" ADD COLUMN     "distanciaM" INTEGER;

-- AlterTable
ALTER TABLE "cultura_eventos_inscripciones" ADD COLUMN     "distanciaM" INTEGER;
