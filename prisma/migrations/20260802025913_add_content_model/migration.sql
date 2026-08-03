-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('ARTICLE', 'VIDEO', 'INTERACTIVE', 'COURSE', 'PAPER', 'PODCAST', 'TOOL');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('ORIGINAL', 'CURATED');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateTable
CREATE TABLE "role_profile" (
    "id" TEXT NOT NULL,
    "role" "RoleArchetype" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "path" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "roleArchetype" "RoleArchetype" NOT NULL,
    "level" "ProficiencyLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "path_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "path_course" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "path_course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_item" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "course_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_item" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "roles" "RoleArchetype"[],
    "level" "ProficiencyLevel" NOT NULL,
    "format" "ContentFormat" NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "body" TEXT,
    "videoUrl" TEXT,
    "videoCaptionsUrl" TEXT,
    "videoPosterUrl" TEXT,
    "videoDurationSeconds" INTEGER,
    "externalUrl" TEXT,
    "sourcePublisher" TEXT,
    "sourceAuthor" TEXT,
    "sourcePublishedOn" TIMESTAMP(3),
    "attributionNote" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3) NOT NULL,
    "reviewCadenceDays" INTEGER NOT NULL,
    "nextReviewDueAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_item_version" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_item_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glossary_term" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "shortDefinition" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "aliases" TEXT[],
    "relatedSlugs" TEXT[],
    "lastReviewedAt" TIMESTAMP(3) NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "glossary_term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ContentItemToTopic" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContentItemToTopic_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_profile_role_key" ON "role_profile"("role");

-- CreateIndex
CREATE UNIQUE INDEX "role_profile_slug_key" ON "role_profile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "path_slug_key" ON "path"("slug");

-- CreateIndex
CREATE INDEX "path_status_idx" ON "path"("status");

-- CreateIndex
CREATE UNIQUE INDEX "path_roleArchetype_level_key" ON "path"("roleArchetype", "level");

-- CreateIndex
CREATE UNIQUE INDEX "course_slug_key" ON "course"("slug");

-- CreateIndex
CREATE INDEX "course_status_idx" ON "course"("status");

-- CreateIndex
CREATE INDEX "path_course_pathId_position_idx" ON "path_course"("pathId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "path_course_pathId_courseId_key" ON "path_course"("pathId", "courseId");

-- CreateIndex
CREATE INDEX "course_item_courseId_position_idx" ON "course_item"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "course_item_courseId_contentItemId_key" ON "course_item"("courseId", "contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "content_item_slug_key" ON "content_item"("slug");

-- CreateIndex
CREATE INDEX "content_item_status_idx" ON "content_item"("status");

-- CreateIndex
CREATE INDEX "content_item_sourceType_idx" ON "content_item"("sourceType");

-- CreateIndex
CREATE INDEX "content_item_level_idx" ON "content_item"("level");

-- CreateIndex
CREATE INDEX "content_item_nextReviewDueAt_idx" ON "content_item"("nextReviewDueAt");

-- CreateIndex
CREATE INDEX "content_item_version_contentItemId_idx" ON "content_item_version"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "content_item_version_contentItemId_version_key" ON "content_item_version"("contentItemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "topic_slug_key" ON "topic"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "glossary_term_slug_key" ON "glossary_term"("slug");

-- CreateIndex
CREATE INDEX "glossary_term_term_idx" ON "glossary_term"("term");

-- CreateIndex
CREATE INDEX "_ContentItemToTopic_B_index" ON "_ContentItemToTopic"("B");

-- AddForeignKey
ALTER TABLE "path_course" ADD CONSTRAINT "path_course_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "path"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_course" ADD CONSTRAINT "path_course_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_item" ADD CONSTRAINT "course_item_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_item" ADD CONSTRAINT "course_item_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_version" ADD CONSTRAINT "content_item_version_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContentItemToTopic" ADD CONSTRAINT "_ContentItemToTopic_A_fkey" FOREIGN KEY ("A") REFERENCES "content_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContentItemToTopic" ADD CONSTRAINT "_ContentItemToTopic_B_fkey" FOREIGN KEY ("B") REFERENCES "topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
