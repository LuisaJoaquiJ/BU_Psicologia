-- AlterTable
ALTER TABLE "cultura_postulaciones" ADD COLUMN     "audicionFecha" DATE,
ADD COLUMN     "audicionHora" VARCHAR(5),
ADD COLUMN     "audicionLugar" VARCHAR(120),
ADD COLUMN     "observacion" VARCHAR(300);
