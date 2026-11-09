import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SaveGitHubInstallationDto {
  @ApiProperty({
    description: "GitHub installation ID from GitHub redirect or webhook",
    example: "12345678",
  })
  @IsString()
  @IsNotEmpty()
  installationId!: string;

  @ApiProperty({
    description: "Account login (org or username)",
    example: "VanshWAGH",
  })
  @IsString()
  @IsNotEmpty()
  accountLogin!: string;

  @ApiPropertyOptional({
    description: "Account type (User or Organization)",
    example: "User",
  })
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiPropertyOptional({
    description: "Avatar URL of the account",
  })
  @IsOptional()
  @IsString()
  accountAvatar?: string;
}
