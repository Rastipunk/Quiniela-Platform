-- AlterTable
ALTER TABLE "Pool" ADD COLUMN "muteReminders" BOOLEAN NOT NULL DEFAULT false;

-- Set muteReminders for historically excluded pools
UPDATE "Pool" SET "muteReminders" = true WHERE "id" IN (
  '3e22e016-6311-45df-a977-99b7d675ea61',
  '359e27cd-2f87-49ff-839f-457e039ec3ef',
  '05346b84-04fd-4ece-a831-f1514ccba279'
);
