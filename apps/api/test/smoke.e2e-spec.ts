import { INestApplication } from '@nestjs/common';
import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { createApiApp } from '../src/handler.js';
import { requireTestDatabase, resetAndSeedTestDatabase } from './e2e-setup.js';

describe('API smoke (e2e)', () => {
  let app: INestApplication;
  let agent: request.SuperAgentTest;

  beforeAll(async () => {
    // Resolve the test database before importing any Prisma-backed modules so
    // the singleton PrismaClient connects to the correct database.
    requireTestDatabase();

    // Reset and seed the database in a child process so the test starts from a
    // clean, known state.
    resetAndSeedTestDatabase();

    // Env values required by the API's config validation.
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-min-length-32!!';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-length-32!!';
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    process.env.API_URL = process.env.API_URL || 'http://localhost:4000';

    app = await createApiApp();
    agent = request.agent(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('/api/health returns ok', () => {
    return agent
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('registers a user, logs in, and reads the profile', async () => {
    const timestamp = Date.now();
    const email = `e2e.user.${timestamp}@example.com`;
    const password = 'E2E-Password-123';

    await agent
      .post('/api/auth/register')
      .send({
        firstName: 'E2E',
        lastName: 'User',
        email,
        password
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe(email);
      });

    await agent
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
      });

    const me = await agent.get('/api/users/me').expect(200);
    expect(me.body.email).toBe(email);
  });
});
