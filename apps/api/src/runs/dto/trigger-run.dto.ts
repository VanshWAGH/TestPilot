import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsArray,
  IsEnum,
} from "class-validator";

export class TriggerRunDto {
  @ApiPropertyOptional({
    description: "Target environment ID. Uses project default if omitted.",
  })
  @IsOptional()
  @IsString()
  environmentId?: string;

  @ApiPropertyOptional({
    description: "Playwright grep tag filter, e.g. '@smoke' or '@login'. Runs all tests if omitted.",
  })
  @IsOptional()
  @IsString()
  testTags?: string;

  @ApiPropertyOptional({
    description: "Specific scenario IDs to run. Runs all approved scenarios if omitted.",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scenarioIds?: string[];

  @ApiPropertyOptional({
    description: "Browser to run against. Defaults to chromium.",
    enum: ["chromium", "firefox", "webkit", "all"],
    default: "chromium",
  })
  @IsOptional()
  @IsEnum(["chromium", "firefox", "webkit", "all"])
  browser?: string;

  @ApiPropertyOptional({
    description: "Specific Git branch or ref to dispatch regression workflow on.",
    example: "heal/DEF-104-update-locator",
  })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({
    description: "How the run was triggered.",
    enum: ["manual", "schedule", "webhook", "healing_ci"],
    default: "manual",
  })
  @IsOptional()
  @IsEnum(["manual", "schedule", "webhook", "healing_ci"])
  triggerType?: string;
}

