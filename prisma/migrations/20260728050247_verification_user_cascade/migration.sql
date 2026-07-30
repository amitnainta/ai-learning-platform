-- AlterTable
ALTER TABLE "verification" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "verification_userId_idx" ON "verification"("userId");

-- AddForeignKey
ALTER TABLE "verification" ADD CONSTRAINT "verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
