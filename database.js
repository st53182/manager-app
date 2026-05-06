const { Pool } = require('pg');
const { mergeDefaultAllowedModels } = require('./services/academy/modelCatalog');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function bootstrapAdminEmail(client) {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (!email || !email.trim()) return;
  await client.query(
    `UPDATE users SET role = 'admin' WHERE lower(trim(email)) = lower(trim($1))`,
    [email]
  );
}

async function bumpLegacyTokenLimits(client) {
  try {
    const newDaily = parseInt(process.env.DEFAULT_AI_DAILY_TOKEN_LIMIT || '2000000', 10);
    const newMonthly = parseInt(process.env.DEFAULT_AI_MONTHLY_TOKEN_LIMIT || '60000000', 10);
    const r1 = await client.query(
      `UPDATE users SET ai_daily_token_limit = $1 WHERE ai_daily_token_limit <= 100000`,
      [newDaily]
    );
    const r2 = await client.query(
      `UPDATE users SET ai_monthly_token_limit = $1 WHERE ai_monthly_token_limit <= 5000000`,
      [newMonthly]
    );
    console.log(
      `AI Academy: raised legacy token caps (daily updates: ${r1.rowCount}, monthly: ${r2.rowCount}; targets ${newDaily}/${newMonthly})`
    );
  } catch (e) {
    console.error('bumpLegacyTokenLimits:', e.message);
  }
}

async function mergeExistingUsersAiAllowedModels(client) {
  try {
    const r = await client.query(`SELECT id, ai_allowed_models FROM users`);
    for (const row of r.rows) {
      let arr = row.ai_allowed_models;
      if (typeof arr === 'string') {
        try {
          arr = JSON.parse(arr);
        } catch {
          arr = [];
        }
      }
      if (!Array.isArray(arr)) arr = [];
      const merged = mergeDefaultAllowedModels(arr);
      const prev = JSON.stringify([...arr].sort());
      const next = JSON.stringify([...merged].sort());
      if (prev !== next) {
        await client.query(`UPDATE users SET ai_allowed_models = $1::jsonb WHERE id = $2`, [
          JSON.stringify(merged),
          row.id
        ]);
      }
    }
    console.log('AI Academy: merged preset models into user ai_allowed_models where missing');
  } catch (e) {
    console.error('mergeExistingUsersAiAllowedModels:', e.message);
  }
}

