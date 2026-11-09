import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class ConnectGitHubRepoDto {
  @ApiProperty({
    description: "GitHub App Installation ID",
    example: "12345678",
  })
  @IsString()
  @IsNotEmpty()
  installationId!: string;

  @ApiProperty({
    description: "Full repository path (owner/repo)",
    example: "VanshWAGH/TestPilot-Tests",
  })
  @IsString()
  @Matches(/^[\w.-]+\/[\w.-]+$/, {
    message: "Repository must be in format 'owner/repo'",
  })
  githubTestRepo!: string;

  @ApiPropertyOptional({
    description: "Repository path for filing defect issues",
    example: "VanshWAGH/TestPilot",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[\w.-]+\/[\w.-]+$/, {
    message: "Defect repository must be in format 'owner/repo'",
  })
  githubDefectRepo?: string;

  @ApiPropertyOptional({
    description: "Default target branch for generated test suites",
    example: "main",
    default: "main",
  })
  @IsOptional()
  @IsString()
  githubBranch?: string;
}
