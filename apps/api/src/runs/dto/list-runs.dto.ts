import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class ListRunsDto {
  @ApiPropertyOptional({ description: "Filter by run status" })
  @IsOptional()
  @IsEnum(["queued", "in_progress", "passed", "failed", "cancelled"])
  status?: string;

  @ApiPropertyOptional({ description: "Filter by environment ID" })
  @IsOptional()
  @IsString()
  environmentId?: string;

  @ApiPropertyOptional({ description: "Number of runs to return", default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: "Number of runs to skip (pagination)", default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
