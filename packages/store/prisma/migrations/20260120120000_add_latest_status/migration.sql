-- Create enum for uptime status
CREATE TYPE "UptimeStatus" AS ENUM ('UP', 'DOWN');

-- Latest status per website (overwrite on each check)
CREATE TABLE "WebsiteStatusLatest" (
    "websiteId" TEXT NOT NULL,
    "status" "UptimeStatus" NOT NULL,
    "responseTimeMs" INTEGER,
    "regionId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebsiteStatusLatest_pkey" PRIMARY KEY ("websiteId"),
    CONSTRAINT "WebsiteStatusLatest_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Helpful index for recent lookups
CREATE INDEX "WebsiteStatusLatest_checkedAt_idx" ON "WebsiteStatusLatest"("checkedAt");
