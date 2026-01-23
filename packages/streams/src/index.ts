import { createClient } from "redis";
import {
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_HOST,
  REDIS_PORT,
  STREAM_NAME,
} from "@repo/config";

export interface WebsiteEvent {
  url: string;
  id: string;
}

export interface ReadGroupOptions {
  consumerGroup: string;
  workerId: string;
}

export interface AckOptions {
  consumerGroup: string;
  streamId: string;
}

export interface AckBulkOptions {
  consumerGroup: string;
  eventIds: string[];
}

export interface StreamMessage {
  id: string;
  message: Record<string, string>;
}

export interface StreamReadResponse {
  name: string;
  messages: StreamMessage[];
}

type MessageType = {
  id: string;
  event: {
    url: string;
    id: string;
  };
};

const redisClient = createClient({
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
  socket: {
    host: REDIS_HOST,
    port: Number(REDIS_PORT),
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
  process.exit(1);
});

let client: typeof redisClient;

try {
  client = await redisClient.connect();
} catch (error) {
  console.error("Failed to connect to Redis:", error);
  process.exit(1);
}

async function xAdd({ url, id }: WebsiteEvent) {
  await client.xAdd(STREAM_NAME, "*", {
    url,
    id,
  });
}

export async function xAddBulk(websites: WebsiteEvent[]) {
  // #region agent log
  console.log(
    `[DEBUG:xAddBulk] Entry - websiteCount=${websites.length}, streamName=${STREAM_NAME}, websiteIds=${JSON.stringify(websites.map((w) => w.id))}`,
  );
  // #endregion

  // Avoid unbounded Promise.all fan-out (can freeze machines with large website counts).
  // Use Redis pipelining in bounded batches.
  const batchSize = 250;
  for (let i = 0; i < websites.length; i += batchSize) {
    const batch = websites.slice(i, i + batchSize);
    const multi = client.multi();
    for (const website of batch) {
      multi.xAdd(STREAM_NAME, "*", { url: website.url, id: website.id });
    }
    const res = await multi.exec();
    // node-redis returns null if disconnected; surface as error
    if (res === null) {
      throw new Error("Redis MULTI exec returned null (disconnected?)");
    }
    // #region agent log
    console.log(
      `[DEBUG:xAddBulk] Batch done - batchIndex=${i}, batchSize=${batch.length}, streamIds=${JSON.stringify(res)}`,
    );
    // #endregion
  }
}

export async function xReadGroup(
  options: ReadGroupOptions,
): Promise<MessageType[]> {
  try {
    // #region agent log
    console.log(
      `[DEBUG:xReadGroup] Entry - consumerGroup=${options.consumerGroup}, workerId=${options.workerId}, streamName=${STREAM_NAME}`,
    );
    // #endregion

    const response = (await client.xReadGroup(
      options.consumerGroup,
      options.workerId,
      {
        key: STREAM_NAME,
        id: ">",
      },
      {
        COUNT: 5,
        // Prefer server-side blocking over client-side polling loops.
        // This reduces CPU and log spam when the stream is idle.
        BLOCK: 1000,
      },
    )) as StreamReadResponse[];

    // #region agent log
    console.log(
      `[DEBUG:xReadGroup] Raw response - exists=${!!response}, length=${response?.length}, firstStreamMsgCount=${response?.[0]?.messages?.length}, raw=${JSON.stringify(response)?.slice(0, 500)}`,
    );
    // #endregion

    if (!response || response.length === 0 || !response[0]?.messages) {
      // #region agent log
      console.log(
        `[DEBUG:xReadGroup] Empty response - response=${JSON.stringify(response)}`,
      );
      // #endregion
      return [];
    }

    const rawMessages = response[0].messages;
    const messages: MessageType[] = response[0].messages
      .filter(
        (streamMessage: StreamMessage) =>
          streamMessage.message.url && streamMessage.message.id,
      )
      .map((streamMessage: StreamMessage) => ({
        id: streamMessage.id,
        event: {
          url: streamMessage.message.url as string,
          id: streamMessage.message.id as string,
        },
      }));

    // #region agent log
    console.log(
      `[DEBUG:xReadGroup] Processed - rawCount=${rawMessages.length}, filteredCount=${messages.length}, filteredOut=${rawMessages.length - messages.length}, messageIds=${JSON.stringify(messages.map((m) => m.event.id))}`,
    );
    // #endregion

    return messages;
  } catch (error) {
    // #region agent log
    console.log(
      `[DEBUG:xReadGroup] ERROR - ${String(error)}, name=${(error as Error)?.name}, message=${(error as Error)?.message}`,
    );
    // #endregion
    console.error("Error reading from stream:", error);
    return [];
  }
}

async function xAck(options: AckOptions): Promise<number> {
  try {
    const result = await client.xAck(
      STREAM_NAME,
      options.consumerGroup,
      options.streamId,
    );
    return result;
  } catch (error) {
    console.error("Error acknowledging message:", error);
    throw error;
  }
}

export async function xAckBulk(options: AckBulkOptions) {
  await Promise.all(
    options.eventIds.map((eventId) =>
      xAck({ consumerGroup: options.consumerGroup, streamId: eventId }),
    ),
  );
}

// #region agent log - diagnostic function
export async function xPendingDiagnostic(consumerGroup: string): Promise<void> {
  try {
    // Get pending summary for the consumer group
    const pendingSummary = await client.xPending(STREAM_NAME, consumerGroup);
    // Get stream length
    const streamLen = await client.xLen(STREAM_NAME);
    // Get stream info
    const streamInfo = await client.xInfoStream(STREAM_NAME);

    console.log(
      `[DEBUG:xPendingDiagnostic] streamName=${STREAM_NAME}, consumerGroup=${consumerGroup}, streamLength=${streamLen}, pendingSummary=${JSON.stringify(pendingSummary)}, firstEntry=${JSON.stringify(streamInfo?.firstEntry)}, lastEntry=${JSON.stringify(streamInfo?.lastEntry)}, groups=${streamInfo?.groups}`,
    );
  } catch (error) {
    console.log(
      `[DEBUG:xPendingDiagnostic] ERROR - ${String(error)}, consumerGroup=${consumerGroup}`,
    );
  }
}
// #endregion
