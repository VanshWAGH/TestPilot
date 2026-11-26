import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuditService } from "./audit.service";
import { SecurityService } from "../common/security/security.service";
import { HarRedactorService } from "../common/security/har-redactor.service";
import { AuditQueryDto, RedactHarDto } from "./dto/audit-query.dto";

@UseGuards(AuthGuard)
@Controller()
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly securityService: SecurityService,
    private readonly harRedactorService: HarRedactorService,
  ) {}

  // ─── Audit Trail Endpoints (Task 6.6) ────────────────────────────────────

  @Get("audit-logs")
  async listAllAuditLogs(@Query() query: AuditQueryDto) {
    return this.auditService.queryLogs(query);
  }

  @Get("projects/:projectId/audit-logs")
  async listProjectAuditLogs(
    @Param("projectId") projectId: string,
    @Query() query: AuditQueryDto,
  ) {
    return this.auditService.queryLogs({ ...query, projectId });
  }

  @Get("projects/:projectId/audit-stats")
  async getAuditStats(@Param("projectId") projectId: string) {
    return this.auditService.getStats(projectId);
  }

  // ─── Security Hardening Endpoints (Task 6.5) ─────────────────────────────

  @Get("security/checklist")
  async getGlobalSecurityChecklist() {
    return this.securityService.getSecurityChecklist();
  }

  @Get("projects/:projectId/security/checklist")
  async getProjectSecurityChecklist(@Param("projectId") projectId: string) {
    return this.securityService.getSecurityChecklist(projectId);
  }

  @Post("security/har-redact")
  @HttpCode(HttpStatus.OK)
  async redactHar(@Body() body: RedactHarDto) {
    return this.harRedactorService.redactHar(body.har);
  }

  // ─── Production Approval Gate (Task 6.5) ─────────────────────────────────

  @Post("projects/:projectId/runs/:runId/approve")
  @HttpCode(HttpStatus.OK)
  async approveProductionRun(
    @Param("projectId") projectId: string,
    @Param("runId") runId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user?.id || "user-approver";
    const run = await this.securityService.approveProductionRun(runId, userId);

    // Record audit log for production approval
    await this.auditService.recordLog({
      projectId,
      userId,
      action: "run:approve_prod",
      resourceType: "run",
      resourceId: runId,
      description: `Production test run ${runId} approved by user ${userId}`,
      metadata: { runId, status: "approved" },
    });

    return {
      success: true,
      runId,
      approvalStatus: "approved",
      approvedBy: userId,
      status: run.status,
    };
  }
}
