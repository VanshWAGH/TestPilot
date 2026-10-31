import { Module } from "@nestjs/common";
import { ClerkService } from "./clerk.service";
import { AuthGuard } from "./auth.guard";
import { AuthController } from "./auth.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [ClerkService, AuthGuard],
  exports: [ClerkService, AuthGuard],
})
export class AuthModule {}
