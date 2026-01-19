import { createClient, type ClickHouseClient } from "@clickhouse/client";
import {
  CLICKHOUSE_URL,
  CLICKHOUSE_USERNAME,
  CLICKHOUSE_PASSWORD,
  CLICKHOUSE_DATABASE,
  CLICKHOUSE_METRICS_TABLE,
} from "@repo/config";

export type UptimeStatus = "UP" | "DOWN";

export interface UptimeEventRecord {
  websiteId: string;
  regionId: string;
  status: UptimeStatus;
  responseTimeMs?: number;
  checkedAt: Date;
}

let client: ClickHouseClient | null = null;
let schemaReadyPromise: Promise<void> | null = null;

function assertConfig() {
  if (!CLICKHOUSE_URL) {
    throw new Error(
      "CLICKHOUSE_URL is not set. Please configure your ClickHouse HTTP endpoint.",
    );
  }
}

function assertIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Invalid ClickHouse identifier: ${identifier}`);
  }
}

function getClient(): ClickHouseClient {
  if (!client) {
    assertConfig();

    client = createClient({
      url: CLICKHOUSE_URL,
      username: CLICKHOUSE_USERNAME || "default",
      password: CLICKHOUSE_PASSWORD,
      database: CLICKHOUSE_DATABASE || "default",
    });
  }

  return client;
}

async function ensureSchema(): Promise<void> {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  schemaReadyPromise = (async () => {
    assertIdentifier(CLICKHOUSE_METRICS_TABLE);

    const clickhouse = getClient();

    await clickhouse.command({
      query: `
        CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_METRICS_TABLE} (
          website_id String,
          region_id String,
          status Enum('UP' = 1, 'DOWN' = 0),
          response_time_ms Nullable(UInt32),
          checked_at DateTime64(3, 'UTC'),
          ingested_at DateTime64(3, 'UTC')
        )
        ENGINE = MergeTree
        ORDER BY (website_id, region_id, checked_at)
      `,
    });
  })();

  return schemaReadyPromise;
}

export async function recordUptimeEvent(
  event: UptimeEventRecord,
): Promise<void> {
  await ensureSchema();
  const clickhouse = getClient();

  await clickhouse.insert({
    table: CLICKHOUSE_METRICS_TABLE,
    values: [
      {
        website_id: event.websiteId,
        region_id: event.regionId,
        status: event.status,
        response_time_ms: event.responseTimeMs ?? null,
        checked_at: event.checkedAt.toISOString(),
        ingested_at: new Date().toISOString(),
      },
    ],
    format: "JSONEachRow",
  });
}

export async function recordUptimeEvents(
  events: UptimeEventRecord[],
): Promise<void> {
  if (events.length === 0) return;

  await ensureSchema();
  const clickhouse = getClient();
  const ingestedAtIso = new Date().toISOString();

  await clickhouse.insert({
    table: CLICKHOUSE_METRICS_TABLE,
    values: events.map((event) => ({
      website_id: event.websiteId,
      region_id: event.regionId,
      status: event.status,
      response_time_ms: event.responseTimeMs ?? null,
      checked_at: event.checkedAt.toISOString(),
      ingested_at: ingestedAtIso,
    })),
    format: "JSONEachRow",
  });
}

export function getClickhouseClient(): ClickHouseClient {
  return getClient();
}
