import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  UploadOptions,
  UploadResult,
  PresignedUrlResult,
  PresignedUploadResult,
} from "./storage.types";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient | null = null;
  private readonly defaultBucket: string;
  private isLocalFallback = false;
  private localDir: string;

  constructor() {
    this.defaultBucket =
      process.env.SUPABASE_STORAGE_BUCKET || "testpilot-artifacts";
    this.localDir = path.resolve(process.cwd(), ".storage");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (
      supabaseUrl &&
      !supabaseUrl.includes("your-project") &&
      supabaseKey &&
      !supabaseKey.includes("your_supabase")
    ) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
      this.logger.log(
        `Initialized Supabase Storage client (Project: ${supabaseUrl}, Default Bucket: ${this.defaultBucket})`
      );
    } else {
      this.isLocalFallback = true;
      this.logger.warn(
        `Supabase Storage credentials not configured. Running in Local Disk Fallback mode (Storage Dir: ${this.localDir})`
      );
    }
  }

  async onModuleInit() {
    if (this.isLocalFallback) {
      if (!fs.existsSync(this.localDir)) {
        fs.mkdirSync(this.localDir, { recursive: true });
      }
    } else {
      try {
        await this.ensureBucket(this.defaultBucket, true);
      } catch (err) {
        this.logger.warn(
          `Could not verify default bucket '${this.defaultBucket}' on startup: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
      }
    }
  }

  /**
   * Verify or create the storage bucket
   */
  async ensureBucket(bucket = this.defaultBucket, isPublic = true): Promise<void> {
    if (this.isLocalFallback || !this.supabase) {
      const bucketDir = path.join(this.localDir, bucket);
      if (!fs.existsSync(bucketDir)) {
        fs.mkdirSync(bucketDir, { recursive: true });
      }
      return;
    }

    const { data: buckets, error: listError } =
      await this.supabase.storage.listBuckets();

    if (listError) {
      throw new Error(`Failed to list Supabase buckets: ${listError.message}`);
    }

    const exists = buckets?.some((b) => b.name === bucket);
    if (!exists) {
      const { error: createError } = await this.supabase.storage.createBucket(
        bucket,
        {
          public: isPublic,
          fileSizeLimit: 52428800, // 50MB per file
        }
      );
      if (createError) {
        throw new Error(
          `Failed to create Supabase bucket '${bucket}': ${createError.message}`
        );
      }
      this.logger.log(`Created Supabase storage bucket '${bucket}' (public=${isPublic})`);
    }
  }

  /**
   * Upload a file buffer or binary array
   */
  async upload(
    file: Buffer | Uint8Array,
    filePath: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const bucket = options?.bucket || this.defaultBucket;
    const contentType = options?.contentType || "application/octet-stream";
    const upsert = options?.upsert ?? true;
    const sizeBytes = file.byteLength;

    if (this.isLocalFallback || !this.supabase) {
      const targetDir = path.join(this.localDir, bucket, path.dirname(filePath));
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const fullPath = path.join(this.localDir, bucket, filePath);
      fs.writeFileSync(fullPath, Buffer.from(file));

      return {
        path: filePath,
        bucket,
        publicUrl: `file://${fullPath}`,
        sizeBytes,
      };
    }

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType,
        upsert,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    const publicUrl = this.getPublicUrl(filePath, bucket);

    return {
      path: filePath,
      bucket,
      publicUrl,
      sizeBytes,
    };
  }

  /**
   * Download a file from storage as Buffer
   */
  async download(filePath: string, bucket = this.defaultBucket): Promise<Buffer> {
    if (this.isLocalFallback || !this.supabase) {
      const fullPath = path.join(this.localDir, bucket, filePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found in local storage: ${filePath}`);
      }
      return fs.readFileSync(fullPath);
    }

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .download(filePath);

    if (error || !data) {
      throw new Error(
        `Supabase download failed for '${filePath}': ${error?.message || "No data"}`
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generate a presigned download URL
   */
  async getPresignedDownloadUrl(
    filePath: string,
    expiresInSeconds = 3600,
    bucket = this.defaultBucket
  ): Promise<PresignedUrlResult> {
    if (this.isLocalFallback || !this.supabase) {
      return {
        signedUrl: `file://${path.join(this.localDir, bucket, filePath)}`,
        expiresInSeconds,
      };
    }

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Failed to generate presigned download URL: ${error?.message || "Unknown error"}`
      );
    }

    return {
      signedUrl: data.signedUrl,
      expiresInSeconds,
    };
  }

  /**
   * Generate a presigned upload URL
   */
  async getPresignedUploadUrl(
    filePath: string,
    bucket = this.defaultBucket
  ): Promise<PresignedUploadResult> {
    if (this.isLocalFallback || !this.supabase) {
      return {
        signedUrl: `file://${path.join(this.localDir, bucket, filePath)}`,
        path: filePath,
      };
    }

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Failed to generate presigned upload URL: ${error?.message || "Unknown error"}`
      );
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: filePath,
    };
  }

  /**
   * Get public URL for an asset
   */
  getPublicUrl(filePath: string, bucket = this.defaultBucket): string {
    if (this.isLocalFallback || !this.supabase) {
      return `file://${path.join(this.localDir, bucket, filePath)}`;
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  /**
   * Delete a file from storage
   */
  async delete(filePath: string, bucket = this.defaultBucket): Promise<void> {
    if (this.isLocalFallback || !this.supabase) {
      const fullPath = path.join(this.localDir, bucket, filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return;
    }

    const { error } = await this.supabase.storage.from(bucket).remove([filePath]);
    if (error) {
      throw new Error(`Failed to delete file from Supabase: ${error.message}`);
    }
  }

  /**
   * Check if storage is running in local fallback mode
   */
  isFallbackMode(): boolean {
    return this.isLocalFallback;
  }
}
