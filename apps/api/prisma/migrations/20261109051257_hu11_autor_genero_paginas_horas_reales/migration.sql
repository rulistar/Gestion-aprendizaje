-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "catalog_kind" ADD VALUE 'AUTHOR';
ALTER TYPE "catalog_kind" ADD VALUE 'GENRE';

-- AlterTable
ALTER TABLE "element_nodes" ADD COLUMN     "actual_hours" DECIMAL(8,2),
ADD COLUMN     "author_id" UUID,
ADD COLUMN     "genre_id" UUID,
ADD COLUMN     "pages" INTEGER;

-- AlterTable
ALTER TABLE "elements" ADD COLUMN     "actual_hours" DECIMAL(8,2),
ADD COLUMN     "author_id" UUID,
ADD COLUMN     "genre_id" UUID,
ADD COLUMN     "pages" INTEGER;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_nodes" ADD CONSTRAINT "element_nodes_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "catalog_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
