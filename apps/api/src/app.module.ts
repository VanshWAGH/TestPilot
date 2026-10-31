import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    // --- Pino Structured Logger ---
    LoggerModule.forRoot({
      pinoHttp: {
        // Use human-readable "pretty" format in development, JSON in production
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
                  ignore: "pid,hostname",
                },
              }
            : undefined,
        level: process.env.LOG_LEVEL || "info",
        // Automatically log request/response
        autoLogging: true,
        // Redact sensitive headers
        redact: ["req.headers.authorization", "req.headers.cookie"],
      },
    }),

    PrismaModule,
    QueueModule,
    HealthModule,
    AuthModule,
    StorageModule,
  ],
})
export class AppModule {}
