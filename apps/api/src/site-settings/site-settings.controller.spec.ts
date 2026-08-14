import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ValidationPipe } from '@nestjs/common';
import { SiteSettingsController } from './site-settings.controller.js';
import { SiteSettingsService } from './site-settings.service.js';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto.js';

const mockSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'info@kentslsc.org',
  phone: '+44 1234 567890',
  whatsapp: '',
  address: 'Kent SLSC',
  facebook: 'https://facebook.com/kentslsc',
  instagram: '',
  twitter: '',
  youtube: '',
  linkedin: '',
  tiktok: '',
  showPageLoader: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe('SiteSettingsController', () => {
  let controller: SiteSettingsController;
  let service: Pick<SiteSettingsService, 'get' | 'update'>;

  beforeEach(() => {
    service = {
      get: jest.fn(() => Promise.resolve(mockSettings)) as any,
      update: jest.fn(() => Promise.resolve(mockSettings)) as any
    };
    controller = new SiteSettingsController(service as SiteSettingsService);
  });

  it('returns site settings', async () => {
    const result = await controller.get();
    expect(service.get).toHaveBeenCalled();
    expect(result).toEqual(mockSettings);
  });

  it('passes all update fields through the ValidationPipe to the service', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const payload = {
      email: 'new@kentslsc.org',
      phone: '+44 9999 999999',
      whatsapp: '',
      address: 'New Address',
      facebook: 'https://facebook.com/new',
      instagram: '',
      twitter: '',
      youtube: '',
      linkedin: '',
      tiktok: '',
      showPageLoader: false
    };

    const dto = (await pipe.transform(payload, { type: 'body', metatype: UpdateSiteSettingsDto })) as UpdateSiteSettingsDto;

    expect(dto).toMatchObject(payload);
    await controller.update(dto);
    expect(service.update).toHaveBeenCalledWith(expect.objectContaining(payload));
  });
});
