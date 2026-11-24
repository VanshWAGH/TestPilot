import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CryptoModule } from "../common/crypto/crypto.module";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { SecurityService } from "../common/security/security.service";
import { HarRedactorService } from "../common/security/har-redactor.service";

@Module({
  imports: [PrismaModule, AuthModule, CryptoModule],
  controllers: [AuditController],
  providers: [AuditService, SecurityService, HarRedactorService],
  exports: [AuditService, SecurityService, HarRedactorService],
})
export class AuditModule {}
