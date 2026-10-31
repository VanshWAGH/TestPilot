export interface UploadOptions {
  bucket?: string;
  contentType?: string;
  upsert?: boolean;
}

export interface UploadResult {
  path: string;
  bucket: string;
  publicUrl?: string;
  sizeBytes: number;
}

export interface PresignedUrlResult {
  signedUrl: string;
  expiresInSeconds: number;
}

export interface PresignedUploadResult {
  signedUrl: string;
  token?: string;
  path: string;
}
