import { IsIn, IsOptional, IsString } from "class-validator";
import { DefectSeverity } from "../defects.types";

export class OverrideSeverityDto {
  @IsIn(["critical", "high", "medium", "low"])
  severity: DefectSeverity;

  @IsOptional()
  @IsString()
  reason?: string;
}
