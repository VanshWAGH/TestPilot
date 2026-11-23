import { IsString, IsBoolean, IsOptional } from "class-validator";

export class VerificationResultDto {
  @IsString()
  defectId: string;

  @IsString()
  defectTag: string;

  @IsString()
  workflowRunId: string;

  @IsBoolean()
  passed: boolean;

  @IsOptional()
  @IsString()
  reportUrl?: string;
}
