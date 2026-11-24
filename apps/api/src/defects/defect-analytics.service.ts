import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface DefectSeverityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface DefectStatusBreakdown {
  open: number;
  in_progress: number;
  ready_for_qa: number;
  qa_passed: number;
  qa_failed: number;
  closed: number;
}

export interface DefectAnalyticsResponse {
  totalDefects: number;
  bySeverity: DefectSeverityBreakdown;
  byStatus: DefectStatusBreakdown;
  avgTimeToFixHours: number;
  avgTimeToFixDays: number;
  verificationMetrics: {
    totalAttempts: number;
    passedAttempts: number;
    failedAttempts: number;
    passRate: number; // 0 - 100%
  };
  severityDistribution: Array<{
    severity: string;
    count: number;
    percentage: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Task 5.8 — Defect Dashboard & Analytics Service
 *
 * Computes defect lifecycle metrics:
 *  - Breakdown by severity (critical, high, medium, low)
 *  - Breakdown by status (open, in_progress, ready_for_qa, qa_passed, qa_failed, closed)
 *  - Average time to fix (hours & days)
 *  - Verification pass rate percentage
 */
@Injectable()
export class DefectAnalyticsService {
  private readonly logger = new Logger(DefectAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(projectId?: string): Promise<DefectAnalyticsResponse> {
    const whereClause: any = projectId ? { projectId } : {};

    // 1. Fetch defects
    const defects = await this.prisma.defect.findMany({
      where: whereClause,
      select: {
        id: true,
        severity: true,
        status: true,
        createdAt: true,
        closedAt: true,
        verificationAttempts: true,
      },
    });

    const totalDefects = defects.length;

    // 2. Severity breakdown
    const bySeverity: DefectSeverityBreakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const defect of defects) {
      const sev = (defect.severity || "medium").toLowerCase() as keyof DefectSeverityBreakdown;
      if (bySeverity[sev] !== undefined) {
        bySeverity[sev]++;
      } else {
        bySeverity.medium++;
      }
    }

    // 3. Status breakdown
    const byStatus: DefectStatusBreakdown = {
      open: 0,
      in_progress: 0,
      ready_for_qa: 0,
      qa_passed: 0,
      qa_failed: 0,
      closed: 0,
    };

    for (const defect of defects) {
      const st = (defect.status || "open").toLowerCase() as keyof DefectStatusBreakdown;
      if (byStatus[st] !== undefined) {
        byStatus[st]++;
      } else {
        byStatus.open++;
      }
    }

    // 4. Average time to fix (hours & days)
    const resolvedDefects = defects.filter(
      (d) => (d.status === "closed" || d.status === "qa_passed") && d.closedAt,
    );

    let avgTimeToFixHours = 0;
    if (resolvedDefects.length > 0) {
      const totalHours = resolvedDefects.reduce((acc, d) => {
        const diffMs = new Date(d.closedAt!).getTime() - new Date(d.createdAt).getTime();
        return acc + Math.max(0, diffMs / (1000 * 60 * 60));
      }, 0);
      avgTimeToFixHours = Number((totalHours / resolvedDefects.length).toFixed(1));
    }
    const avgTimeToFixDays = Number((avgTimeToFixHours / 24).toFixed(1));

    // 5. Verification metrics
    let totalAttempts = 0;
    let passedAttempts = 0;
    let failedAttempts = 0;
    let passRate = 0;

    try {
      const attemptsWhere: any = projectId ? { defect: { projectId } } : {};
      const attempts = await this.prisma.defectVerificationAttempt.findMany({
        where: attemptsWhere,
      });

      if (attempts.length > 0) {
        totalAttempts = attempts.length;
        passedAttempts = attempts.filter((a) => a.passed).length;
        failedAttempts = totalAttempts - passedAttempts;
        passRate = Number(((passedAttempts / totalAttempts) * 100).toFixed(1));
      } else {
        // Fallback: derive from defects verificationAttempts & qa_passed status
        const totalVerificationCount = defects.reduce((acc, d) => acc + (d.verificationAttempts || 0), 0);
        const verifiedPassed = defects.filter((d) => d.status === "qa_passed" || d.status === "closed").length;
        if (totalVerificationCount > 0) {
          totalAttempts = totalVerificationCount;
          passedAttempts = verifiedPassed;
          failedAttempts = Math.max(0, totalAttempts - passedAttempts);
          passRate = Number(((passedAttempts / totalAttempts) * 100).toFixed(1));
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not query defectVerificationAttempt: ${err.message}`);
    }

    // 6. Distribution percentages for charting
    const severityDistribution = (["critical", "high", "medium", "low"] as const).map(
      (sev) => ({
        severity: sev,
        count: bySeverity[sev],
        percentage: totalDefects > 0 ? Number(((bySeverity[sev] / totalDefects) * 100).toFixed(1)) : 0,
      }),
    );

    const statusDistribution = (
      ["open", "in_progress", "ready_for_qa", "qa_passed", "qa_failed", "closed"] as const
    ).map((st) => ({
      status: st,
      count: byStatus[st],
      percentage: totalDefects > 0 ? Number(((byStatus[st] / totalDefects) * 100).toFixed(1)) : 0,
    }));

    return {
      totalDefects,
      bySeverity,
      byStatus,
      avgTimeToFixHours,
      avgTimeToFixDays,
      verificationMetrics: {
        totalAttempts,
        passedAttempts,
        failedAttempts,
        passRate,
      },
      severityDistribution,
      statusDistribution,
    };
  }
}
