-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailDeadlineReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailPoolCompletions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailPoolInvitations" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailResultNotifications" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "emailWelcomeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailPoolInvitationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailDeadlineReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailResultPublishedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailPoolCompletedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
