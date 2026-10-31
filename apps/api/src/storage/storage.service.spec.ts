import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StorageService } from "./storage.service";
import * as fs from "fs";
import * as path from "path";

describe("StorageService (Local Fallback & Supabase Free Storage)", () => {
  let service: StorageService;
  const testDir = path.resolve(process.cwd(), ".storage-test");

  beforeEach(() => {
    // Force local fallback for deterministic offline unit testing
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    service = new StorageService();
    // Point to isolated test dir
    (service as any).localDir = testDir;
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should be defined and initialize in fallback mode when no credentials provided", () => {
    expect(service).toBeDefined();
    expect(service.isFallbackMode()).toBe(true);
  });

  it("should upload a file and return upload result with path and size", async () => {
    const fileContent = Buffer.from("<html><body><h1>Test Snapshot</h1></body></html>");
    const filePath = "snapshots/page-1.html";

    const result = await service.upload(fileContent, filePath, {
      contentType: "text/html",
    });

    expect(result.path).toBe(filePath);
    expect(result.sizeBytes).toBe(fileContent.byteLength);
    expect(result.publicUrl).toBeDefined();

    // Verify physical file was written
    const fullPath = path.join(testDir, "testpilot-artifacts", filePath);
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.readFileSync(fullPath).toString()).toBe(fileContent.toString());
  });

  it("should download uploaded file and match contents", async () => {
    const fileContent = Buffer.from("binary-screenshot-data");
    const filePath = "screenshots/login.png";

    await service.upload(fileContent, filePath, { contentType: "image/png" });
    const downloaded = await service.download(filePath);

    expect(downloaded.toString()).toBe("binary-screenshot-data");
  });

  it("should generate presigned download URL", async () => {
    const fileContent = Buffer.from("trace-zip-content");
    const filePath = "traces/run-1.zip";

    await service.upload(fileContent, filePath);
    const presigned = await service.getPresignedDownloadUrl(filePath, 1800);

    expect(presigned.signedUrl).toBeDefined();
    expect(presigned.expiresInSeconds).toBe(1800);
  });

  it("should generate presigned upload URL", async () => {
    const filePath = "uploads/video.webm";
    const presigned = await service.getPresignedUploadUrl(filePath);

    expect(presigned.signedUrl).toBeDefined();
    expect(presigned.path).toBe(filePath);
  });

  it("should delete file from storage", async () => {
    const fileContent = Buffer.from("temp-file");
    const filePath = "temp/test.txt";

    await service.upload(fileContent, filePath);
    const fullPath = path.join(testDir, "testpilot-artifacts", filePath);
    expect(fs.existsSync(fullPath)).toBe(true);

    await service.delete(filePath);
    expect(fs.existsSync(fullPath)).toBe(false);
  });

  it("should throw error when downloading non-existent file", async () => {
    await expect(service.download("non-existent-path.json")).rejects.toThrow(
      "File not found in local storage"
    );
  });
});

describe("StorageService (Supabase Client Mode with Mock)", () => {
  it("should delegate to Supabase client methods when configured", async () => {
    const mockUpload = vi.fn().mockResolvedValue({ data: { path: "test.png" }, error: null });
    const mockDownload = vi.fn().mockResolvedValue({
      data: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer },
      error: null,
    });
    const mockCreateSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://xyz.supabase.co/storage/v1/sign/test.png?token=123" },
      error: null,
    });
    const mockCreateSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://xyz.supabase.co/storage/v1/upload/test.png", token: "tok123" },
      error: null,
    });
    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://xyz.supabase.co/storage/v1/public/test.png" },
    });
    const mockRemove = vi.fn().mockResolvedValue({ data: [], error: null });

    const mockSupabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          download: mockDownload,
          createSignedUrl: mockCreateSignedUrl,
          createSignedUploadUrl: mockCreateSignedUploadUrl,
          getPublicUrl: mockGetPublicUrl,
          remove: mockRemove,
        }),
        listBuckets: vi.fn().mockResolvedValue({ data: [{ name: "testpilot-artifacts" }], error: null }),
      },
    };

    const service = new StorageService();
    (service as any).supabase = mockSupabase;
    (service as any).isLocalFallback = false;

    // Test upload
    const uploadRes = await service.upload(Buffer.from("abc"), "test.png");
    expect(mockUpload).toHaveBeenCalledWith("test.png", expect.any(Buffer), expect.any(Object));
    expect(uploadRes.publicUrl).toBe("https://xyz.supabase.co/storage/v1/public/test.png");

    // Test download
    const downloaded = await service.download("test.png");
    expect(mockDownload).toHaveBeenCalledWith("test.png");
    expect(downloaded.length).toBe(3);

    // Test signed URLs
    const signedDownload = await service.getPresignedDownloadUrl("test.png", 3600);
    expect(signedDownload.signedUrl).toContain("supabase.co");

    const signedUpload = await service.getPresignedUploadUrl("test.png");
    expect(signedUpload.token).toBe("tok123");

    // Test delete
    await service.delete("test.png");
    expect(mockRemove).toHaveBeenCalledWith(["test.png"]);
  });
});
