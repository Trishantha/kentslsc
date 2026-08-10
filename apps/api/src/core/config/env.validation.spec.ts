import { describe, expect, it } from '@jest/globals';
import { envValidationSchema } from './env.validation.js';

describe('envValidationSchema', () => {
  it('defaults local API settings to port 3001', () => {
    const config = envValidationSchema.parse({
      DATABASE_URL: '******localhost:5432/kentslsc',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'a-very-long-random-secret',
      JWT_REFRESH_SECRET: 'another-very-long-random-secret'
    });

    expect(config.PORT).toBe(3001);
    expect(config.API_URL).toBe('http://localhost:3001');
    expect(config.FRONTEND_URL).toBe('http://localhost:3000');
  });
});
