-- AlterTable
ALTER TABLE "cultura_eventos" ADD COLUMN     "reportaSnies" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "cultura_grupos" ADD COLUMN     "fechaFin" DATE,
ADD COLUMN     "fechaInicio" DATE,
ADD COLUMN     "reportaSnies" BOOLEAN NOT NULL DEFAULT true;

