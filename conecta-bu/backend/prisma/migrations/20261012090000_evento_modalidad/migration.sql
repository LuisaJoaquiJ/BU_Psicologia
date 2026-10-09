-- Eventos virtuales o hibridos con enlace de reunion.
ALTER TABLE "eventos" ADD COLUMN "modalidad" VARCHAR(20) NOT NULL DEFAULT 'Presencial';
ALTER TABLE "eventos" ADD COLUMN "enlaceReunion" VARCHAR(500);
