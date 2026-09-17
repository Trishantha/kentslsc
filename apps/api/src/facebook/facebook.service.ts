import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@kentslsc/database';
import { PrismaService } from '../core/prisma/prisma.service.js';
import type { EnvConfig } from '../core/config/env.validation.js';

interface FacebookPost {
  id: string;
  message?: string;
  createdTime: string;
  fullPicture?: string;
  permalinkUrl: string;
}

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.get('FACEBOOK_PAGE_ID', { infer: true })) &&
      Boolean(this.config.get('FACEBOOK_PAGE_ACCESS_TOKEN', { infer: true }));
  }

  async sync(): Promise<{ created: number; updated: number; deleted: number }> {
    const pageId = this.config.get('FACEBOOK_PAGE_ID', { infer: true });
    const token = this.config.get('FACEBOOK_PAGE_ACCESS_TOKEN', { infer: true });

    if (!pageId || !token) {
      this.logger.log('Facebook credentials not configured; skipping sync.');
      return { created: 0, updated: 0, deleted: 0 };
    }

    const fields = encodeURIComponent(
      'id,message,created_time,full_picture,permalink_url,attachments{media_type,url,title,description,media}'
    );
    const url = `https://graph.facebook.com/v21.0/${pageId}/posts?access_token=${token}&fields=${fields}&limit=50`;

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Facebook Graph API error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { data?: unknown[] };
    const rawPosts = Array.isArray(data.data) ? data.data : [];
    const posts = rawPosts.map((raw) => this.normalizePost(raw)).filter((p): p is FacebookPost => p !== null);

    const existingIds = new Set(
      (
        await this.prisma.externalSocialPost.findMany({
          where: { source: 'facebook' },
          select: { externalId: true }
        })
      ).map((e) => e.externalId)
    );

    let created = 0;
    let updated = 0;
    const seenIds = new Set<string>();

    for (const post of posts) {
      seenIds.add(post.id);
      const rawPost = rawPosts.find((r) => this.extractId(r) === post.id);
      const payload = {
        source: 'facebook' as const,
        title: null,
        content: post.message ?? null,
        imageUrl: post.fullPicture ?? null,
        url: post.permalinkUrl,
        publishedAt: new Date(post.createdTime),
        rawData: rawPost ? (rawPost as Prisma.InputJsonValue) : undefined
      };

      if (existingIds.has(post.id)) {
        await this.prisma.externalSocialPost.update({
          where: { externalId: post.id },
          data: payload
        });
        updated++;
      } else {
        await this.prisma.externalSocialPost.create({
          data: { externalId: post.id, ...payload }
        });
        created++;
      }
    }

    const deleted = await this.prisma.externalSocialPost.deleteMany({
      where: { source: 'facebook', externalId: { notIn: Array.from(seenIds) } }
    });

    this.logger.log(
      `Facebook sync complete: ${created} created, ${updated} updated, ${deleted.count} removed.`
    );

    return { created, updated, deleted: deleted.count };
  }

  private normalizePost(raw: unknown): FacebookPost | null {
    const id = this.extractId(raw);
    const message = this.extractString(raw, 'message') ?? this.extractString(raw, 'story');
    const createdTime = this.extractString(raw, 'created_time');
    const fullPicture = this.extractString(raw, 'full_picture');
    const permalinkUrl = this.extractString(raw, 'permalink_url');

    if (!id || !createdTime || !permalinkUrl) {
      return null;
    }

    return {
      id,
      message,
      createdTime,
      fullPicture,
      permalinkUrl
    };
  }

  private extractId(raw: unknown): string | undefined {
    if (raw && typeof raw === 'object' && 'id' in raw) {
      const value = (raw as Record<string, unknown>).id;
      return typeof value === 'string' ? value : undefined;
    }
    return undefined;
  }

  private extractString(raw: unknown, key: string): string | undefined {
    if (raw && typeof raw === 'object' && key in raw) {
      const value = (raw as Record<string, unknown>)[key];
      return typeof value === 'string' ? value : undefined;
    }
    return undefined;
  }
}
