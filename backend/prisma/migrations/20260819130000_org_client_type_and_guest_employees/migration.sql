-- AlterEnum
CREATE TYPE "OrganizationClientType" AS ENUM ('B2B', 'B2C');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "clientType" "OrganizationClientType" NOT NULL DEFAULT 'B2B';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- One guest phone number per organization (B2C walk-in identity).
CREATE UNIQUE INDEX IF NOT EXISTS employees_guest_phone_per_org
ON "employees" ("organizationId", "phone")
WHERE "isGuest" = true AND "phone" IS NOT NULL;
