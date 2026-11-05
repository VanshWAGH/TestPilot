import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

export class ScenarioQueryDto {
  @ApiPropertyOptional({
    description: "Filter scenarios by page UUID",
  })
  @IsOptional()
  @IsUUID("4")
  pageId?: string;

  @ApiPropertyOptional({
    description: "Filter scenarios by status",
    enum: ["pending", "approved", "rejected"],
  })
  @IsOptional()
  @IsIn(["pending", "approved", "rejected"])
  status?: string;

  @ApiPropertyOptional({
    description: "Filter scenarios by test type",
    enum: ["smoke", "functional", "form_validation", "navigation", "api", "visual", "accessibility"],
  })
  @IsOptional()
  @IsIn(["smoke", "functional", "form_validation", "navigation", "api", "visual", "accessibility"])
  type?: string;

  @ApiPropertyOptional({
    description: "Filter scenarios by risk level",
    enum: ["low", "medium", "high"],
  })
  @IsOptional()
  @IsIn(["low", "medium", "high"])
  riskLevel?: string;

  @ApiPropertyOptional({
    description: "Search keyword matching title or preconditions",
  })
  @IsOptional()
  @IsString()
  search?: string;
}

