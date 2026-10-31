import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { EnvironmentsController } from "./environments.controller";
import { EnvironmentsService } from "./environments.service";
import { AuthModule } from "../auth/auth.module";
import { CryptoModule } from "../common/crypto/crypto.module";

@Module({
  imports: [AuthModule, CryptoModule],
  controllers: [ProjectsController, EnvironmentsController],
  providers: [ProjectsService, EnvironmentsService],
  exports: [ProjectsService, EnvironmentsService],
})
export class ProjectsModule {}
