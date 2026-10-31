import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { StorageService } from "./storage.service";
import { AuthGuard } from "../auth/auth.guard";
import { Public } from "../auth/public.decorator";

class PresignedDownloadDto {
  path!: string;
  expiresInSeconds?: number;
  bucket?: string;
}

class PresignedUploadDto {
  path!: string;
  bucket?: string;
}

@ApiTags("Storage")
@Controller("storage")
@UseGuards(AuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Public()
  @Get("status")
  @ApiOperation({ summary: "Get storage provider status" })
  @ApiResponse({ status: 200, description: "Storage service status" })
  getStatus() {
    return {
      provider: this.storageService.isFallbackMode() ? "local_fallback" : "supabase",
      defaultBucket: process.env.SUPABASE_STORAGE_BUCKET || "testpilot-artifacts",
      isFreeTier: true,
    };
  }

  @ApiBearerAuth()
  @Post("presigned-download-url")
  @ApiOperation({ summary: "Get presigned download URL for an artifact" })
  async getPresignedDownloadUrl(@Body() body: PresignedDownloadDto) {
    return this.storageService.getPresignedDownloadUrl(
      body.path,
      body.expiresInSeconds,
      body.bucket
    );
  }

  @ApiBearerAuth()
  @Post("presigned-upload-url")
  @ApiOperation({ summary: "Get presigned upload URL for direct artifact upload" })
  async getPresignedUploadUrl(@Body() body: PresignedUploadDto) {
    return this.storageService.getPresignedUploadUrl(body.path, body.bucket);
  }
}
