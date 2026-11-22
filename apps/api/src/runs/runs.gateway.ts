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

@WebSocketGateway({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})
export class RunsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RunsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`WebSocket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WebSocket client disconnected: ${client.id}`);
  }

  /** Client subscribes to a run (and project) room */
  @SubscribeMessage("subscribe:run")
  handleSubscribeRun(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; runId?: string },
  ) {
    if (data?.projectId) {
      const projectRoom = `project:${data.projectId}`;
      client.join(projectRoom);
      this.logger.debug(`Client ${client.id} joined room ${projectRoom}`);
      if (data.runId) {
        const runRoom = `run:${data.runId}`;
        client.join(runRoom);
        this.logger.debug(`Client ${client.id} joined room ${runRoom}`);
        return { event: "subscribed", rooms: [projectRoom, runRoom] };
      }
      return { event: "subscribed", rooms: [projectRoom] };
    }
  }

  /** Alias: client subscribes to project room only (no runId) */
  @SubscribeMessage("subscribe:project")
  handleSubscribeProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; runId?: string },
  ) {
    if (data?.projectId) {
      const projectRoom = `project:${data.projectId}`;
      client.join(projectRoom);
      this.logger.debug(`Client ${client.id} joined room ${projectRoom}`);
      return { event: "subscribed", rooms: [projectRoom] };
    }
  }

  broadcastRunStarted(projectId: string, runId: string, payload: object) {
    if (!this.server) return;
    const projectRoom = `project:${projectId}`;
    const runRoom = `run:${runId}`;
    this.server
      .to(projectRoom)
      .to(runRoom)
      .emit("run:started", {
        projectId,
        runId,
        ...payload,
        timestamp: new Date().toISOString(),
      });
  }

  broadcastRunCompleted(projectId: string, runId: string, payload: object) {
    if (!this.server) return;
    const projectRoom = `project:${projectId}`;
    const runRoom = `run:${runId}`;
    this.server
      .to(projectRoom)
      .to(runRoom)
      .emit("run:completed", {
        projectId,
        runId,
        ...payload,
        timestamp: new Date().toISOString(),
      });
  }

  broadcastRunFailed(projectId: string, runId: string, error: string) {
    if (!this.server) return;
    const projectRoom = `project:${projectId}`;
    const runRoom = `run:${runId}`;
    this.server
      .to(projectRoom)
      .to(runRoom)
      .emit("run:failed", {
        projectId,
        runId,
        error,
        timestamp: new Date().toISOString(),
      });
  }

  broadcastRunStatusUpdate(projectId: string, runId: string, payload: object) {
    if (!this.server) return;
    const projectRoom = `project:${projectId}`;
    const runRoom = `run:${runId}`;
    this.server
      .to(projectRoom)
      .to(runRoom)
      .emit("run:status", {
        projectId,
        runId,
        ...payload,
        timestamp: new Date().toISOString(),
      });
  }
}
