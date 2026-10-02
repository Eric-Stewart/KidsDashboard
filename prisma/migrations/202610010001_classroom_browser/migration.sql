ALTER TYPE "Source" ADD VALUE 'google_classroom_browser';
ALTER TABLE "Course" ADD COLUMN "sourceUrl" TEXT, ADD COLUMN "lastExtractedAt" TIMESTAMP(3);
ALTER TABLE "AssignmentSource" ADD COLUMN "lastExtractedAt" TIMESTAMP(3);
ALTER TABLE "Assignment" ADD COLUMN "currentGrade" TEXT;
ALTER TABLE "AssignmentHistory" ADD COLUMN "currentGrade" TEXT;
