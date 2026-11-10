import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables robustly across all execution modes
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../../.env.local"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local"), override: true });

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { IoAdapter } from "@nestjs/platform-socket.io";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Disable NestJS default logger; Pino will handle everything
    bufferLogs: true,
  });

  // Use Pino logger globally (structured JSON in production, pretty in dev)
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );

  app.enableCors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  });

  // Use Socket.IO WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  app.setGlobalPrefix("api/v1", {
    exclude: ["admin/queues(.*)"],
  });

  // --- Swagger API Documentation ---
  const config = new DocumentBuilder()
    .setTitle("TestPilot Platform API")
    .setDescription("Self-Healing Playwright Test Automation Platform API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 API Server running on: http://localhost:${port}/api/v1`, "Bootstrap");
  logger.log(`📖 Swagger API Docs available at: http://localhost:${port}/api/docs`, "Bootstrap");
  logger.log(`📊 BullMQ Queue Board available at: http://localhost:${port}/admin/queues`, "Bootstrap");
  logger.log(`🔌 WebSocket gateway live at: ws://localhost:${port}`, "Bootstrap");
}

bootstrap();