async function seedAcademyCatalog(client) {
  const courses = [
    { slug: 'ai-basics', title: 'Основы AI', description: 'Что такое нейросети и как они работают', sort_order: 1 },
    { slug: 'prompting-basics', title: 'Основы промптинга', description: 'Формулировки, контекст, few-shot', sort_order: 2 },
    { slug: 'ai-work', title: 'AI для работы', description: 'Письма, резюме, исследования', sort_order: 3 },
    { slug: 'ai-content', title: 'AI для контента', description: 'Тексты, сценарии, редактура', sort_order: 4 },
    { slug: 'ai-analytics', title: 'AI для аналитики', description: 'Данные, таблицы, выводы', sort_order: 5 },
    { slug: 'ai-business', title: 'AI для бизнеса', description: 'Стратегия, метрики, коммуникации', sort_order: 6 }
  ];

  for (const c of courses) {
    await client.query(
      `INSERT INTO academy_courses (slug, title, description, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order`,
      [c.slug, c.title, c.description, c.sort_order]
    );
  }

  const lessonSeeds = [
    { courseSlug: 'ai-basics', title: 'Введение: модели и токены', scenario_key: 'ai-basics-intro', sort_order: 1,
      content_md: 'Изучите базовые понятия: модель, контекстное окно, токены. Задайте вопросы наставнику в чате.',
      assignment_title: 'Практика', assignment_instructions: 'Спросите у наставника простыми словами, чем отличается обучение модели от inference.' },
    { courseSlug: 'ai-basics', title: 'Ограничения и галлюцинации', scenario_key: 'ai-basics-limits', sort_order: 2,
      content_md: 'Поймите риски: галлюцинации, устаревшие знания, необходимость проверки источников.',
      assignment_title: 'Критическое мышление', assignment_instructions: 'Попросите наставника объяснить, как проверять ответы AI на факты.' },
    { courseSlug: 'prompting-basics', title: 'Структура хорошего промпта', scenario_key: 'prompt-structure', sort_order: 1,
      content_md: 'Роль, контекст, формат вывода, критерии успеха.',
      assignment_title: 'Написать промпт', assignment_instructions: 'Составьте промпт для задачи «краткое резюме статьи» и попросите наставника оценить его.' },
    { courseSlug: 'prompting-basics', title: 'Итерации и уточнения', scenario_key: 'prompt-iterate', sort_order: 2,
      content_md: 'Как улучшать результат вторым и третьим сообщением.',
      assignment_title: 'Итерация', assignment_instructions: 'Выполните одну задачу в два шага: черновик → уточнение.' },
    { courseSlug: 'ai-work', title: 'Деловая переписка', scenario_key: 'work-email', sort_order: 1,
      content_md: 'Тон, ясность, призыв к действию.',
      assignment_title: 'Черновик письма', assignment_instructions: 'Попросите наставника помочь спланировать письмо клиенту, но напишите финальный текст сами.' },
    { courseSlug: 'ai-content', title: 'Идея и структура', scenario_key: 'content-outline', sort_order: 1,
      content_md: 'Заголовки, лиды, структура поста.',
      assignment_title: 'План поста', assignment_instructions: 'Создайте структуру поста на заданную тему и попросите обратную связь по структуре.' },
    { courseSlug: 'ai-analytics', title: 'Формулировка вопроса к данным', scenario_key: 'analytics-question', sort_order: 1,
      content_md: 'Как спросить про метрики без ошибочных интерпретаций.',
      assignment_title: 'Вопрос к данным', assignment_instructions: 'Опишите вымышленный датасет и попросите наставника помочь сформулировать 3 аналитических вопроса.' },
    { courseSlug: 'ai-business', title: 'Гипотезы и проверка', scenario_key: 'business-hypothesis', sort_order: 1,
      content_md: 'От гипотезы к эксперименту и метрикам.',
      assignment_title: 'Гипотеза', assignment_instructions: 'Сформулируйте бизнес-гипотезу и попросите наставника указать слабые места.' }
  ];

  for (const L of lessonSeeds) {
    const cr = await client.query(`SELECT id FROM academy_courses WHERE slug = $1`, [L.courseSlug]);
    if (!cr.rows[0]) continue;
    const courseId = cr.rows[0].id;
    const ins = await client.query(
      `INSERT INTO academy_lessons (course_id, title, content_md, scenario_key, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (course_id, scenario_key) DO UPDATE SET
         title = EXCLUDED.title,
         content_md = EXCLUDED.content_md,
         sort_order = EXCLUDED.sort_order
       RETURNING id`,
      [courseId, L.title, L.content_md, L.scenario_key, L.sort_order]
    );
    const lessonId = ins.rows[0]?.id;
    if (lessonId) {
      await client.query(
        `INSERT INTO academy_assignments (lesson_id, title, instructions_md)
         VALUES ($1, $2, $3)
         ON CONFLICT (lesson_id) DO UPDATE SET
           title = EXCLUDED.title,
           instructions_md = EXCLUDED.instructions_md`,
        [lessonId, L.assignment_title, L.assignment_instructions]
      );
    }
  }
}

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
        roles TEXT,
        home_base VARCHAR(255),
        time_zone VARCHAR(100),
        meeting_times TEXT,
        domains TEXT,
        expertise TEXT,
        motivators TEXT,
        demotivators TEXT,
        motivational_triggers JSONB DEFAULT '[]'::jsonb,
        personal_interests TEXT,
        stakeholders TEXT,
        important_traits TEXT,
        comm_channels TEXT,
        comm_style TEXT,
        comm_notes TEXT,
        work_style TEXT,
        okr_goals JSONB DEFAULT '[]',
        disc_type VARCHAR(10),
        disc_data JSONB,
        development_plan JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Employees table created successfully');

    console.log('Creating employee_secure_tokens table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_secure_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
        manager_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Employee secure tokens table created successfully');

    console.log('Running database migrations...');
    try {
      await client.query(`
        ALTER TABLE employee_secure_tokens 
        ALTER COLUMN token TYPE TEXT;
      `);
      console.log('Token column migration completed successfully');
    } catch (error) {
      if (error.code !== '42703') {
        console.log('Token column migration skipped (already TEXT or table doesn\'t exist)');
      }
    }

    try {
      await client.query(`
        ALTER TABLE employees 
        ADD COLUMN IF NOT EXISTS roles TEXT;
      `);
      console.log('Roles column migration completed successfully');
    } catch (error) {
      console.log('Roles column migration skipped (already exists)');
    }

    const missingColumns = [
      'home_base VARCHAR(255)',
      'time_zone VARCHAR(100)',
      'meeting_times TEXT',
      'domains TEXT',
      'expertise TEXT',
      'motivators TEXT',
      'demotivators TEXT',
      'motivational_triggers JSONB DEFAULT \'[]\'::jsonb',
      'personal_interests TEXT',
      'stakeholders TEXT',
      'important_traits TEXT',
      'comm_channels TEXT',
      'comm_style TEXT',
      'comm_notes TEXT',
      'work_style TEXT',
      'okr_goals JSONB DEFAULT \'[]\'',
      'disc_type VARCHAR(10)',
      'disc_data JSONB',
      'development_plan JSONB DEFAULT \'[]\''
    ];

    for (const column of missingColumns) {
      try {
        await client.query(`
          ALTER TABLE employees 
          ADD COLUMN IF NOT EXISTS ${column};
        `);
        console.log(`Column migration completed: ${column.split(' ')[0]}`);
      } catch (error) {
        console.log(`Column migration skipped: ${column.split(' ')[0]} (already exists)`);
      }
    }

    console.log('Creating skill_development_history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS skill_development_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
        skill_id VARCHAR(255) NOT NULL,
        skill_type VARCHAR(20) NOT NULL,
        action VARCHAR(20) NOT NULL,
        level INTEGER,
        previous_level INTEGER,
        competency_area VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating custom_skill_trees table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_skill_trees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        manager_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        tree_data JSONB NOT NULL,
        is_template BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('AI Academy: extending users table...');
    for (const col of [
      `ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student'`,
      `ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
      `ADD COLUMN IF NOT EXISTS ai_daily_token_limit INTEGER DEFAULT 2000000`,
      `ADD COLUMN IF NOT EXISTS ai_monthly_token_limit INTEGER DEFAULT 60000000`,
      `ADD COLUMN IF NOT EXISTS ai_allowed_models JSONB DEFAULT '["openai/gpt-4o-mini","google/gemini-2.0-flash-001","anthropic/claude-3.5-sonnet"]'::jsonb`
    ]) {
      try {
        await client.query(`ALTER TABLE users ${col}`);
      } catch (e) {
        console.log('users alter skipped:', e.message);
      }
    }

    try {
      await client.query(`
        ALTER TABLE users ALTER COLUMN ai_allowed_models SET DEFAULT
        '["openai/gpt-4o-mini","google/gemini-2.0-flash-001","anthropic/claude-3.5-sonnet"]'::jsonb
      `);
    } catch (e) {
      console.log('ai_allowed_models default alter skipped:', e.message);
    }

    try {
      await client.query(`
        ALTER TABLE users ALTER COLUMN ai_daily_token_limit SET DEFAULT 2000000
      `);
      await client.query(`
        ALTER TABLE users ALTER COLUMN ai_monthly_token_limit SET DEFAULT 60000000
      `);
    } catch (e) {
      console.log('token limit column defaults alter skipped:', e.message);
    }

    console.log('AI Academy: courses & lessons...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS academy_courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS academy_lessons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID NOT NULL REFERENCES academy_courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content_md TEXT,
        scenario_key VARCHAR(100),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_academy_lessons_course_scenario
      ON academy_lessons(course_id, scenario_key);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS academy_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        instructions_md TEXT,
        rubric_json JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_academy_assignments_lesson ON academy_assignments(lesson_id);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS academy_user_lesson_progress (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
        status VARCHAR(30) DEFAULT 'not_started',
        score NUMERIC(5,2),
        completed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, lesson_id)
      );
    `);

    console.log('AI Academy: conversations & usage...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id UUID REFERENCES academy_lessons(id) ON DELETE SET NULL,
        course_id UUID REFERENCES academy_courses(id) ON DELETE SET NULL,
        title VARCHAR(500) DEFAULT 'New chat',
        model VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_usage_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
        model VARCHAR(200),
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        cost_usd NUMERIC(14, 8),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created ON ai_messages(conversation_id, created_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_conv_user_updated ON ai_conversations(user_id, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage_events(user_id, created_at DESC);
    `);

    await seedAcademyCatalog(client);
    await bootstrapAdminEmail(client);
    await mergeExistingUsersAiAllowedModels(client);
    await bumpLegacyTokenLimits(client);

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
    const result = await client.query(`
      SELECT e.*, t.name as team_name 
      FROM employees e 
      LEFT JOIN teams t ON e.team_id = t.id 
      WHERE e.id = $1
    `, [employeeId]);
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

async function updateEmployeeProfile(employeeId, profileData) {
  const client = await pool.connect();
  try {
    const {
      name, email, position, phone, roles, homeBase, timeZone, meetingTimes,
      domains, expertise, motivators, demotivators, personalInterests,
      stakeholders, importantTraits, commChannels, commStyle, commNotes,
      workStyle, okrGoals, discType, discData, developmentPlan, comm_channels, motivationalTriggers
    } = profileData;

    const emailValue = email && email.trim() !== '' ? email : null;

    // главное: если поле не прислали (undefined), шлём NULL → COALESCE оставит старое значение
    const okrGoalsJson        = (typeof okrGoals        === 'undefined') ? null : JSON.stringify(okrGoals);
    const discDataJson        = (typeof discData        === 'undefined') ? null : JSON.stringify(discData);
    const developmentPlanJson = (typeof developmentPlan === 'undefined') ? null : JSON.stringify(developmentPlan);
    const motivationalTriggersJson = (typeof motivationalTriggers === 'undefined') ? null : JSON.stringify(motivationalTriggers);

    const result = await client.query(`
      UPDATE employees SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        position = COALESCE($3, position),
        phone = COALESCE($4, phone),
        roles = COALESCE($5, roles),
        home_base = COALESCE($6, home_base),
        time_zone = COALESCE($7, time_zone),
        meeting_times = COALESCE($8, meeting_times),
        domains = COALESCE($9, domains),
        expertise = COALESCE($10, expertise),
        motivators = COALESCE($11, motivators),
        demotivators = COALESCE($12, demotivators),
        personal_interests = COALESCE($13, personal_interests),
        stakeholders = COALESCE($14, stakeholders),
        important_traits = COALESCE($15, important_traits),
        comm_channels = COALESCE($16, comm_channels),
        comm_style = COALESCE($17, comm_style),
        comm_notes = COALESCE($18, comm_notes),
        work_style = COALESCE($19, work_style),
        okr_goals = COALESCE($20, okr_goals),
        disc_type = COALESCE($21, disc_type),
        disc_data = COALESCE($22, disc_data),
        development_plan = COALESCE($23, development_plan),
        motivational_triggers = COALESCE($24, motivational_triggers),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $25 RETURNING *
    `, [
      name, emailValue, position, phone, roles, homeBase, timeZone, meetingTimes,
      domains, expertise, motivators, demotivators, personalInterests,
      stakeholders, importantTraits, (comm_channels || commChannels), commStyle,
      commNotes, workStyle, okrGoalsJson, discType, discDataJson, developmentPlanJson,
      motivationalTriggersJson, employeeId
    ]);

    const updatedEmployee = await client.query(`
      SELECT e.*, t.name as team_name 
      FROM employees e 
      LEFT JOIN teams t ON e.team_id = t.id 
      WHERE e.id = $1
    `, [employeeId]);

    return updatedEmployee.rows[0];
  } finally {
    client.release();
  }
}


async function createEmployeeSecureToken(employeeId, managerId) {
  const client = await pool.connect();
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const token = jwt.sign(
      { employeeId, managerId, type: 'employee_access' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const result = await client.query(`
      INSERT INTO employee_secure_tokens (employee_id, manager_id, token, expires_at)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [employeeId, managerId, token, expiresAt]);

    return result.rows[0];
  } finally {
    client.release();
  }
}

async function validateEmployeeSecureToken(token) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT est.*, e.*, t.name as team_name
      FROM employee_secure_tokens est
      JOIN employees e ON est.employee_id = e.id
      LEFT JOIN teams t ON e.team_id = t.id
      WHERE est.token = $1 AND est.expires_at > NOW()
    `, [token]);

    return result.rows[0];
  } finally {
    client.release();
  }
}

async function addSkillDevelopmentHistory(employeeId, skillId, skillType, action, level = null, previousLevel = null, competencyArea = null) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO skill_development_history (employee_id, skill_id, skill_type, action, level, previous_level, competency_area)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [employeeId, skillId, skillType, action, level, previousLevel, competencyArea]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getSkillDevelopmentHistory(employeeId) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM skill_development_history 
      WHERE employee_id = $1 
      ORDER BY created_at DESC
    `, [employeeId]);
    return result.rows;
  } finally {
    client.release();
  }
}

