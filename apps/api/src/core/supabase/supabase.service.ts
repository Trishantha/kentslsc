import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { nanoid } from 'nanoid';
import { extname } from 'path';
import { SUPABASE_CLIENT } from './supabase.constants.js';

export interface UploadedFileResult {
  url: string;
  path: string;
}

@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private bucketName = 'KentSLSC';
  private bucketPublic: boolean | null = null;

  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient | null) {}

  async onModuleInit() {
    this.bucketName = process.env.SUPABASE_BUCKET ?? 'KentSLSC';

    if (!this.supabase) {
      this.logger.warn(
        'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing). Uploads will fail.'
      );
      return;
    }

    try {
      const { data: bucket, error } = await this.supabase.storage.getBucket(this.bucketName);
      if (error) {
        this.logger.error(
          `Supabase bucket "${this.bucketName}" is not accessible: ${error.message}. ` +
            'Create it in the Supabase dashboard and run scripts/setup-supabase-storage.sql.'
        );
        return;
      }
      this.bucketPublic = bucket.public;
      if (!bucket.public) {
        this.logger.warn(
          `Supabase bucket "${this.bucketName}" is not public. Public file URLs will not work.`
        );
      } else {
        this.logger.log(`Supabase bucket "${this.bucketName}" is configured and public.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to verify Supabase bucket "${this.bucketName}": ${message}`);
    }
  }

  get isConfigured(): boolean {
    return this.supabase !== null;
  }

  get isPublic(): boolean | null {
    return this.bucketPublic;
  }

  private get publicUrlPrefix(): string {
    const baseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    if (!baseUrl) return '';
    return `${baseUrl}/storage/v1/object/public/${this.bucketName}/`;
  }

  extractPathFromPublicUrl(publicUrl: string): string | null {
    const prefix = this.publicUrlPrefix;
    if (!prefix || !publicUrl.startsWith(prefix)) return null;
    const encodedPath = publicUrl.slice(prefix.length);
    try {
      return decodeURIComponent(encodedPath);
    } catch {
      return encodedPath;
    }
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured');
    }

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      this.logger.error(`Failed to create signed URL: ${error.message}`);
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  async getSignedUrlForPublicUrl(
    publicUrl: string,
    expiresInSeconds = 3600
  ): Promise<string | null> {
    const path = this.extractPathFromPublicUrl(publicUrl);
    if (!path) return null;
    try {
      return await this.getSignedUrl(path, expiresInSeconds);
    } catch {
      return null;
    }
  }

  async upload(file: Express.Multer.File): Promise<UploadedFileResult> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured');
    }

    const unique = nanoid(16);
    const ext = extname(file.originalname).toLowerCase() || '';
    const path = `${unique}${ext}`;

    const body = file.buffer?.length ? file.buffer : createReadStream(file.path);

    const { error } = await this.supabase.storage.from(this.bucketName).upload(path, body, {
      contentType: file.mimetype,
      upsert: false
    });

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const {
      data: { publicUrl }
    } = this.supabase.storage.from(this.bucketName).getPublicUrl(path);

    return { url: publicUrl, path };
  }

  async delete(path: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured');
    }

    const { error } = await this.supabase.storage.from(this.bucketName).remove([path]);
    if (error) {
      this.logger.error(`Supabase delete failed: ${error.message}`);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  async uploadBuffer(options: {
    buffer: Buffer;
    path: string;
    contentType: string;
    upsert?: boolean;
  }): Promise<UploadedFileResult> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured');
    }

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(options.path, options.buffer, {
        contentType: options.contentType,
        upsert: options.upsert ?? false
      });

    if (error) {
      this.logger.error(`Supabase buffer upload failed: ${error.message}`);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const {
      data: { publicUrl }
    } = this.supabase.storage.from(this.bucketName).getPublicUrl(options.path);

    return { url: publicUrl, path: options.path };
  }
}
