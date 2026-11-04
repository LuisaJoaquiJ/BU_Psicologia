-- AlterTable
ALTER TABLE "cultura_asistencias" ADD COLUMN     "origen" VARCHAR(10) NOT NULL DEFAULT 'Personal';

-- AlterTable
ALTER TABLE "cultura_eventos" ADD COLUMN     "abiertaHasta" TIMESTAMP(3),
ADD COLUMN     "codigo" VARCHAR(8),
ADD COLUMN     "conteoAdministrativos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conteoDocentes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conteoEgresados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conteoEstudiantes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "cultura_eventos_inscripciones" ADD COLUMN     "fechaAsistencia" TIMESTAMP(3),
ADD COLUMN     "ipAsistencia" VARCHAR(45);

-- AlterTable
ALTER TABLE "cultura_sesiones" ADD COLUMN     "abiertaHasta" TIMESTAMP(3),
ADD COLUMN     "codigo" VARCHAR(8),
ADD COLUMN     "conteoAdministrativos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conteoDocentes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conteoEgresados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conteoEstudiantes" INTEGER NOT NULL DEFAULT 0;

-- RenameIndex
ALTER INDEX "cultura_representacion_participantes_representacionId_usuarioId" RENAME TO "cultura_representacion_participantes_representacionId_usuar_key";

