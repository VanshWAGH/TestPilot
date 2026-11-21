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

export class ScoreCandidatesDto {
  @ApiProperty({
    description: "Array of candidate locators to score",
  })
  @IsObject({ each: true })
  candidates!: Record<string, any>[];

  @ApiPropertyOptional({
    description: "Page UUID to evaluate element uniqueness and DOM subtree",
  })
  @IsOptional()
  @IsUUID()
  pageId?: string;

  @ApiPropertyOptional({
    description: "Fresh DOM elements array for offline context evaluation",
  })
  @IsOptional()
  elements?: Record<string, any>[];

  @ApiPropertyOptional({
    description: "Original/expected DOM path to evaluate subtree proximity",
  })
  @IsOptional()
  @IsString()
  originalDomPath?: string;
}

export class TieBreakCandidatesDto {
  @ApiProperty({
    description: "Array of scored candidate locators",
  })
  @IsObject({ each: true })
  scoredCandidates!: Record<string, any>[];

  @ApiPropertyOptional({
    description: "Original broken locator",
    example: "button[data-test='add-to-cart']",
  })
  @IsOptional()
  @IsString()
  brokenLocator?: string;

  @ApiPropertyOptional({
    description: "Error message from test failure",
  })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({
    description: "Relevant DOM context snippet around the element",
  })
  @IsOptional()
  @IsString()
  domSnippet?: string;
}

export class ValidateCandidatesDto {
  @ApiProperty({
    description: "Array of scored candidate locators to probe on the live page",
  })
  @IsObject({ each: true })
  scoredCandidates!: Record<string, any>[];

  @ApiProperty({
    description: "Target URL to navigate to for locator probing",
    example: "https://www.saucedemo.com/inventory.html",
  })
  @IsString()
  targetUrl!: string;

  @ApiPropertyOptional({
    description: "Environment UUID for auth credentials",
  })
  @IsOptional()
  @IsUUID()
  environmentId?: string;

  @ApiPropertyOptional({
    description: "TestResult UUID to infer credentials from",
  })
  @IsOptional()
  @IsUUID()
  testResultId?: string;
}

export class CreateProposalDto {
  @ApiProperty({
    description: "TestResult UUID this proposal is for",
  })
  @IsUUID()
  testResultId!: string;

  @ApiProperty({
    description: "The broken/old locator from the failing test",
    example: "button[data-test='add-to-cart']",
  })
  @IsString()
  oldLocator!: string;

  @ApiPropertyOptional({
    description: "PageElement UUID if matched in page_elements table",
  })
  @IsOptional()
  @IsUUID()
  elementId?: string;

  @ApiProperty({
    description: "Full validation result with all validated candidates",
  })
  @IsObject()
  validationResult!: Record<string, any>;

  @ApiPropertyOptional({
    description: "Whether LLM was used in tie-breaking",
  })
  @IsOptional()
  llmUsed?: boolean;

  @ApiPropertyOptional({
    description: "Scoring details JSON (for scoringDetails column)",
  })
  @IsOptional()
  @IsObject()
  scoringDetails?: Record<string, any>;

  @ApiPropertyOptional({
    description: "URL of old screenshot (from last crawl snapshot)",
  })
  @IsOptional()
  @IsString()
  oldScreenshotUrl?: string;

  @ApiPropertyOptional({
    description: "URL of new screenshot captured during DOM recapture",
  })
  @IsOptional()
  @IsString()
  newScreenshotUrl?: string;
}
