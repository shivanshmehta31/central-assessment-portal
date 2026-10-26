-- CreateEnum
CREATE TYPE "AssessmentMode" AS ENUM ('ONLINE', 'OFFLINE');

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "mode" "AssessmentMode" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "questionPaperFileId" TEXT;

-- AlterTable
ALTER TABLE "AttemptRecord" ADD COLUMN     "answerSheetFileId" TEXT;

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_questionPaperFileId_fkey" FOREIGN KEY ("questionPaperFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptRecord" ADD CONSTRAINT "AttemptRecord_answerSheetFileId_fkey" FOREIGN KEY ("answerSheetFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
