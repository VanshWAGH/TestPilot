import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { EnvironmentTypeDto } from "./project.dto";

// ─── Credential DTOs ─────────────────────────────────────────────────────────

export class SetCredentialDto {
  @ApiPropertyOptional({ example: "standard_user", description: "Username for authentication" })
  username?: string;

  @ApiPropertyOptional({ example: "secret_sauce", description: "Password for authentication (encrypted before storage)" })
  password?: string;

  @ApiPropertyOptional({
    example: "https://www.saucedemo.com",
    description: "Target login URL for this environment",
  })
  loginUrl?: string;

  @ApiPropertyOptional({ description: "Generic key name if using key-value credentials" })
  key?: string;

  @ApiPropertyOptional({ description: "Generic value if using key-value credentials (encrypted)" })
  value?: string;

  @ApiPropertyOptional({ description: "Description or notes for this credential" })
  description?: string;
}

export class CredentialResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  environmentId!: string;

  @ApiProperty({ example: true, description: "Whether a username is configured" })
  hasUsername!: boolean;

  @ApiProperty({ example: true, description: "Whether a password is encrypted and stored" })
  hasPassword!: boolean;

  @ApiPropertyOptional({ example: "https://www.saucedemo.com", nullable: true })
  loginUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  key?: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiPropertyOptional({ format: "date-time" })
  updatedAt?: string;
}

export class EnvironmentCredentialSummaryDto {
  @ApiPropertyOptional({ format: "uuid" })
  id?: string;

  @ApiProperty({ example: true })
  hasUsername!: boolean;

  @ApiProperty({ example: true })
  hasPassword!: boolean;

  @ApiPropertyOptional({ example: "https://www.saucedemo.com", nullable: true })
  loginUrl?: string | null;
}

// ─── Environment DTOs ───────────────────────────────────────────────────────

export class CreateEnvironmentDto {
  @ApiProperty({ example: "Staging", minLength: 2, maxLength: 50 })
  name!: string;

  @ApiPropertyOptional({ enum: EnvironmentTypeDto, default: EnvironmentTypeDto.Staging })
  type?: EnvironmentTypeDto;

  @ApiProperty({ example: "https://staging.saucedemo.com" })
  baseUrl!: string;

  @ApiPropertyOptional({ default: false, description: "Set as the default target environment" })
  isDefault?: boolean;

  @ApiPropertyOptional({
    type: SetCredentialDto,
    description: "Optional credentials to immediately encrypt and attach to this environment",
  })
  credentials?: SetCredentialDto;
}

export class UpdateEnvironmentDto extends PartialType(CreateEnvironmentDto) {}

export class EnvironmentResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  projectId!: string;

  @ApiProperty({ example: "Staging" })
  name!: string;

  @ApiProperty({ enum: EnvironmentTypeDto })
  type!: EnvironmentTypeDto;

  @ApiProperty({ example: "https://staging.saucedemo.com" })
  baseUrl!: string;

  @ApiProperty({ example: false })
  isDefault!: boolean;

  @ApiProperty({ example: true, description: "Whether this environment has stored credentials" })
  hasCredentials!: boolean;

  @ApiPropertyOptional({ type: EnvironmentCredentialSummaryDto, nullable: true })
  credentials?: EnvironmentCredentialSummaryDto | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiPropertyOptional({ format: "date-time" })
  updatedAt?: string;
}
