import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Inject,
  ServiceUnavailableException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { open, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { SupabaseStorageService } from '../core/supabase/supabase.service.js';

type MediaKind = 'image' | 'video';

interface MediaTypeConfig {
  kind: MediaKind;
  extensions: string[];
  maxBytes: number;
}

const MEDIA_TYPES = {
  'image/jpeg': { kind: 'image', extensions: ['.jpg', '.jpeg'], maxBytes: 5 * 1024 * 1024 },
  'image/png': { kind: 'image', extensions: ['.png'], maxBytes: 5 * 1024 * 1024 },
  'image/gif': { kind: 'image', extensions: ['.gif'], maxBytes: 5 * 1024 * 1024 },
  'image/webp': { kind: 'image', extensions: ['.webp'], maxBytes: 5 * 1024 * 1024 },
  'video/mp4': { kind: 'video', extensions: ['.mp4'], maxBytes: 100 * 1024 * 1024 },
  'video/webm': { kind: 'video', extensions: ['.webm'], maxBytes: 100 * 1024 * 1024 },
  'video/ogg': { kind: 'video', extensions: ['.ogg', '.ogv'], maxBytes: 100 * 1024 * 1024 }
} satisfies Record<string, MediaTypeConfig>;

const ALLOWED_IMAGE_TYPES = (Object.keys(MEDIA_TYPES) as Array<keyof typeof MEDIA_TYPES>).filter(
  (m) => MEDIA_TYPES[m].kind === 'image'
);
const ALLOWED_VIDEO_TYPES = (Object.keys(MEDIA_TYPES) as Array<keyof typeof MEDIA_TYPES>).filter(
  (m) => MEDIA_TYPES[m].kind === 'video'
);
const ALLOWED_MIME_TYPES = new Set(Object.keys(MEDIA_TYPES));

const MAX_FILE_SIZE = Math.max(...Object.values(MEDIA_TYPES).map((t) => t.maxBytes));
const UPLOAD_TMP_DIR = join(tmpdir(), 'kentslsc-uploads');

mkdirSync(UPLOAD_TMP_DIR, { recursive: true });

function formatMaxSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes / (1024 * 1024)} MB`;
}

function getMediaConfig(mime: string): MediaTypeConfig | undefined {
  return (MEDIA_TYPES as Record<string, MediaTypeConfig>)[mime];
}

async function readSignatureBytes(file: Express.Multer.File, length = 16): Promise<Buffer> {
  if (file.buffer?.length) {
    return file.buffer.subarray(0, length);
  }
  if (!file.path) {
    return Buffer.alloc(0);
  }

  const handle = await open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function isValidImage(file: Express.Multer.File): Promise<boolean> {
  const config = getMediaConfig(file.mimetype);
  if (!config || config.kind !== 'image') {
    return false;
  }
  const extension = extname(file.originalname).toLowerCase();
  if (!config.extensions.includes(extension)) {
    return false;
  }
  const buf = await readSignatureBytes(file, 16);
  if (!buf || buf.length < 12) {
    return false;
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return file.mimetype === 'image/jpeg';
  }
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return file.mimetype === 'image/png';
  }
  // GIF
  const signature = buf.toString('ascii', 0, 6);
  if (signature === 'GIF87a' || signature === 'GIF89a') {
    return file.mimetype === 'image/gif';
  }
  // WebP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return file.mimetype === 'image/webp';
  }
  return false;
}

async function isValidVideo(file: Express.Multer.File): Promise<boolean> {
  const config = getMediaConfig(file.mimetype);
  if (!config || config.kind !== 'video') {
    return false;
  }
  const extension = extname(file.originalname).toLowerCase();
  if (!config.extensions.includes(extension)) {
    return false;
  }
  const buf = await readSignatureBytes(file, 16);
  if (!buf || buf.length < 12) {
    return false;
  }
  // MP4: 4-byte size followed by 'ftyp'
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    return file.mimetype === 'video/mp4';
  }
  // WebM: EBML header
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return file.mimetype === 'video/webm';
  }
  // Ogg
  if (buf.toString('ascii', 0, 4) === 'OggS') {
    return file.mimetype === 'video/ogg';
  }
  return false;
}

async function validateFile(file: Express.Multer.File): Promise<MediaKind> {
  const config = getMediaConfig(file.mimetype);
  if (!config) {
    throw new BadRequestException(
      `File type ${file.mimetype} is not allowed. ` +
        `Allowed images: ${ALLOWED_IMAGE_TYPES.join(', ')}. ` +
        `Allowed videos: ${ALLOWED_VIDEO_TYPES.join(', ')}.`
    );
  }

  if (file.size > config.maxBytes) {
    throw new BadRequestException(
      `${config.kind === 'image' ? 'Image' : 'Video'} exceeds maximum size of ${formatMaxSize(config.maxBytes)}.`
    );
  }

  if (config.kind === 'image' && !(await isValidImage(file))) {
    throw new BadRequestException('Invalid or unsupported image file');
  }

  if (config.kind === 'video' && !(await isValidVideo(file))) {
    throw new BadRequestException('Invalid or unsupported video file');
  }

  return config.kind;
}

@Controller('uploads')
export class UploadsController {
  constructor(
    @Inject(SupabaseStorageService) private readonly supabaseStorage: SupabaseStorageService
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: UPLOAD_TMP_DIR }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `File type ${file.mimetype} is not allowed. ` +
                `Allowed images: ${ALLOWED_IMAGE_TYPES.join(', ')}. ` +
                `Allowed videos: ${ALLOWED_VIDEO_TYPES.join(', ')}.`
            ),
            false
          );
        }
      }
    })
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    await validateFile(file);

    if (!this.supabaseStorage.isConfigured) {
      throw new ServiceUnavailableException(
        'Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in the API environment.'
      );
    }

    try {
      const { url, path } = await this.supabaseStorage.upload(file);
      return { url, path };
    } finally {
      if (file.path) {
        await unlink(file.path).catch(() => undefined);
      }
    }
  }
}
