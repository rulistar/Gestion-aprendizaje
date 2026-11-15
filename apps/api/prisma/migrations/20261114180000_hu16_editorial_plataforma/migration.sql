-- AlterTable
-- HU-16: marca de editorial en los valores del catálogo; lo que ya existe queda como plataforma
ALTER TABLE "catalog_items" ADD COLUMN     "is_publisher" BOOLEAN NOT NULL DEFAULT false;
