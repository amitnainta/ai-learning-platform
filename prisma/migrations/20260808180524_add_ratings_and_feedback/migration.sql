-- CreateEnum
CREATE TYPE "RatingFlagReason" AS ENUM ('INAPPROPRIATE', 'SPAM', 'OUTDATED_OR_INCORRECT', 'OTHER');

-- CreateTable
CREATE TABLE "rating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "pathId" TEXT,
    "stars" INTEGER NOT NULL,
    "feedback" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_flag" (
    "id" TEXT NOT NULL,
    "ratingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" "RatingFlagReason" NOT NULL,
    "note" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_flag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rating_courseId_idx" ON "rating"("courseId");

-- CreateIndex
CREATE INDEX "rating_pathId_idx" ON "rating"("pathId");

-- CreateIndex
CREATE UNIQUE INDEX "rating_userId_courseId_key" ON "rating"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "rating_userId_pathId_key" ON "rating"("userId", "pathId");

-- CreateIndex
CREATE INDEX "rating_flag_ratingId_idx" ON "rating_flag"("ratingId");

-- CreateIndex
CREATE INDEX "rating_flag_resolvedAt_idx" ON "rating_flag"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "rating_flag_ratingId_userId_key" ON "rating_flag"("ratingId", "userId");

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "path"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_flag" ADD CONSTRAINT "rating_flag_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "rating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_flag" ADD CONSTRAINT "rating_flag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written (decision #1, factory/work/ratings-and-feedback/PLAN.md):
-- Prisma does not model CHECK constraints, so these two lines are not
-- generated and will not be regenerated or dropped by future
-- `prisma migrate dev` runs. Carry them forward by hand if migrations are
-- ever squashed. Documented in prisma/schema.prisma's header comment for
-- `Rating` and in docs/architecture/ratings.md.
ALTER TABLE "rating" ADD CONSTRAINT "rating_exactly_one_target"
  CHECK (("courseId" IS NOT NULL) <> ("pathId" IS NOT NULL));
ALTER TABLE "rating" ADD CONSTRAINT "rating_stars_range"
  CHECK ("stars" BETWEEN 1 AND 5);
