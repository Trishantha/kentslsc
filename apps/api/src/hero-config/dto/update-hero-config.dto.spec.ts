import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateHeroConfigDto } from './update-hero-config.dto.js';

describe('UpdateHeroConfigDto', () => {
  it('accepts relative media URLs used by the CMS', async () => {
    const dto = plainToInstance(UpdateHeroConfigDto, {
      mediaType: 'video',
      videoUrl: '/videos/kslsc-hero.webm',
      overlayStyle: 'dots',
      videoOverlayOpacity: 68,
      videoPlaybackRate: 0.5
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts absolute media URLs', async () => {
    const dto = plainToInstance(UpdateHeroConfigDto, {
      imageUrl: 'https://example.com/banner.jpg'
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid opacity values', async () => {
    const dto = plainToInstance(UpdateHeroConfigDto, {
      overlayOpacity: 150
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
