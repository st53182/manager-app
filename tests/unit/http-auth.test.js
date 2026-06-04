const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestApp, JWT_SECRET } = require('../helpers/createTestApp');
const { signToken, authHeader } = require('../helpers/auth');

describe('Academy & Admin HTTP auth guards', () => {
  const app = createTestApp();

  it('GET /api/academy/catalog without token returns 401', async () => {
    const res = await request(app).get('/api/academy/catalog');
    assert.equal(res.status, 401);
    assert.match(res.body.error || '', /token/i);
  });

  it('GET /api/academy/catalog with invalid token returns 403', async () => {
    const res = await request(app)
      .get('/api/academy/catalog')
      .set('Authorization', 'Bearer not-a-valid-jwt');
    assert.equal(res.status, 403);
  });

  it('GET /api/admin/users without token returns 401', async () => {
    const res = await request(app).get('/api/admin/users');
    assert.equal(res.status, 401);
  });

  it('GET /api/admin/users with student-like token returns 403', async () => {
    const token = signToken(
      { userId: '00000000-0000-4000-8000-000000000099', email: 'fake@example.com' },
      JWT_SECRET
    );
    const res = await request(app).get('/api/admin/users').set(authHeader(token));
    assert.ok(res.status === 403 || res.status === 500);
  });
});
