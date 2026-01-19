# @repo/clickhouse

ClickHouse client wrapper used for uptime metrics.

## Configuration

Add the following variables (for example in `packages/config/.env`):

- `CLICKHOUSE_URL` – ClickHouse HTTP endpoint (e.g. `http://localhost:8123`)
- `CLICKHOUSE_USERNAME` – username (default: `default`)
- `CLICKHOUSE_PASSWORD` – password (default: empty)
- `CLICKHOUSE_DATABASE` – database name (default: `default`)
- `CLICKHOUSE_METRICS_TABLE` – table for uptime events (default: `uptime_checks`)

## Usage

```ts
import { recordUptimeEvent } from "@repo/clickhouse";

await recordUptimeEvent({
  websiteId: "abc-123",
  regionId: "iad",
  status: "UP",
  responseTimeMs: 120,
  checkedAt: new Date(),
});
```
