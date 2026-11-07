-- CreateEnum
CREATE TYPE "catalog_kind" AS ENUM ('PLATFORM', 'SPONSOR', 'CATEGORY', 'LEVEL', 'ACTIVITY_TYPE');

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "kind" "catalog_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_items_workspace_id_kind_idx" ON "catalog_items"("workspace_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_items_workspace_kind_name_active_key" ON "catalog_items"("workspace_id", "kind", "name") WHERE ("archived_at" IS NULL);

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Valores iniciales para los espacios que ya existían (los nuevos los reciben al crearse).
-- gen_random_uuid() es v4: PostgreSQL 17 no genera v7. Estas filas se ordenan por "position".
INSERT INTO "catalog_items" ("id", "workspace_id", "kind", "name", "position", "updated_at")
SELECT gen_random_uuid(), w."id", v."kind"::"catalog_kind", v."name", v."position", CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES
  ('LEVEL', 'Básico', 0),
  ('LEVEL', 'Intermedio', 1),
  ('LEVEL', 'Avanzado', 2),
  ('ACTIVITY_TYPE', 'Video o lección', 0),
  ('ACTIVITY_TYPE', 'Lectura', 1),
  ('ACTIVITY_TYPE', 'Ejercicio', 2),
  ('ACTIVITY_TYPE', 'Quiz', 3),
  ('ACTIVITY_TYPE', 'Proyecto', 4),
  ('ACTIVITY_TYPE', 'Examen', 5)
) AS v("kind", "name", "position");
