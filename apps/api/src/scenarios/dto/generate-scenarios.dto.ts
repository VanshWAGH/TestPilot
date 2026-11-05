import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class GenerateScenariosDto {
  @ApiPropertyOptional({
    description: "Specific page UUIDs to generate scenarios for. If empty or omitted, generates for all pages in project.",
    type: [String],
    example: ["123e4567-e89b-12d3-a456-426614174000"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  pageIds?: string[];

  @ApiPropertyOptional({
    description: "OpenRouter LLM model to use (e.g., 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o'). Defaults to system env LLM_MODEL.",
    example: "anthropic/claude-3.5-sonnet",
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: "Maximum number of scenarios to generate per page (1 to 20).",
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxScenariosPerPage?: number = 5;

  @ApiPropertyOptional({
    description: "Target test scenario types to focus on.",
    type: [String],
    example: ["smoke", "functional", "form_validation", "navigation", "accessibility", "visual"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  testTypes?: string[];
}

