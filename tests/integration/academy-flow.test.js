require('dotenv').config();

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createTestApp, JWT_SECRET } = require('../helpers/createTestApp');
const { authHeader, createTestUser, deleteTestUsersByEmailPrefix } = require('../helpers/auth');
const db = require('../../database');

const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Academy integration (requires DATABASE_URL)', () => {
  const app = createTestApp();
  const runId = Date.now();
  let student;
  let admin;
  let lessonId;

  before(async () => {
    await db.initializeDatabase();
    student = await createTestUser({
      email: `test-academy-student-${runId}@example.com`,
      role: 'student',
      jwtSecret: JWT_SECRET
    });
    admin = await createTestUser({
      email: `test-academy-admin-${runId}@example.com`,
      role: 'admin',
      jwtSecret: JWT_SECRET
    });

    const catalog = await db.getAcademyCatalog();
    assert.ok(catalog.lessons?.length, 'seed catalog must include lessons');
    lessonId = catalog.lessons[0].id;
  });

  after(async () => {
    await deleteTestUsersByEmailPrefix('test-academy-');
  });

  it('GET /api/academy/catalog returns courses and progress for student', async () => {
    const res = await request(app)
      .get('/api/academy/catalog')
      .set(authHeader(student.token));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.courses));
    assert.ok(Array.isArray(res.body.lessons));
    assert.ok(res.body.progress && typeof res.body.progress === 'object');
  });

  it('PUT submission saves draft then rejects empty feedback answer', async () => {
    const draft = await request(app)
      .put(`/api/academy/lessons/${lessonId}/submission`)
      .set(authHeader(student.token))
      .send({
        answer_text: 'Integration test draft answer',
        assignment_status: 'draft',
        practice_mode: 'individual',
        group_meta: {}
      });
    assert.equal(draft.status, 200);
    assert.equal(draft.body.submission?.answer_text, 'Integration test draft answer');

    const feedback = await request(app)
      .post(`/api/academy/lessons/${lessonId}/feedback`)
      .set(authHeader(student.token))
      .send({ answer_text: '' });
    assert.ok(feedback.status === 400 || feedback.status === 503);
  });

  it('POST /api/academy/progress marks lesson completed', async () => {
    const res = await request(app)
      .post('/api/academy/progress')
      .set(authHeader(student.token))
      .send({ lessonId, status: 'completed' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    const catalog = await request(app)
      .get('/api/academy/catalog')
      .set(authHeader(student.token));
    assert.equal(catalog.body.progress[lessonId]?.status, 'completed');
  });

  it('student cannot access admin catalog', async () => {
    const res = await request(app)
      .get('/api/admin/catalog')
      .set(authHeader(student.token));
    assert.equal(res.status, 403);
  });

  it('admin can access catalog and create course', async () => {
    const list = await request(app)
      .get('/api/admin/catalog')
      .set(authHeader(admin.token));
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.courses));

    const slug = `test-course-${runId}`;
    const created = await request(app)
      .post('/api/admin/courses')
      .set(authHeader(admin.token))
      .send({
        slug,
        title: 'Test Course',
        description: 'Created by integration test',
        sort_order: 99
      });
    assert.equal(created.status, 201);
    assert.equal(created.body.course.slug, slug);

    const removed = await request(app)
      .delete(`/api/admin/courses/${created.body.course.id}`)
      .set(authHeader(admin.token));
    assert.equal(removed.status, 200);
  });
});
