import { IsString, IsBoolean, IsOptional, IsIn } from "class-validator";
import { SCHEDULE_JOB_TYPES } from "../scheduling.constants";

export class UpdateScheduleDto {
  @IsOptional()
  @IsIn(Object.values(SCHEDULE_JOB_TYPES))
  jobType?: string;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  environmentId?: string;
}
