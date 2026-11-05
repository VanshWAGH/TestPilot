import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional, IsString, IsUUID } from "class-validator";

export class BatchApproveScenariosDto {
  @ApiProperty({
    description: "Array of scenario UUIDs to approve or reject",
    type: [String],
    example: ["123e4567-e89b-12d3-a456-426614174000"],
  })
  @IsArray()
  @IsUUID("4", { each: true })
  scenarioIds: string[];

  @ApiProperty({
    description: "Action to perform on the specified scenarios",
    enum: ["approve", "reject"],
    example: "approve",
  })
  @IsIn(["approve", "reject"])
  action: "approve" | "reject";

  @ApiPropertyOptional({
    description: "Optional review note or rejection reason",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