async function createCustomSkillTree(managerId, name, description, treeData, isTemplate = false) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO custom_skill_trees (manager_id, name, description, tree_data, is_template)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [managerId, name, description, JSON.stringify(treeData), isTemplate]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getCustomSkillTrees(managerId) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM custom_skill_trees 
      WHERE manager_id = $1 OR is_template = true
      ORDER BY created_at DESC
    `, [managerId]);
    return result.rows;
  } finally {
    client.release();
  }
}

async function getAcademyCatalog() {
  const client = await pool.connect();
  try {
    const courses = await client.query(
      `SELECT * FROM academy_courses ORDER BY sort_order ASC, title ASC`
    );
    const lessons = await client.query(
      `SELECT l.*, c.slug AS course_slug, c.title AS course_title
       FROM academy_lessons l
       JOIN academy_courses c ON c.id = l.course_id
       ORDER BY c.sort_order, l.sort_order`
    );
    const assigns = await client.query(`SELECT * FROM academy_assignments`);
    const byLesson = {};
    for (const a of assigns.rows) byLesson[a.lesson_id] = a;
    return {
      courses: courses.rows,
      lessons: lessons.rows.map((l) => ({
        ...l,
        assignment: byLesson[l.id] || null
      }))
    };
  } finally {
    client.release();
  }
}

async function getLessonById(lessonId) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT l.*, c.slug AS course_slug, c.title AS course_title
       FROM academy_lessons l
       JOIN academy_courses c ON c.id = l.course_id
       WHERE l.id = $1`,
      [lessonId]
    );
    return r.rows[0] || null;
  } finally {
    client.release();
  }
}

