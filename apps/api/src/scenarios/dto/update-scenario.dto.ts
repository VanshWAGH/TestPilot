import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateScenarioDto {
  @ApiPropertyOptional({
    description: "Scenario title",
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: "Scenario status",
    enum: ["pending", "approved", "rejected"],
  })
  @IsOptional()
  @IsIn(["pending", "approved", "rejected"])
  status?: string;

  @ApiPropertyOptional({
    description: "Scenario risk level",
    enum: ["low", "medium", "high"],
  })
  @IsOptional()
  @IsIn(["low", "medium", "high"])
  riskLevel?: string;

  @ApiPropertyOptional({
    description: "Scenario test type",
    enum: ["smoke", "functional", "form_validation", "navigation", "api", "visual", "accessibility"],
  })
  @IsOptional()
  @IsIn(["smoke", "functional", "form_validation", "navigation", "api", "visual", "accessibility"])
  type?: string;

  @ApiPropertyOptional({
    description: "Preconditions array (JSON)",
  })
  @IsOptional()
  preconditions?: any;

  @ApiPropertyOptional({
    description: "Steps array (JSON)",
  })
  @IsOptional()
  steps?: any;

  @ApiPropertyOptional({
    description: "Assertions array (JSON)",
  })
  @IsOptional()
  assertions?: any;

  @ApiPropertyOptional({
    description: "Test data object (JSON)",
  })
  @IsOptional()
  testData?: any;
}

