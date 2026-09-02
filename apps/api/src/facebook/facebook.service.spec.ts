import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FacebookService } from './facebook.service.js';

const mockConfig = (values: Record<string, string | undefined>) => ({
  get: jest.fn((key: string) => values[key])
});

describe('FacebookService', () => {
  let service: FacebookService;
  let mockPrisma: any;
  let config: any;
  let fetchSpy: any;

  beforeEach(() => {
    mockPrisma = {
      externalSocialPost: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'fb_1',
            message: 'Hello from Facebook',
            created_time: '2026-08-01T10:00:00+0000',
            full_picture: 'https://fbcdn.net/pic1.jpg',
            permalink_url: 'https://facebook.com/kentslsc/posts/1'
          }
        ]
      })
    } as unknown as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns not configured when credentials are missing', () => {
    config = mockConfig({});
    service = new FacebookService(config, mockPrisma);
    expect(service.isConfigured()).toBe(false);
  });

  it('returns configured when both credentials are present', () => {
    config = mockConfig({ FACEBOOK_PAGE_ID: '123', FACEBOOK_PAGE_ACCESS_TOKEN: 'token' });
    service = new FacebookService(config, mockPrisma);
    expect(service.isConfigured()).toBe(true);
  });

  it('syncs posts from Facebook into the database', async () => {
    config = mockConfig({ FACEBOOK_PAGE_ID: '123', FACEBOOK_PAGE_ACCESS_TOKEN: 'token' });
    service = new FacebookService(config, mockPrisma);

    const result = await service.sync();

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(mockPrisma.externalSocialPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalId: 'fb_1',
        source: 'facebook',
        content: 'Hello from Facebook',
        imageUrl: 'https://fbcdn.net/pic1.jpg',
        url: 'https://facebook.com/kentslsc/posts/1'
      })
    });
  });

  it('falls back to story when message is missing', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'fb_2',
            story: 'Kent SLSC shared a photo.',
            created_time: '2026-08-02T10:00:00+0000',
            permalink_url: 'https://facebook.com/kentslsc/posts/2'
          }
        ]
      })
    } as unknown as Response);

    config = mockConfig({ FACEBOOK_PAGE_ID: '123', FACEBOOK_PAGE_ACCESS_TOKEN: 'token' });
    service = new FacebookService(config, mockPrisma);

    await service.sync();

    expect(mockPrisma.externalSocialPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalId: 'fb_2',
        content: 'Kent SLSC shared a photo.'
      })
    });
  });

  it('skips sync when credentials are not configured', async () => {
    config = mockConfig({});
    service = new FacebookService(config, mockPrisma);

    const result = await service.sync();

    expect(result.created).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