async function createAiConversation(userId, { lessonId = null, courseId = null, title = 'New chat', model = null }) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO ai_conversations (user_id, lesson_id, course_id, title, model)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, lessonId, courseId, title, model]
    );
    return r.rows[0];
  } finally {
    client.release();
  }
}

async function listAiConversations(userId, limit = 50) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT * FROM ai_conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [userId, limit]
    );
    return r.rows;
  } finally {
    client.release();
  }
}

async function getAiConversationForUser(conversationId, userId) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    return r.rows[0] || null;
  } finally {
    client.release();
  }
}

async function updateAiConversation(userId, conversationId, { title, model }) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE ai_conversations SET
        title = COALESCE($3, title),
        model = COALESCE($4, model),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [conversationId, userId, title ?? null, model ?? null]
    );
    return r.rows[0] || null;
  } finally {
    client.release();
  }
}

async function touchConversationUpdated(conversationId) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [conversationId]
    );
  } finally {
    client.release();
  }
}

async function deleteAiConversation(userId, conversationId) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2 RETURNING id`,
      [conversationId, userId]
    );
    return !!r.rows[0];
  } finally {
    client.release();
  }
}

async function addAiMessage(conversationId, role, content, meta = {}) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO ai_messages (conversation_id, role, content, meta)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [conversationId, role, content, JSON.stringify(meta)]
    );
    await client.query(
      `UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [conversationId]
    );
    return r.rows[0];
  } finally {
    client.release();
  }
}

