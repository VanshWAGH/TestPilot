import { describe, it, expect, afterEach } from "vitest";
import { getRedisConnectionOptions } from "./queue.constants";

describe("getRedisConnectionOptions", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("parses rediss:// REDIS_URL with TLS and credentials (Upstash free tier)", () => {
    process.env.REDIS_URL =
      "rediss://default:secret%40pass@us1-example.upstash.io:6379";

    const opts = getRedisConnectionOptions();
    expect(opts.host).toBe("us1-example.upstash.io");
    expect(opts.port).toBe(6379);
    expect(opts.username).toBe("default");
    expect(opts.password).toBe("secret@pass");
    expect(opts.tls).toEqual({});
  });

  it("parses plain redis:// REDIS_URL without TLS", () => {
    process.env.REDIS_URL = "redis://localhost:6380";

    const opts = getRedisConnectionOptions();
    expect(opts.host).toBe("localhost");
    expect(opts.port).toBe(6380);
    expect(opts.tls).toBeUndefined();
  });

  it("falls back to REDIS_HOST and REDIS_PORT when REDIS_URL is unset", () => {
    delete process.env.REDIS_URL;
    process.env.REDIS_HOST = "redis.internal";
    process.env.REDIS_PORT = "6381";
    process.env.REDIS_TLS = "true";

    const opts = getRedisConnectionOptions();
    expect(opts).toEqual({
      host: "redis.internal",
      port: 6381,
      tls: {},
      connectTimeout: 5000,
    });
  });

  it("strips surrounding quotes from REDIS_URL", () => {
    process.env.REDIS_URL = '"rediss://default:pass@upstash.io:6379"';

    const opts = getRedisConnectionOptions();
    expect(opts.host).toBe("upstash.io");
    expect(opts.port).toBe(6379);
    expect(opts.tls).toEqual({});
  });
});
