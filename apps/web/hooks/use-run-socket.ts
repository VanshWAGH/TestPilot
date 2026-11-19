"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

interface RunSocketOptions {
  projectId: string;
  onRunStarted?: (data: any) => void;
  onRunCompleted?: (data: any) => void;
  onRunFailed?: (data: any) => void;
  onRunStatus?: (data: any) => void;
}

export function useRunSocket({
  projectId,
  onRunStarted,
  onRunCompleted,
  onRunFailed,
  onRunStatus,
}: RunSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!projectId) return;

    // Determine WS URL — prefer env var, fall back to current origin
    const wsUrl =
      (typeof process !== "undefined" &&
        process.env.NEXT_PUBLIC_WS_URL) ||
      (typeof window !== "undefined" ? window.location.origin : "");

    let socket: Socket;
    try {
      socket = io(wsUrl, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
      });
    } catch (err) {
      console.warn("[useRunSocket] Failed to initialize socket.io client:", err);
      return;
    }

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("subscribe:project", { projectId });
    });

    socket.on("connect_error", (err) => {
      console.warn("[useRunSocket] Connection error:", err.message);
    });

    socket.on("run:started", (data: any) => {
      onRunStarted?.(data);
      toast.info("Run started", {
        description: `Test run ${data.runId?.slice(0, 8)} dispatched to GitHub Actions.`,
      });
    });

    socket.on("run:completed", (data: any) => {
      onRunCompleted?.(data);
      if (data.status === "passed") {
        toast.success("Run completed ✅", {
          description: `${data.passedCount} passed / ${data.failedCount} failed · ${data.totalTests} total`,
        });
      } else if (data.status === "failed") {
        toast.warning("Run completed with failures", {
          description: `${data.passedCount} passed / ${data.failedCount} failed · ${data.totalTests} total`,
        });
      } else {
        toast.info("Run completed", {
          description: data.status,
        });
      }
    });

    socket.on("run:failed", (data: any) => {
      onRunFailed?.(data);
      toast.error("Run failed ❌", {
        description: data.error || "An unexpected error occurred.",
      });
    });

    socket.on("run:status", (data: any) => {
      onRunStatus?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId]); // reconnect when projectId changes
  // NOTE: callbacks intentionally omitted from deps — they're stable refs from the caller
}
