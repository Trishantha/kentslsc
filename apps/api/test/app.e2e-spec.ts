import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

// Provide minimal env values so the test can run in CI without a real .env file.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-min-length-32!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-length-32!!';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// This lightweight test does not touch the database. Avoid a slow retry loop
// against a production/unreachable DATABASE_URL in local runs by defaulting to
// the dedicated E2E database when it is set, otherwise leaving DATABASE_URL empty.
process.env.DATABASE_URL = process.env.E2E_DATABASE_URL || '';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
