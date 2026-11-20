import { IsUUID, IsOptional, IsString, IsObject } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TriggerHealingDto {
  @ApiProperty({
    description: "UUID of the failed TestResult to heal",
    example: "c7b3d8e0-1234-5678-90ab-cdef12345678",
  })
  @IsUUID()
  testResultId!: string;

  @ApiPropertyOptional({
    description: "Target URL where the locator failure occurred (optional override)",
    example: "https://www.saucedemo.com/inventory.html",
  })
  @IsOptional()
  @IsString()
  targetUrl?: string;

  @ApiPropertyOptional({
    description: "Specific locator that failed (optional override)",
    example: "button[data-test='add-to-cart']",
  })
  @IsOptional()
  @IsString()
  failedLocator?: string;
}

export class CaptureDomDto {
  @ApiPropertyOptional({
    description: "Page UUID to re-crawl",
  })
  @IsOptional()
  @IsUUID()
  pageId?: string;

  @ApiPropertyOptional({
    description: "Target URL to capture fresh DOM from",
    example: "https://www.saucedemo.com/inventory.html",
  })
  @IsOptional()
  @IsString()
  targetUrl?: string;

  @ApiPropertyOptional({
    description: "Environment UUID for credentials and baseUrl context",
  })
  @IsOptional()
  @IsUUID()
  environmentId?: string;

  @ApiPropertyOptional({
    description: "TestResult UUID to resolve page and failure context from",
  })
  @IsOptional()
  @IsUUID()
  testResultId?: string;
}

export class CompareFingerprintDto {
  @ApiPropertyOptional({
    description: "Page UUID holding historical element fingerprints",
  })
  @IsOptional()
  @IsUUID()
  pageId?: string;

  @ApiPropertyOptional({
    description: "TestResult UUID to load failure context and page from",
  })
  @IsOptional()
  @IsUUID()
  testResultId?: string;

  @ApiPropertyOptional({
    description: "The broken locator that failed in the test",
    example: "button[data-test='add-to-cart']",
  })
  @IsOptional()
  @IsString()
  brokenLocator?: string;

  @ApiPropertyOptional({
    description: "Old element ID from page_elements if already known",
  })
  @IsOptional()
  @IsUUID()
  elementId?: string;

  @ApiPropertyOptional({
    description: "Target URL to capture fresh DOM if not provided via result",
    example: "https://www.saucedemo.com/inventory.html",
  })
  @IsOptional()
  @IsString()
  targetUrl?: string;
}

export class GenerateCandidatesDto {
  @ApiPropertyOptional({
    description: "PageElement UUID to generate candidates for",
  })
  @IsOptional()
  @IsUUID()
  elementId?: string;

  @ApiPropertyOptional({
    description: "Raw element object to generate candidates for",
  })
  @IsOptional()
  @IsObject()
  element?: Record<string, any>;
}
