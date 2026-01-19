import {
  recordUptimeEvents,
  type UptimeEventRecord,
  type UptimeStatus,
} from "@repo/clickhouse";
import { REGION_ID, WORKER_ID } from "@repo/config";
import { xAckBulk, xReadGroup } from "@repo/streams";
import axios from "axios";

// Validate required environment variables
if (!REGION_ID || !WORKER_ID) {
  console.error(
    "[Worker] Missing required environment variables: REGION_ID and WORKER_ID must be set",
  );
  // eslint-disable-next-line no-undef
  process.exit(1);
}

async function checkWebsite(
  url: string,
  websiteId: string,
): Promise<UptimeEventRecord> {
  const startTime = Date.now();
  let status: UptimeStatus = "UP";
  let responseTimeMs: number | undefined;
  const checkedAt = new Date();

  try {
    await axios.get(url, {
      timeout: 10_000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    responseTimeMs = Date.now() - startTime;
  } catch {
    status = "DOWN";
  }

  return {
    websiteId,
    regionId: REGION_ID,
    status,
    responseTimeMs,
    checkedAt,
  };
}

async function startWorker() {
  while (true) {
    //read from the stream
    const response = await xReadGroup({
      consumerGroup: REGION_ID,
      workerId: WORKER_ID,
    });

    // Process messages if any were received
    if (response.length > 0) {
      const results = await Promise.allSettled(
        response.map((message) =>
          checkWebsite(message.event.url, message.event.id),
        ),
      );

      const successful: { streamId: string; event: UptimeEventRecord }[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const message = response[i];
        if (!message) continue;
        if (result?.status === "fulfilled") {
          successful.push({ streamId: message.id, event: result.value });
        } else {
          console.error(
            `[Worker] Failed to check website for message ${message.id}`,
            result?.reason,
          );
        }
      }

      try {
        await recordUptimeEvents(successful.map((s) => s.event));

        // Ack back to the queue only after persistence succeeds
        await xAckBulk({
          consumerGroup: REGION_ID,
          eventIds: successful.map((s) => s.streamId),
        });
      } catch (error) {
        console.error("[Worker] Failed to persist uptime batch", error);
      }
    }

    // Small delay to prevent tight loop when no messages
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

startWorker().catch((error) => {
  console.error("[Worker] Fatal error:", error);
  // eslint-disable-next-line no-undef
  process.exit(1);
});
