ALTER TABLE "Course" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AssignmentSource" ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AssignmentHistory" ADD COLUMN "sourceState" TEXT,
    ADD COLUMN "sourceLate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OAuthConnection" ADD COLUMN "accountEmail" TEXT;
ALTER TABLE "DataSource" ADD COLUMN "leaseToken" TEXT,
    ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
CREATE TABLE "OAuthAttempt" (
    "stateHash" TEXT NOT NULL,
    "childId" "ChildCode" NOT NULL,
    "parentHash" TEXT NOT NULL,
    "browserHash" TEXT NOT NULL,
    "encryptedVerifier" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAttempt_pkey" PRIMARY KEY ("stateHash")
);
CREATE INDEX "OAuthAttempt_expiresAt_idx" ON "OAuthAttempt"("expiresAt");
