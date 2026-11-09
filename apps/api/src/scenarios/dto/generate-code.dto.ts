import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";

export class GenerateCodeDto {
  @ApiPropertyOptional({
    description: "Specific scenario UUIDs to generate code for. If omitted, generates for all approved scenarios.",
    type: [String],
    example: ["123e4567-e89b-12d3-a456-426614174000"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  scenarioIds?: string[];

  @ApiPropertyOptional({
    description: "Whether to only generate code for scenarios with status 'approved'.",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  onlyApproved?: boolean = true;

  @ApiPropertyOptional({
    description: "OpenRouter LLM model override (defaults to code_generation cascade: qwen/qwen-2.5-coder-32b-instruct:free).",
    example: "qwen/qwen-2.5-coder-32b-instruct:free",
  })
  @IsOptional()
  @IsString()
  model?: string;
}
