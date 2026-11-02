import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class TriggerCrawlDto {
  @ApiPropertyOptional({
    description: "Target environment UUID. If omitted, uses default environment or project baseUrl.",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID("4")
  environmentId?: string;

  @ApiPropertyOptional({
    description: "Maximum crawl link depth (1 to 5).",
    default: 2,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxDepth?: number = 2;

  @ApiPropertyOptional({
    description: "Maximum number of pages to discover and crawl.",
    default: 30,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxPages?: number = 30;

  @ApiPropertyOptional({
    description: "List of allowed domain hosts.",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];

  @ApiPropertyOptional({
    description: "URL glob patterns to exclude from crawling.",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludePatterns?: string[];

  @ApiPropertyOptional({
    description: "Whether to respect target robots.txt disallow rules.",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  respectRobotsTxt?: boolean = true;

  @ApiPropertyOptional({
    description: "Polite delay in milliseconds between page navigations.",
    default: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  rateLimitDelayMs?: number = 300;

  @ApiPropertyOptional({
    description: "If true, delegates job to BullMQ background worker. If false, executes synchronously.",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  runAsync?: boolean = false;
}
