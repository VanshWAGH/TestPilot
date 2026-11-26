import { Injectable, Logger } from "@nestjs/common";
import {
  trace,
  context,
  propagation,
  SpanStatusCode,
  Span,
  Attributes,
} from "@opentelemetry/api";
import { getTracingConfig } from "../tracing";

export type TraceCarrier = Record<string, string>;

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly tracer = trace.getTracer("testpilot-api", "1.0.0");

  /**
   * Executes an async operation inside an active OpenTelemetry span.
   * Records exceptions and sets ERROR status automatically on failure.
   */
  async withSpan<T>(
    spanName: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes,
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      spanName,
      { attributes },
      async (span) => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (err: any) {
          span.recordException(
            err instanceof Error ? err : new Error(String(err)),
          );
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err?.message || String(err),
          });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Injects the current W3C trace context (`traceparent`, `tracestate`) into a plain object
   * so traces propagate across BullMQ jobs (API -> Queue -> Worker -> GitHub).
   */
  injectTraceContext(carrier: TraceCarrier = {}): TraceCarrier {
    try {
      propagation.inject(context.active(), carrier);
    } catch (err: any) {
      this.logger.debug(`Could not inject trace context: ${err.message}`);
    }
    return carrier;
  }

  /**
   * Restores trace context from a BullMQ job carrier and executes the callback inside it.
   */
  async runWithExtractedContext<T>(
    carrier: TraceCarrier | undefined,
    spanName: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes,
  ): Promise<T> {
    if (!carrier || Object.keys(carrier).length === 0) {
      return this.withSpan(spanName, fn, attributes);
    }

    const parentContext = propagation.extract(context.active(), carrier);
    return context.with(parentContext, () =>
      this.withSpan(spanName, fn, attributes),
    );
  }

  /**
   * Returns the current active OpenTelemetry trace ID, if any.
   */
  getActiveTraceId(): string | null {
    const activeSpan = trace.getActiveSpan();
    return activeSpan ? activeSpan.spanContext().traceId : null;
  }

  /**
   * Returns OpenTelemetry runtime status & configuration.
   */
  getStatus() {
    return {
      ...getTracingConfig(),
      activeTraceId: this.getActiveTraceId(),
    };
  }
}
