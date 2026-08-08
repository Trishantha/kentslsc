import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
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

  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient | null) {}

  onModuleInit() {
    this.bucketName = process.env.SUPABASE_BUCKET ?? 'KentSLSC';
  }

  get isConfigured(): boolean {
    return this.supabase !== null;
  }

  async upload(file: Express.Multer.File): Promise<UploadedFileResult> {
    if (!this.supabase) {
      throw new Error('Supabase is not configured');
    }

    const unique = nanoid(16);
    const ext = extname(file.originalname).toLowerCase() || '';
    const path = `${unique}${ext}`;

    const { error } = await this.supabase.storage.from(this.bucketName).upload(path, file.buffer, {
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
