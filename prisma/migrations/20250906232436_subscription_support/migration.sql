/*
  Warnings:

  - You are about to drop the column `isPremium` on the `Podcast` table. All the data in the column will be lost.
  - You are about to drop the column `isPremium` on the `Programme` table. All the data in the column will be lost.
  - Added the required column `podcastProductId` to the `Podcast` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requiresAccess` to the `Podcast` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pricingModel` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requiresAccess` to the `Programme` table without a default value. This is not possible if the table is not empty.
*/

-- CreateTable
CREATE TABLE "SubscriptionAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "accessItem" TEXT NOT NULL,
    CONSTRAINT "SubscriptionAccess_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "duration" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Podcast" (
    "productId" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "muxAssetId" TEXT NOT NULL,
    "muxPlaybackId" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "thumbnail" TEXT,
    "requiresAccess" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "podcastProductId" TEXT NOT NULL,
    CONSTRAINT "Podcast_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Podcast" ("createdAt", "description", "duration", "isFeatured", "isPublished", "muxAssetId", "muxPlaybackId", "productId", "title", "updatedAt") SELECT "createdAt", "description", "duration", "isFeatured", "isPublished", "muxAssetId", "muxPlaybackId", "productId", "title", "updatedAt" FROM "Podcast";
DROP TABLE "Podcast";
ALTER TABLE "new_Podcast" RENAME TO "Podcast";
CREATE UNIQUE INDEX "Podcast_productId_key" ON "Podcast"("productId");
CREATE UNIQUE INDEX "Podcast_muxAssetId_key" ON "Podcast"("muxAssetId");
CREATE UNIQUE INDEX "Podcast_muxPlaybackId_key" ON "Podcast"("muxPlaybackId");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "pricingModel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("createdAt", "id", "type", "updatedAt") SELECT "createdAt", "id", "type", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE TABLE "new_Programme" (
    "productId" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "muxAssetId" TEXT,
    "muxPlaybackId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "thumbnail" TEXT,
    "requiresAccess" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "tags" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Programme_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Programme" ("createdAt", "description", "duration", "isFeatured", "isPublished", "muxAssetId", "muxPlaybackId", "productId", "title", "updatedAt") SELECT "createdAt", "description", "duration", "isFeatured", "isPublished", "muxAssetId", "muxPlaybackId", "productId", "title", "updatedAt" FROM "Programme";
DROP TABLE "Programme";
ALTER TABLE "new_Programme" RENAME TO "Programme";
CREATE UNIQUE INDEX "Programme_productId_key" ON "Programme"("productId");
CREATE UNIQUE INDEX "Programme_muxAssetId_key" ON "Programme"("muxAssetId");
CREATE UNIQUE INDEX "Programme_muxPlaybackId_key" ON "Programme"("muxPlaybackId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
