import { describe, it, expect } from '@jest/globals';
import sharp from 'sharp';
import { generateCardBuffer } from './card-generator.js';

declare const require: NodeRequire;

describe('card-generator', () => {
  it('generates a non-empty PNG with the expected dimensions', async () => {
    const buffer = await generateCardBuffer(
      {
        membershipId: 'MEM-TEST1234',
        memberName: 'Test Member',
        membershipTypeName: 'Free Membership',
        isFree: true,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2124-01-01'),
        dependantsCount: 0,
        qrValue: 'https://kentslsc.org/membership/verify/MEM-TEST1234'
      },
      (file) => require.resolve(`@fontsource/inter/files/${file}`)
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(1050);
    expect(metadata.height).toBe(600);
    expect(metadata.format).toBe('png');
  });

  it('generates a valid card for a very long member name', async () => {
    const buffer = await generateCardBuffer(
      {
        membershipId: 'MEM-LONGNAME',
        memberName: 'Rukmal Vitharana Arachchilage',
        membershipTypeName: 'Free Membership',
        isFree: true,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2124-01-01'),
        dependantsCount: 0,
        qrValue: 'https://kentslsc.org/membership/verify/MEM-LONGNAME'
      },
      (file) => require.resolve(`@fontsource/inter/files/${file}`)
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(1050);
    expect(metadata.height).toBe(600);
    expect(metadata.format).toBe('png');
  });
});
