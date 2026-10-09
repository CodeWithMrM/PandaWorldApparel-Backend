ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_cartId_productId_key";
ALTER TABLE "cart_items" ADD COLUMN "size" TEXT;
CREATE UNIQUE INDEX "cart_items_cartId_productId_size_key" ON "cart_items"("cartId", "productId", "size");

ALTER TABLE "order_items" ADD COLUMN "size" TEXT;
