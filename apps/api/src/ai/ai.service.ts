import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../core/redis/redis.service.js';
import { PrismaService } from '../core/prisma/prisma.service.js';

export type RecommendType = 'events' | 'fundraisers' | 'topics' | 'businesses';

export interface RecommendParams {
  type: RecommendType;
  userId?: string;
  limit?: number;
}

export interface SearchParams {
  query: string;
  limit?: number;
}

@Injectable()
export class AiService {
  private client: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService
  ) {
    this.client = new OpenAI({ apiKey: configService.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async summarise(content: string, type: string, maxLength = 150): Promise<string> {
    const cacheKey = `ai:summary:${type}:${Buffer.from(content).toString('base64').slice(0, 32)}`;
    const cached = await this.redis.get<string>(cacheKey);
    if (cached) return cached;
    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Summarise this ${type} in ${maxLength} characters or fewer.` },
        { role: 'user', content }
      ],
      max_tokens: Math.ceil(maxLength / 2) + 20
    });
    const result = completion.choices[0]?.message?.content?.trim() ?? '';
    await this.redis.set(cacheKey, result, 24 * 60 * 60);
    return result;
  }

  async moderate(content: string): Promise<{ flagged: boolean; reason?: string }> {
    const result = await this.client.moderations.create({ input: content });
    const flagged = result.results[0]?.flagged ?? false;
    return { flagged, reason: flagged ? 'OpenAI moderation flagged this content.' : undefined };
  }

  async welcome(name: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Write a warm, personalised welcome message for a new member of the Kent Sri Lankan Social Club.' },
        { role: 'user', content: `Name: ${name}` }
      ],
      max_tokens: 200
    });
    return completion.choices[0]?.message?.content?.trim() ?? `Welcome, ${name}!`;
  }

  async answerFaq(message: string): Promise<string | null> {
    const cacheKey = `ai:faq:${Buffer.from(message).toString('base64').slice(0, 32)}`;
    const cached = await this.redis.get<string>(cacheKey);
    if (cached) return cached;

    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant for the Kent Sri Lankan Social Club. Answer the question briefly and warmly in 1-2 sentences. If you do not know, say you will pass it to the committee.'
        },
        { role: 'user', content: message }
      ],
      max_tokens: 150
    });

    const result = completion.choices[0]?.message?.content?.trim() ?? null;
    if (result) {
      await this.redis.set(cacheKey, result, 24 * 60 * 60);
    }
    return result;
  }

  async recommend({ type, userId, limit = 5 }: RecommendParams) {
    switch (type) {
      case 'events':
        return this.recommendEvents(userId, limit);
      case 'fundraisers':
        return this.recommendFundraisers(limit);
      case 'topics':
        return this.recommendTopics(limit);
      case 'businesses':
        return this.recommendBusinesses(limit);
      default:
        return [];
    }
  }

  private async recommendEvents(userId?: string, limit = 5) {
    const excludeIds: string[] = [];
    if (userId) {
      const attended = await this.prisma.ticket.findMany({
        where: { userId, deletedAt: null },
        select: { eventId: true }
      });
      excludeIds.push(...attended.map((t) => t.eventId));
    }

    return this.prisma.event.findMany({
      where: {
        isPublished: true,
        deletedAt: null,
        startDatetime: { gte: new Date() },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {})
      },
      orderBy: { startDatetime: 'asc' },
      take: limit
    });
  }

  private async recommendFundraisers(limit = 5) {
    const now = new Date();
    return this.prisma.fundraiser.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  private async recommendTopics(limit = 5) {
    return this.prisma.forumTopic.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { posts: { where: { deletedAt: null } } } }
      }
    });
  }

  private async recommendBusinesses(limit = 5) {
    const now = new Date();
    const listings = await this.prisma.businessListing.findMany({
      where: { deletedAt: null },
      orderBy: [{ isPromoted: 'desc' }, { promotedUntil: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        _count: { select: { jobAds: { where: { deletedAt: null, isPublished: true } } } }
      }
    });

    return listings.map((listing) => ({
      ...listing,
      isPromoted: listing.isPromoted && !!listing.promotedUntil && listing.promotedUntil > now
    }));
  }

  async search({ query, limit = 10 }: SearchParams) {
    const term = query.trim();
    if (!term) return [];

    const [events, fundraisers, businesses, blogPosts, topics] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          isPublished: true,
          deletedAt: null,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { location: { contains: term, mode: 'insensitive' } }
          ]
        },
        orderBy: { startDatetime: 'desc' },
        take: limit
      }),
      this.prisma.fundraiser.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      }),
      this.prisma.businessListing.findMany({
        where: {
          deletedAt: null,
          OR: [
            { businessName: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { servicesText: { contains: term, mode: 'insensitive' } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      }),
      this.prisma.blogPost.findMany({
        where: {
          isPublished: true,
          deletedAt: null,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { content: { contains: term, mode: 'insensitive' } }
          ]
        },
        orderBy: { publishedAt: 'desc' },
        take: limit
      }),
      this.prisma.forumTopic.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { content: { contains: term, mode: 'insensitive' } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      })
    ]);

    const toResult = (entityType: string, id: string, title: string, excerpt: string) => ({
      entityType,
      id,
      title,
      excerpt: excerpt.slice(0, 150) + (excerpt.length > 150 ? '…' : '')
    });

    return [
      ...events.map((e) => toResult('event', e.id, e.title, e.description ?? e.location ?? '')),
      ...fundraisers.map((f) => toResult('fundraiser', f.id, f.title, f.description ?? '')),
      ...businesses.map((b) => toResult('business', b.id, b.businessName, b.description ?? b.servicesText ?? '')),
      ...blogPosts.map((b) => toResult('blog', b.id, b.title, b.content)),
      ...topics.map((t) => toResult('topic', t.id, t.title, t.content))
    ].slice(0, limit);
  }
}
