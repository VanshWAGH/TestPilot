import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from "class-validator";

export class GeneratePlaywrightConfigDto {
  @ApiPropertyOptional({
    description: "Override base URL for Playwright tests",
    example: "https://www.saucedemo.com",
  })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional({
    description: "Global test timeout in milliseconds",
    example: 30000,
    default: 30000,
  })
  @IsOptional()
  @IsInt()
  @Min(5000)
  @Max(120000)
  timeout?: number;

  @ApiPropertyOptional({
    description: "Expect assertion timeout in milliseconds",
    example: 5000,
    default: 5000,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(30000)
  expectTimeout?: number;

  @ApiPropertyOptional({
    description: "List of browser configurations to run against",
    example: ["chromium", "firefox", "webkit"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  browsers?: string[];

  @ApiPropertyOptional({
    description: "Whether to enable auth setup project dependency",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enableAuthSetup?: boolean;

  @ApiPropertyOptional({
    description: "Trace recording mode",
    enum: ["on", "off", "retain-on-failure", "on-first-retry"],
    default: "retain-on-failure",
  })
  @IsOptional()
  @IsIn(["on", "off", "retain-on-failure", "on-first-retry"])
  captureTrace?: "on" | "off" | "retain-on-failure" | "on-first-retry";

  @ApiPropertyOptional({
    description: "Screenshot capture mode",
    enum: ["on", "off", "only-on-failure"],
    default: "only-on-failure",
  })
  @IsOptional()
  @IsIn(["on", "off", "only-on-failure"])
  captureScreenshot?: "on" | "off" | "only-on-failure";

  @ApiPropertyOptional({
    description: "Video recording mode",
    enum: ["on", "off", "retain-on-failure", "on-first-retry"],
    default: "retain-on-failure",
  })
  @IsOptional()
  @IsIn(["on", "off", "retain-on-failure", "on-first-retry"])
  captureVideo?: "on" | "off" | "retain-on-failure" | "on-first-retry";
}
