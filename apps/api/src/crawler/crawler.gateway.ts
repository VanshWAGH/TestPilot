import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

export interface WsCrawlProgressPayload {
  jobId: string;
  projectId: string;
  status: string;
  pagesCrawled: number;
  pagesDiscovered: number;
  pagesSkipped?: number;
  currentUrl?: string;
  currentStage?: string;
  extractionStatus?: string;
  thumbnailUrl?: string | null;
  pageTitle?: string;
  elementsCount?: number;
  message?: string;
  percentComplete: number;
  timestamp: string;
}

@WebSocketGateway({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})
export class CrawlerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CrawlerGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`WebSocket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WebSocket client disconnected: ${client.id}`);
  }

  /** Client subscribes to all events for a project room */
  @SubscribeMessage("subscribe:project")
  handleSubscribeProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    if (data?.projectId) {
      const room = `project:${data.projectId}`;
      client.join(room);
      this.logger.debug(`Client ${client.id} joined room ${room}`);
      return { event: "subscribed", room };
    }
  }

  /** Client subscribes to a specific crawl job room */
  @SubscribeMessage("subscribe:crawl")
  handleSubscribeCrawl(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string },
  ) {
    if (data?.jobId) {
      const room = `crawl:${data.jobId}`;
      client.join(room);
      this.logger.debug(`Client ${client.id} joined room ${room}`);
      return { event: "subscribed", room };
    }
  }

  broadcastCrawlProgress(payload: WsCrawlProgressPayload) {
    if (!this.server) return;
    const projectRoom = `project:${payload.projectId}`;
    const jobRoom = `crawl:${payload.jobId}`;
    this.server.to(projectRoom).to(jobRoom).emit("crawl:progress", payload);
  }

  broadcastCrawlCompleted(jobId: string, projectId: string, payload: object) {
    if (!this.server) return;
    const projectRoom = `project:${projectId}`;
    const jobRoom = `crawl:${jobId}`;
    this.server.to(projectRoom).to(jobRoom).emit("crawl:completed", {
      jobId,
      projectId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastCrawlFailed(jobId: string, projectId: string, error: string) {
    if (!this.server) return;
    const projectRoom = `project:${projectId}`;
    const jobRoom = `crawl:${jobId}`;
    this.server.to(projectRoom).to(jobRoom).emit("crawl:failed", {
      jobId,
      projectId,
      error,
      timestamp: new Date().toISOString(),
    });
  }
}
