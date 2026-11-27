import "./tracing";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { IoAdapter } from "@nestjs/platform-socket.io";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use Pino logger globally (structured JSON in production, pretty in dev)
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : "*";

  app.enableCors({
    origin: corsOrigin,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: corsOrigin !== "*",
  });

  // Use Socket.IO WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  app.setGlobalPrefix("api/v1", {
    exclude: ["admin/queues(.*)"],
  });

  // --- Swagger API Documentation ---
  const config = new DocumentBuilder()
    .setTitle("TestPilot Platform API")
    .setDescription(
      "AI-Native Self-Healing Playwright Test Automation Platform API. Supports autonomous crawling, Page Object & test generation, deterministic + LLM self-healing, GitHub Defect Lifecycle, scheduled runs, audit logging, and Prometheus observability.",
    )
    .setVersion("1.0.0")
    .addBearerAuth()
    .addTag("Health", "Service liveness and readiness checks")
    .addTag("Observability", "Prometheus metrics endpoint")
    .addTag("Resilience & Observability", "Circuit breakers, DLQ, and OTel status")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(
    `🚀 API Server running on: http://localhost:${port}/api/v1`,
    "Bootstrap",
  );
  logger.log(
    `📖 Swagger API Docs available at: http://localhost:${port}/api/docs`,
    "Bootstrap",
  );
  logger.log(
    `📊 BullMQ Queue Board available at: http://localhost:${port}/admin/queues`,
    "Bootstrap",
  );
  logger.log(
    `📈 Prometheus Metrics available at: http://localhost:${port}/api/v1/metrics`,
    "Bootstrap",
  );
  logger.log(`🔌 WebSocket gateway live at: ws://localhost:${port}`, "Bootstrap");
}

bootstrap();