async function listAiMessagesAsc(conversationId, limit = 200) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2`,
      [conversationId, limit]
    );
    return r.rows;
  } finally {
    client.release();
  }
}

async function deleteLastAssistantMessage(conversationId) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `DELETE FROM ai_messages WHERE id = (
        SELECT id FROM ai_messages WHERE conversation_id = $1 AND role = 'assistant'
        ORDER BY created_at DESC LIMIT 1
      ) RETURNING id`,
      [conversationId]
    );
    return !!r.rows[0];
  } finally {
    client.release();
  }
}

async function sumAiTokensForUser(userId, start, end) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT
        COALESCE(SUM(prompt_tokens), 0)::bigint AS prompt_tokens,
        COALESCE(SUM(completion_tokens), 0)::bigint AS completion_tokens,
        COALESCE(SUM(cost_usd), 0)::numeric AS cost_usd
       FROM ai_usage_events
       WHERE user_id = $1 AND created_at >= $2 AND created_at < $3`,
      [userId, start, end]
    );
    return r.rows[0];
  } finally {
    client.release();
  }
}

async function recordAiUsage({ userId, conversationId, model, promptTokens, completionTokens, costUsd }) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO ai_usage_events (user_id, conversation_id, model, prompt_tokens, completion_tokens, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, conversationId, model, promptTokens, completionTokens, costUsd]
    );
  } finally {
    client.release();
  }
}

