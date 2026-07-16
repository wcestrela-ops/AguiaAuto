import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!process.env.SMS_HUB_DATABASE_URL) {
      console.warn('SMS_HUB_DATABASE_URL not set — skipping e2e');
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('/api/v1/auth/login (POST) rejects invalid body', async () => {
    if (!app) return;
    await request(app.getHttpServer())
      .post('/api/v1/sms/auth/login')
      .send({ email: 'not-an-email' })
      .expect(400);
  });
});
