import { describe, it, expect, vi, beforeEach } from "vitest";
import { CrawlerGateway } from "./crawler.gateway";

describe("CrawlerGateway", () => {
  let gateway: CrawlerGateway;
  let mockServer: any;

  beforeEach(() => {
    gateway = new CrawlerGateway();
    mockServer = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
    gateway.server = mockServer;
  });

  it("handles project room subscription", () => {
    const mockSocket: any = {
      id: "sock-1",
      join: vi.fn(),
    };

    const result = gateway.handleSubscribeProject(mockSocket, { projectId: "proj-1" });
    expect(mockSocket.join).toHaveBeenCalledWith("project:proj-1");
    expect(result).toEqual({ event: "subscribed", room: "project:proj-1" });
  });

  it("handles crawl room subscription", () => {
    const mockSocket: any = {
      id: "sock-1",
      join: vi.fn(),
    };

    const result = gateway.handleSubscribeCrawl(mockSocket, { jobId: "job-1" });
    expect(mockSocket.join).toHaveBeenCalledWith("crawl:job-1");
    expect(result).toEqual({ event: "subscribed", room: "crawl:job-1" });
  });

  it("broadcasts crawl progress to project and crawl rooms", () => {
    const progressPayload = {
      jobId: "job-1",
      projectId: "proj-1",
      status: "in_progress",
      pagesCrawled: 3,
      pagesDiscovered: 6,
      pagesSkipped: 1,
      currentUrl: "https://www.saucedemo.com/cart.html",
      currentStage: "extracting",
      thumbnailUrl: "https://storage/thumb.png",
      percentComplete: 50,
      timestamp: new Date().toISOString(),
    };

    gateway.broadcastCrawlProgress(progressPayload);

    expect(mockServer.to).toHaveBeenCalledWith("project:proj-1");
    expect(mockServer.to).toHaveBeenCalledWith("crawl:job-1");
    expect(mockServer.emit).toHaveBeenCalledWith("crawl:progress", progressPayload);
  });

  it("broadcasts crawl completion event", () => {
    gateway.broadcastCrawlCompleted("job-1", "proj-1", {
      pagesCrawled: 6,
      pagesSkipped: 2,
    });

    expect(mockServer.to).toHaveBeenCalledWith("project:proj-1");
    expect(mockServer.to).toHaveBeenCalledWith("crawl:job-1");
    expect(mockServer.emit).toHaveBeenCalledWith(
      "crawl:completed",
      expect.objectContaining({
        jobId: "job-1",
        projectId: "proj-1",
        pagesCrawled: 6,
        pagesSkipped: 2,
      }),
    );
  });

  it("broadcasts crawl failed event", () => {
    gateway.broadcastCrawlFailed("job-1", "proj-1", "Network timeout");

    expect(mockServer.to).toHaveBeenCalledWith("project:proj-1");
    expect(mockServer.to).toHaveBeenCalledWith("crawl:job-1");
    expect(mockServer.emit).toHaveBeenCalledWith(
      "crawl:failed",
      expect.objectContaining({
        jobId: "job-1",
        projectId: "proj-1",
        error: "Network timeout",
      }),
    );
  });
});

