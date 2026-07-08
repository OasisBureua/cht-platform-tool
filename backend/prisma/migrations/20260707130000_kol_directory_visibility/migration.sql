-- KOL directory visibility overlay (public site vs in-app CHM Docs)
CREATE TABLE "kol_directory_visibility" (
    "slug" TEXT NOT NULL,
    "visibleOnPublic" BOOLEAN NOT NULL DEFAULT true,
    "visibleOnApp" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "kol_directory_visibility_pkey" PRIMARY KEY ("slug")
);
