-- Drop unique constraint that depended on key (name may vary across DBs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Dimension_tenantId_key_key'
  ) THEN
    ALTER TABLE "Dimension" DROP CONSTRAINT "Dimension_tenantId_key_key";
  END IF;
END $$;

-- Drop column
ALTER TABLE "Dimension" DROP COLUMN IF EXISTS "key";