async function upsertLessonProgress(userId, lessonId, { status, score = null }) {
  const client = await pool.connect();
  try {
    const completedAt = status === 'completed' ? new Date() : null;
    await client.query(
      `INSERT INTO academy_user_lesson_progress (user_id, lesson_id, status, score, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET
         status = EXCLUDED.status,
         score = COALESCE(EXCLUDED.score, academy_user_lesson_progress.score),
         completed_at = COALESCE(EXCLUDED.completed_at, academy_user_lesson_progress.completed_at),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, lessonId, status, score, completedAt]
    );
  } finally {
    client.release();
  }
}

async function getLessonProgressForUser(userId) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT * FROM academy_user_lesson_progress WHERE user_id = $1`,
      [userId]
    );
    return r.rows;
  } finally {
    client.release();
  }
}

async function listUsersForAdmin(limit = 100, offset = 0) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, email, name, role, is_active, ai_daily_token_limit, ai_monthly_token_limit, ai_allowed_models,
              created_at, last_login
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return r.rows;
  } finally {
    client.release();
  }
}

async function adminUpdateUser(userId, patch) {
  const client = await pool.connect();
  try {
    const allowed = ['role', 'is_active', 'ai_daily_token_limit', 'ai_monthly_token_limit', 'ai_allowed_models'];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const k of allowed) {
      if (typeof patch[k] !== 'undefined') {
        sets.push(`${k} = $${i++}`);
        if (k === 'ai_allowed_models') {
          vals.push(JSON.stringify(patch[k]));
        } else {
          vals.push(patch[k]);
        }
      }
    }
    if (!sets.length) return getUserById(userId);
    vals.push(userId);
    const r = await client.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return r.rows[0] || null;
  } finally {
    client.release();
  }
}

async function adminListAllConversations(limit = 100, offset = 0, filterUserId = null) {
  const client = await pool.connect();
  try {
    const params = filterUserId ? [filterUserId, limit, offset] : [limit, offset];
    const q = filterUserId
      ? `SELECT c.*, u.email AS user_email FROM ai_conversations c
         JOIN users u ON u.id = c.user_id WHERE c.user_id = $1
         ORDER BY c.updated_at DESC LIMIT $2 OFFSET $3`
      : `SELECT c.*, u.email AS user_email FROM ai_conversations c
         JOIN users u ON u.id = c.user_id
         ORDER BY c.updated_at DESC LIMIT $1 OFFSET $2`;
    const r = await client.query(q, params);
    return r.rows;
  } finally {
    client.release();
  }
}

async function adminGetConversation(conversationId) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT c.*, u.email AS user_email FROM ai_conversations c
       JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
      [conversationId]
    );
    return r.rows[0] || null;
  } finally {
    client.release();
  }
}

async function adminExportUsage(start, end) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT e.*, u.email AS user_email
       FROM ai_usage_events e
       JOIN users u ON u.id = e.user_id
       WHERE e.created_at >= $1 AND e.created_at < $2
       ORDER BY e.created_at DESC`,
      [start, end]
    );
    return r.rows;
  } finally {
    client.release();
  }
}

async function adminSumUsageByUser(start, end) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT u.id, u.email, u.name,
        COALESCE(SUM(e.prompt_tokens), 0)::bigint AS prompt_tokens,
        COALESCE(SUM(e.completion_tokens), 0)::bigint AS completion_tokens,
        COALESCE(SUM(e.cost_usd), 0)::numeric AS cost_usd
       FROM users u
       LEFT JOIN ai_usage_events e ON e.user_id = u.id AND e.created_at >= $1 AND e.created_at < $2
       GROUP BY u.id, u.email, u.name
       ORDER BY u.email`,
      [start, end]
    );
    return r.rows;
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
  updateEmployeeProfile,
  createEmployeeSecureToken,
  validateEmployeeSecureToken,
  createUser,
  getUserByEmail,
  getUserById,
  updateUserLastLogin,
  addSkillDevelopmentHistory,
  getSkillDevelopmentHistory,
  createCustomSkillTree,
  getCustomSkillTrees,
  getAcademyCatalog,
  getLessonById,
  createAiConversation,
  listAiConversations,
  getAiConversationForUser,
  updateAiConversation,
  touchConversationUpdated,
  deleteAiConversation,
  addAiMessage,
  listAiMessagesAsc,
  deleteLastAssistantMessage,
  sumAiTokensForUser,
  recordAiUsage,
  upsertLessonProgress,
  getLessonProgressForUser,
  listUsersForAdmin,
  adminUpdateUser,
  adminListAllConversations,
  adminGetConversation,
  adminExportUsage,
  adminSumUsageByUser
};
