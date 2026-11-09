-- AlterTable
ALTER TABLE "cultura_grupos" ADD COLUMN     "docenteEmail" VARCHAR(120),
ADD COLUMN     "monitoresEmails" JSONB NOT NULL DEFAULT '[]';

-- Quien ya tenia acceso a Cultura sin rol asignado seguia siendo administrador: se deja escrito,
-- porque desde ahora quien entra sin rol queda como monitor.
INSERT INTO "cultura_roles" ("email", "rol")
SELECT a."email", 'administrador' FROM "accesos_modulo" a
WHERE a."modulo" = 'cultura' AND NOT EXISTS (SELECT 1 FROM "cultura_roles" r WHERE r."email" = a."email")
GROUP BY a."email";
