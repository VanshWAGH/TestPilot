import { IsUUID, IsOptional, IsString } from "class-validator";
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
