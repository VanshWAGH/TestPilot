import { describe, it, expect } from "vitest";
import { HarRedactorService } from "./har-redactor.service";

describe("HarRedactorService", () => {
  const service = new HarRedactorService();

  it("should redact sensitive authorization and cookie headers", () => {
    const rawHar = {
      log: {
        version: "1.2",
        creator: { name: "TestPilot", version: "1.0" },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/user",
              headers: [
                { name: "Authorization", value: "Bearer secret-jwt-token-xyz" },
                { name: "Cookie", value: "sessionid=12345; auth=true" },
                { name: "Accept", value: "application/json" },
              ],
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [
                { name: "Set-Cookie", value: "sessionid=fresh; Secure; HttpOnly" },
                { name: "Content-Type", value: "application/json" },
              ],
            },
          },
        ],
      },
    };

    const redacted = service.redactHar(rawHar);

    const reqHeaders = redacted.log.entries[0].request.headers;
    const authHeader = reqHeaders.find((h) => h.name === "Authorization");
    const cookieHeader = reqHeaders.find((h) => h.name === "Cookie");
    const acceptHeader = reqHeaders.find((h) => h.name === "Accept");

    expect(authHeader?.value).toBe("[REDACTED_HEADER]");
    expect(cookieHeader?.value).toBe("[REDACTED_HEADER]");
    expect(acceptHeader?.value).toBe("application/json");

    const resHeaders = redacted.log.entries[0].response.headers;
    const setCookieHeader = resHeaders.find((h) => h.name === "Set-Cookie");
    expect(setCookieHeader?.value).toBe("[REDACTED_HEADER]");
  });

  it("should redact sensitive keys in JSON payloads", () => {
    const payload = JSON.stringify({
      username: "john_doe",
      password: "SuperSecretPassword123!",
      client_secret: "secret-key-abc",
      nested: {
        access_token: "tok_12345",
        city: "San Francisco",
      },
    });

    const sanitized = service.redactBodyText(payload);
    const parsed = JSON.parse(sanitized!);

    expect(parsed.username).toBe("john_doe");
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.client_secret).toBe("[REDACTED]");
    expect(parsed.nested.access_token).toBe("[REDACTED]");
    expect(parsed.nested.city).toBe("San Francisco");
  });

  it("should redact credit card numbers and SSNs via regex in non-JSON strings", () => {
    const rawText = "User card is 4532-1234-5678-9012 and SSN is 123-45-6789 with Bearer eyJhbGciOi";
    const sanitized = service.redactBodyText(rawText);

    expect(sanitized).not.toContain("4532-1234-5678-9012");
    expect(sanitized).not.toContain("123-45-6789");
    expect(sanitized).toContain("[REDACTED_CREDIT_CARD]");
    expect(sanitized).toContain("[REDACTED_SSN]");
    expect(sanitized).toContain("Bearer [REDACTED_TOKEN]");
  });

  it("should redact sensitive query parameters in requests", () => {
    const entry: any = {
      request: {
        method: "GET",
        url: "https://example.com/api?api_key=123&user=john",
        headers: [],
        queryString: [
          { name: "api_key", value: "secret-api-key" },
          { name: "user", value: "john" },
        ],
      },
      response: { status: 200, statusText: "OK", headers: [] },
    };

    const redacted = service.redactEntry(entry);
    const params = redacted.request.queryString!;

    expect(params.find((p) => p.name === "api_key")?.value).toBe("[REDACTED_PARAM]");
    expect(params.find((p) => p.name === "user")?.value).toBe("john");
  });
});
