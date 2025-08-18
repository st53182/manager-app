const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  console.log('Starting database initialization...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  let client;
  try {
    client = await pool.connect();
    console.log('Database connection established successfully');
    
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
    `);
    console.log('Users table created successfully');
    
    console.log('Creating teams table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Teams table created successfully');
    
    console.log('Creating employees table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        position VARCHAR(255),
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
        phone VARCHAR(50),
        hire_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Employees table created successfully');
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function createTeam(name, description, managerId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO teams (name, description, manager_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, managerId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getTeamsByManager(managerId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM teams WHERE manager_id = $1 ORDER BY created_at DESC',
      [managerId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getTeamById(teamId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM teams WHERE id = $1',
      [teamId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function updateTeam(teamId, name, description) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'UPDATE teams SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, description, teamId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteTeam(teamId) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM teams WHERE id = $1', [teamId]);
    return true;
  } finally {
    client.release();
  }
}

async function createEmployee(name, email, position, teamId, managerId, phone, hireDate) {
  const client = await pool.connect();
  try {
    const emailValue = email && email.trim() !== '' ? email : null;
    
    const result = await client.query(
      'INSERT INTO employees (name, email, position, team_id, manager_id, phone, hire_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, emailValue, position, teamId, managerId, phone, hireDate]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getEmployeesByManager(managerId) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT e.*, t.name as team_name 
      FROM employees e 
      LEFT JOIN teams t ON e.team_id = t.id 
      WHERE e.manager_id = $1 
      ORDER BY e.created_at DESC
    `, [managerId]);
    return result.rows;
  } finally {
    client.release();
  }
}

async function getEmployeesByTeam(teamId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM employees WHERE team_id = $1 ORDER BY created_at DESC',
      [teamId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getEmployeeById(employeeId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM employees WHERE id = $1',
      [employeeId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function updateEmployee(employeeId, name, email, position, teamId, phone, hireDate) {
  const client = await pool.connect();
  try {
    const emailValue = email && email.trim() !== '' ? email : null;
    
    const result = await client.query(
      'UPDATE employees SET name = $1, email = $2, position = $3, team_id = $4, phone = $5, hire_date = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [name, emailValue, position, teamId, phone, hireDate, employeeId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteEmployee(employeeId) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM employees WHERE id = $1', [employeeId]);
    return true;
  } finally {
    client.release();
  }
}

async function createUser(email, passwordHash, name) {
  const client = await pool.connect();
  try {
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();
    
    const result = await client.query(
      'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, email, passwordHash, name]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getUserByEmail(email) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getUserById(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function updateUserLastLogin(userId) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  } finally {
    client.release();
  }
}

module.exports = {
  initializeDatabase,
  createTeam,
  getTeamsByManager,
  getTeamById,
  updateTeam,
  deleteTeam,
  createEmployee,
  getEmployeesByManager,
  getEmployeesByTeam,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  createUser,
  getUserByEmail,
  getUserById,
  updateUserLastLogin
};
