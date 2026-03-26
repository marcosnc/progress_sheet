-- CreateTable
CREATE TABLE "Dimension" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Dimension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dimension_tenantId_key_key" ON "Dimension"("tenantId", "key");
CREATE INDEX "Dimension_tenantId_idx" ON "Dimension"("tenantId");

-- AddForeignKey
ALTER TABLE "Dimension" ADD CONSTRAINT "Dimension_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
