-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" VARCHAR(200),
ADD COLUMN     "country" VARCHAR(2),
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "lastUsernameChangeAt" TIMESTAMP(3);
