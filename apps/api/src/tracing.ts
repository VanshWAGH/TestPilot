import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables before initializing OpenTelemetry SDK
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../../.env.local"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local"), override: true });

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";

const isTestEnv =
  process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
const isEnabled = process.env.OTEL_ENABLED !== "false" && !isTestEnv;
const exporterEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces";

let sdk: NodeSDK | undefined;

if (isEnabled) {
  const traceExporter = new OTLPTraceExporter({
    url: exporterEndpoint,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "testpilot-api",
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || "1.0.0",
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV || "development",
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-http": { enabled: true },
        "@opentelemetry/instrumentation-express": { enabled: true },
        "@opentelemetry/instrumentation-pg": { enabled: true },
        "@opentelemetry/instrumentation-ioredis": { enabled: true },
      }),
    ],
  });

  sdk.start();

  process.on("SIGTERM", () => {
    sdk?.shutdown().catch((err) =>
      console.error("Error shutting down OpenTelemetry SDK", err),
    );
  });
}

export function getTracingConfig() {
  return {
    enabled: isEnabled,
    serviceName: process.env.OTEL_SERVICE_NAME || "testpilot-api",
    serviceVersion: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    exporterEndpoint,
    instrumentations: ["http", "express", "pg", "ioredis"],
  };
}

export { sdk };
