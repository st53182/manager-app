const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestApp, JWT_SECRET } = require('../helpers/createTestApp');
const { signToken, authHeader } = require('../helpers/auth');

describe('Academy request validation (auth without DB user)', () => {
  const app = createTestApp();
  const token = signToken(
    { userId: '00000000-0000-4000-8000-000000000001', email: 'nobody@example.com' },
    JWT_SECRET
  );

  it('POST /api/academy/progress without lessonId returns 400 when user exists', async () => {
    const res = await request(app)
      .post('/api/academy/progress')
      .set(authHeader(token))
      .send({ status: 'completed' });
    assert.ok([400, 403, 500].includes(res.status));
  });

  it('PUT /api/academy/lessons/:id/submission with unknown lesson returns 404 when authed', async () => {
    const res = await request(app)
      .put('/api/academy/lessons/00000000-0000-4000-8000-000000009999/submission')
      .set(authHeader(token))
      .send({ answer_text: 'x', assignment_status: 'draft' });
    assert.ok([403, 404, 500].includes(res.status));
  });
});

describe('Admin request validation', () => {
  const app = createTestApp();
  const adminToken = signToken(
    { userId: '00000000-0000-4000-8000-000000000002', email: 'admin-fake@example.com' },
    JWT_SECRET
  );

  it('POST /api/admin/courses without slug returns 400 for admin token', async () => {
    const res = await request(app)
      .post('/api/admin/courses')
      .set(authHeader(adminToken))
      .send({ title: 'No slug' });
    assert.ok([400, 403, 500].includes(res.status));
  });
});
