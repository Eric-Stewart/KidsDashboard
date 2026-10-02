-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ChildCode" AS ENUM ('E', 'A');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('GENESIS', 'GOOGLE_CLASSROOM');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('UPCOMING', 'DUE_SOON', 'SUBMITTED', 'GRADED', 'MISSING', 'LATE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('ASSIGNMENT', 'TEST', 'PROJECT');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Child" (
    "id" "ChildCode" NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "childId" "ChildCode" NOT NULL,
    "name" TEXT NOT NULL,
    "teacherName" TEXT,
    "source" "Source" NOT NULL,
    "externalId" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "childId" "ChildCode" NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "dueDateOnly" BOOLEAN NOT NULL DEFAULT false,
    "type" "AssignmentType" NOT NULL DEFAULT 'ASSIGNMENT',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "pointsEarned" DECIMAL(10,3),
    "pointsPossible" DECIMAL(10,3),
    "grade" DECIMAL(7,3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSource" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "childId" "ChildCode" NOT NULL,
    "source" "Source" NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "raw" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRevision" (
    "id" TEXT NOT NULL,
    "assignmentSourceId" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentHistory" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AssignmentStatus" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "dueDateOnly" BOOLEAN NOT NULL DEFAULT false,
    "assignedDate" TIMESTAMP(3),
    "type" "AssignmentType" NOT NULL,
    "pointsEarned" DECIMAL(10,3),
    "pointsPossible" DECIMAL(10,3),
    "grade" DECIMAL(7,3),
    "fingerprint" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGrade" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "grade" TEXT,
    "percentage" DECIMAL(7,3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGradeSnapshot" (
    "id" TEXT NOT NULL,
    "courseGradeId" TEXT NOT NULL,
    "grade" TEXT,
    "percentage" DECIMAL(7,3),
    "syncRunId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseGradeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LunchBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "childId" "ChildCode" NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LunchBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthConnection" (
    "id" TEXT NOT NULL,
    "childId" "ChildCode" NOT NULL,
    "provider" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "scopes" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "childId" "ChildCode",
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "recordsRetrieved" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "snapshotChanges" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationDecision" (
    "id" TEXT NOT NULL,
    "leftSourceId" TEXT NOT NULL,
    "rightSourceId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Course_childId_schoolYear_idx" ON "Course"("childId", "schoolYear");

-- CreateIndex
CREATE UNIQUE INDEX "Course_childId_source_externalId_schoolYear_key" ON "Course"("childId", "source", "externalId", "schoolYear");

-- CreateIndex
CREATE UNIQUE INDEX "Course_id_childId_key" ON "Course"("id", "childId");

-- CreateIndex
CREATE INDEX "Assignment_childId_dueDate_idx" ON "Assignment"("childId", "dueDate");

-- CreateIndex
CREATE INDEX "Assignment_status_dueDate_idx" ON "Assignment"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Assignment_courseId_idx" ON "Assignment"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_id_childId_key" ON "Assignment"("id", "childId");

-- CreateIndex
CREATE INDEX "AssignmentSource_assignmentId_idx" ON "AssignmentSource"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSource_childId_source_externalId_key" ON "AssignmentSource"("childId", "source", "externalId");

-- CreateIndex
CREATE INDEX "SourceRevision_assignmentSourceId_observedAt_idx" ON "SourceRevision"("assignmentSourceId", "observedAt");

-- CreateIndex
CREATE INDEX "AssignmentHistory_assignmentId_observedAt_idx" ON "AssignmentHistory"("assignmentId", "observedAt");

-- CreateIndex
CREATE INDEX "AssignmentHistory_syncRunId_idx" ON "AssignmentHistory"("syncRunId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentHistory_assignmentId_syncRunId_key" ON "AssignmentHistory"("assignmentId", "syncRunId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGrade_courseId_period_key" ON "CourseGrade"("courseId", "period");

-- CreateIndex
CREATE INDEX "CourseGradeSnapshot_courseGradeId_observedAt_idx" ON "CourseGradeSnapshot"("courseGradeId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGradeSnapshot_courseGradeId_syncRunId_key" ON "CourseGradeSnapshot"("courseGradeId", "syncRunId");

-- CreateIndex
CREATE INDEX "LunchBalanceSnapshot_childId_observedAt_idx" ON "LunchBalanceSnapshot"("childId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LunchBalanceSnapshot_childId_syncRunId_key" ON "LunchBalanceSnapshot"("childId", "syncRunId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConnection_childId_provider_key" ON "OAuthConnection"("childId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConnection_provider_accountId_key" ON "OAuthConnection"("provider", "accountId");

-- CreateIndex
CREATE INDEX "SyncRun_dataSourceId_startedAt_idx" ON "SyncRun"("dataSourceId", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_status_startedAt_idx" ON "SyncRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "ReconciliationDecision_leftSourceId_rightSourceId_idx" ON "ReconciliationDecision"("leftSourceId", "rightSourceId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_childId_fkey" FOREIGN KEY ("courseId", "childId") REFERENCES "Course"("id", "childId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSource" ADD CONSTRAINT "AssignmentSource_assignmentId_childId_fkey" FOREIGN KEY ("assignmentId", "childId") REFERENCES "Assignment"("id", "childId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRevision" ADD CONSTRAINT "SourceRevision_assignmentSourceId_fkey" FOREIGN KEY ("assignmentSourceId") REFERENCES "AssignmentSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGrade" ADD CONSTRAINT "CourseGrade_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGradeSnapshot" ADD CONSTRAINT "CourseGradeSnapshot_courseGradeId_fkey" FOREIGN KEY ("courseGradeId") REFERENCES "CourseGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGradeSnapshot" ADD CONSTRAINT "CourseGradeSnapshot_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchBalanceSnapshot" ADD CONSTRAINT "LunchBalanceSnapshot_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LunchBalanceSnapshot" ADD CONSTRAINT "LunchBalanceSnapshot_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConnection" ADD CONSTRAINT "OAuthConnection_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
