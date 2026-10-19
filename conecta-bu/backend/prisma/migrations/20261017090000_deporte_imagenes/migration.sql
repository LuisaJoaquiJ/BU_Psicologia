-- Fotos de Deporte: eventos, disciplinas, implementos y comunicados.
ALTER TABLE "deporte_disciplinas" ADD COLUMN "imagen" VARCHAR(120);
ALTER TABLE "deporte_eventos" ADD COLUMN "imagen" VARCHAR(120);
ALTER TABLE "deporte_alertas" ADD COLUMN "imagen" VARCHAR(120);
ALTER TABLE "deporte_implementos" ADD COLUMN "imagen" VARCHAR(120);
