const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../../database');

function signToken({ userId, email }, jwtSecret) {
  return jwt.sign({ userId, email }, jwtSecret, { expiresIn: '1h' });
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createTestUser({ email, name = 'Test User', role = 'student', jwtSecret }) {
  const passwordHash = await bcrypt.hash('test-password', 4);
  const user = await db.createUser(email, passwordHash, name);
  if (role !== 'student') {
    await db.adminUpdateUser(user.id, { role });
  }
  const fresh = await db.getUserById(user.id);
  const token = signToken({ userId: fresh.id, email: fresh.email }, jwtSecret);
  return { user: fresh, token };
}

async function deleteTestUsersByEmailPrefix(prefix = 'test-academy-') {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
  });
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM users WHERE email LIKE $1`, [`${prefix}%`]);
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = { signToken, authHeader, createTestUser, deleteTestUsersByEmailPrefix };
