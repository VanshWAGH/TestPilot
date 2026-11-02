import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { CrawlerService } from "./crawler.service";
import { TriggerCrawlDto } from "./dto/trigger-crawl.dto";
import { AuthGuard } from "../auth/auth.guard";
import { Public } from "../auth/public.decorator";

@ApiTags("Crawler")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class CrawlerController {
  constructor(private readonly crawlerService: CrawlerService) {}

  // ─── POST /projects/:projectId/crawl ──────────────────────────────────────────

  @Post("projects/:projectId/crawl")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Trigger a website crawl",
    description:
      "Initiates autonomous Playwright exploration of the project entrypoint or environment. Discovers routes, extracts DOM snapshots, a11y trees, interactive elements, fingerprints, and route graphs.",
  })
  @ApiParam({
    name: "projectId",
    description: "UUID of the project to crawl",
    type: String,
  })
  @ApiResponse({
    status: 202,
    description: "Crawl job accepted and started",
  })
  async triggerCrawl(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: TriggerCrawlDto,
  ): Promise<any> {
    return await this.crawlerService.startCrawl(projectId, dto);
  }

  // ─── GET /projects/:projectId/crawl/latest ────────────────────────────────────

  @Get("projects/:projectId/crawl/latest")
  @ApiOperation({
    summary: "Get latest crawl job for a project",
    description: "Retrieves the most recent crawl job status, progress, and page discovery count.",
  })
  @ApiParam({
    name: "projectId",
    description: "UUID of the project",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Latest crawl job details",
  })
  async getLatestCrawl(@Param("projectId", ParseUUIDPipe) projectId: string): Promise<any> {
    return await this.crawlerService.getLatestCrawlJob(projectId);
  }

  // ─── GET /crawl/jobs/:jobId ──────────────────────────────────────────────────

  @Get("crawl/jobs/:jobId")
  @ApiOperation({
    summary: "Get crawl job by ID",
    description: "Retrieves progress, status, and summary of an active or completed crawl job.",
  })
  @ApiParam({
    name: "jobId",
    description: "UUID of the crawl job",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Crawl job details",
  })
  async getCrawlJob(@Param("jobId", ParseUUIDPipe) jobId: string): Promise<any> {
    return await this.crawlerService.getCrawlJob(jobId);
  }

  // ─── GET /projects/:projectId/pages ──────────────────────────────────────────

  @Get("projects/:projectId/pages")
  @ApiOperation({
    summary: "List discovered pages for a project",
    description: "Returns all crawled routes, element counts, and screenshot thumbnails.",
  })
  @ApiParam({
    name: "projectId",
    description: "UUID of the project",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "List of project pages",
  })
  async getProjectPages(@Param("projectId", ParseUUIDPipe) projectId: string): Promise<any> {
    return await this.crawlerService.getProjectPages(projectId);
  }

  // ─── GET /projects/:projectId/pages/:pageId ──────────────────────────────────

  @Get("projects/:projectId/pages/:pageId")
  @ApiOperation({
    summary: "Get page details and extracted elements",
    description:
      "Retrieves full page inspection data: interactive element locators, fingerprints, bounding boxes, accessibility tree snapshot, and screenshot.",
  })
  @ApiParam({
    name: "projectId",
    description: "UUID of the project",
    type: String,
  })
  @ApiParam({
    name: "pageId",
    description: "UUID of the page",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Detailed page extraction metadata",
  })
  async getPageDetails(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
  ): Promise<any> {
    return await this.crawlerService.getPageDetails(projectId, pageId);
  }

  // ─── GET /projects/:projectId/route-graph ────────────────────────────────────

  @Get("projects/:projectId/route-graph")
  @ApiOperation({
    summary: "Get project route navigation graph",
    description:
      "Returns directed route graph containing page nodes and navigation transition edges for visualization.",
  })
  @ApiParam({
    name: "projectId",
    description: "UUID of the project",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Route graph nodes and edges",
  })
  async getRouteGraph(@Param("projectId", ParseUUIDPipe) projectId: string): Promise<any> {
    return await this.crawlerService.getProjectRouteGraph(projectId);
  }
}
