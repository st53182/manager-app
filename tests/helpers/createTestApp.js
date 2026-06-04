const express = require('express');
const { createRouter: createAcademyRouter } = require('../../routes/academy');
const { createRouter: createAdminRouter } = require('../../routes/admin');

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-academy-ci';

function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/academy', createAcademyRouter({ JWT_SECRET }));
  app.use('/api/admin', createAdminRouter({ JWT_SECRET }));
  return app;
}

module.exports = { createTestApp, JWT_SECRET };
