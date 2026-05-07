const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initializePracticumSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE ai_usage_events
      ADD COLUMN IF NOT EXISTS feature_mode VARCHAR(80) DEFAULT 'chat_general'
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(500) NOT NULL,
        mime_type VARCHAR(180),
        source_type VARCHAR(40) DEFAULT 'file',
        source_url TEXT,
        storage_path TEXT,
        status VARCHAR(30) DEFAULT 'uploaded',
        chunk_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      ALTER TABLE knowledge_documents
      ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_kb_doc_user ON knowledge_documents(user_id, knowledge_base_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_kb_chunk_doc ON knowledge_chunks(document_id, chunk_index)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_index_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        status VARCHAR(30) DEFAULT 'queued',
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_kb_jobs_user_created ON knowledge_index_jobs(user_id, created_at DESC)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_personas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        description TEXT,
        tone TEXT,
        expertise TEXT,
        teaching_style TEXT,
        system_prompt TEXT NOT NULL,
        is_builtin BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_builtin_persona_name ON ai_personas(name) WHERE is_builtin = true
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(120) NOT NULL,
        tags JSONB DEFAULT '[]'::jsonb,
        prompt_text TEXT NOT NULL,
        recommended_persona_id UUID REFERENCES ai_personas(id) ON DELETE SET NULL,
        recommended_model VARCHAR(200),
        example_output TEXT,
        is_favorite BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_assistants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        role TEXT,
        instructions TEXT,
        tone TEXT,
        output_format TEXT,
        restrictions TEXT,
        connected_kb_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL,
        default_model VARCHAR(200),
        starter_prompts JSONB DEFAULT '[]'::jsonb,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        prompt_text TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        input_text TEXT,
        status VARCHAR(30) DEFAULT 'running',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_step_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
        step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
        output_text TEXT,
        status VARCHAR(30) DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hallucination_scenarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        difficulty VARCHAR(30) DEFAULT 'easy',
        flawed_answer TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        issue_types JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS hallucination_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scenario_id UUID NOT NULL REFERENCES hallucination_scenarios(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        selected_issue TEXT,
        explanation TEXT,
        score INTEGER,
        feedback TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        certificate_id VARCHAR(64) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_name VARCHAR(255) NOT NULL,
        course_name VARCHAR(255) NOT NULL,
        completion_date DATE NOT NULL,
        completed_modules JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    client.release();
  }
}

async function q(text, params = []) {
  const client = await pool.connect();
  try {
    const r = await client.query(text, params);
    return r.rows;
  } finally {
    client.release();
  }
}

async function createKnowledgeBase(userId, name, description = '') {
  const rows = await q(
    `INSERT INTO knowledge_bases (user_id, name, description) VALUES ($1, $2, $3) RETURNING *`,
    [userId, name, description]
  );
  return rows[0];
}

async function listKnowledgeBases(userId) {
  return q(`SELECT * FROM knowledge_bases WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}

async function createKnowledgeDocument(input) {
  const rows = await q(
    `INSERT INTO knowledge_documents
    (knowledge_base_id, user_id, name, mime_type, source_type, source_url, storage_path, status, size_bytes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      input.knowledgeBaseId,
      input.userId,
      input.name,
      input.mimeType || null,
      input.sourceType || 'file',
      input.sourceUrl || null,
      input.storagePath || null,
      input.status || 'uploaded',
      Number.isFinite(Number(input.sizeBytes)) ? Number(input.sizeBytes) : 0
    ]
  );
  return rows[0];
}

async function listKnowledgeDocuments(userId, knowledgeBaseId) {
  return q(
    `SELECT * FROM knowledge_documents WHERE user_id = $1 AND knowledge_base_id = $2 ORDER BY created_at DESC`,
    [userId, knowledgeBaseId]
  );
}

async function updateKnowledgeDocument(documentId, userId, patch) {
  const rows = await q(
    `UPDATE knowledge_documents SET
      status = COALESCE($3, status),
      chunk_count = COALESCE($4, chunk_count),
      error_message = COALESCE($5, error_message),
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [documentId, userId, patch.status ?? null, patch.chunkCount ?? null, patch.errorMessage ?? null]
  );
  return rows[0] || null;
}

async function clearChunksForDocument(documentId) {
  await q(`DELETE FROM knowledge_chunks WHERE document_id = $1`, [documentId]);
}

async function addKnowledgeChunk(input) {
  const rows = await q(
    `INSERT INTO knowledge_chunks (document_id, user_id, chunk_index, content, embedding)
     VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
    [input.documentId, input.userId, input.chunkIndex, input.content, JSON.stringify(input.embedding || [])]
  );
  return rows[0];
}

async function createIndexJob(input) {
  const rows = await q(
    `INSERT INTO knowledge_index_jobs (user_id, knowledge_base_id, document_id, status)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.userId, input.knowledgeBaseId, input.documentId, input.status || 'queued']
  );
  return rows[0];
}

async function setIndexJobStatus(jobId, status, errorMessage = null) {
  const rows = await q(
    `UPDATE knowledge_index_jobs
     SET status = $2, error_message = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [jobId, status, errorMessage]
  );
  return rows[0] || null;
}

async function getKnowledgeDocument(documentId, userId) {
  const rows = await q(`SELECT * FROM knowledge_documents WHERE id = $1 AND user_id = $2`, [documentId, userId]);
  return rows[0] || null;
}

async function getChunksForKnowledgeBase(userId, knowledgeBaseId) {
  return q(
    `SELECT c.*, d.name AS document_name
     FROM knowledge_chunks c
     JOIN knowledge_documents d ON d.id = c.document_id
     WHERE c.user_id = $1 AND d.knowledge_base_id = $2 AND d.status = 'indexed'`,
    [userId, knowledgeBaseId]
  );
}

async function listPersonas(userId) {
  return q(
    `SELECT * FROM ai_personas WHERE is_builtin = true OR user_id = $1 ORDER BY is_builtin DESC, name ASC`,
    [userId]
  );
}

async function createPersona(userId, body) {
  const rows = await q(
    `INSERT INTO ai_personas
    (user_id, name, description, tone, expertise, teaching_style, system_prompt, is_builtin)
    VALUES ($1,$2,$3,$4,$5,$6,$7,false) RETURNING *`,
    [userId, body.name, body.description || '', body.tone || '', body.expertise || '', body.teaching_style || '', body.system_prompt]
  );
  return rows[0];
}

async function getPersonaForUser(personaId, userId) {
  const rows = await q(
    `SELECT * FROM ai_personas WHERE id = $1 AND (is_builtin = true OR user_id = $2)`,
    [personaId, userId]
  );
  return rows[0] || null;
}

async function upsertBuiltinPersonas() {
  const defaults = [
    ['AI Tutor', 'Educational mentor', 'supportive', 'learning', 'coach', 'Teach with examples and checkpoints.'],
    ['Marketing Expert', 'Growth and campaigns', 'energetic', 'marketing', 'practical', 'Focus on positioning, channels, and conversion metrics.'],
    ['Business Analyst', 'Data-driven advisor', 'neutral', 'analysis', 'structured', 'Provide frameworks, assumptions, and risks.'],
    ['Sales Assistant', 'Sales enablement copilot', 'persuasive', 'sales', 'playbook', 'Create scripts, objections handling, and follow-ups.'],
    ['HR Assistant', 'People operations helper', 'empathetic', 'hr', 'policy-aware', 'Provide compliant and clear HR guidance.'],
    ['Excel Expert', 'Spreadsheet and formulas expert', 'precise', 'excel', 'step-by-step', 'Explain formulas and data transformations with examples.'],
    ['CEO Advisor', 'Executive strategic advisor', 'concise', 'strategy', 'high-level', 'Focus on priorities, trade-offs, and decision framing.'],
    ['Content Strategist', 'Content planning advisor', 'creative', 'content', 'framework-first', 'Create content pillars, calendars, and repurposing plans.'],
    ['Automation Consultant', 'No-code and automation planner', 'systematic', 'automation', 'process-first', 'Map workflows and recommend practical automations.']
  ];
  for (const p of defaults) {
    await q(
      `INSERT INTO ai_personas (name, description, tone, expertise, teaching_style, system_prompt, is_builtin)
      VALUES ($1,$2,$3,$4,$5,$6,true)
      ON CONFLICT (name) WHERE is_builtin = true
      DO UPDATE SET description = EXCLUDED.description, tone = EXCLUDED.tone, expertise = EXCLUDED.expertise,
        teaching_style = EXCLUDED.teaching_style, system_prompt = EXCLUDED.system_prompt`,
      p
    );
  }
}

async function seedHallucinationScenarios() {
  const defaults = [
    {
      title: 'Revenue claim with fake citation',
      difficulty: 'easy',
      flawed_answer: 'Company revenue grew 300% in Q2 [Source: Forbes 2026].',
      correct_answer: 'Revenue growth is unknown from provided data; cite actual uploaded source or mark as unknown.',
      issue_types: ['fake citation', 'unsupported claim']
    },
    {
      title: 'Confident wrong calculation',
      difficulty: 'medium',
      flawed_answer: '12% of 4500 equals 640, definitely.',
      correct_answer: '12% of 4500 equals 540.',
      issue_types: ['wrong calculation', 'overconfidence']
    }
  ];
  for (const s of defaults) {
    await q(
      `INSERT INTO hallucination_scenarios (title, difficulty, flawed_answer, correct_answer, issue_types)
       SELECT $1::varchar,$2::varchar,$3::text,$4::text,$5::jsonb
       WHERE NOT EXISTS (SELECT 1 FROM hallucination_scenarios WHERE title = $6::varchar)`,
      [s.title, s.difficulty, s.flawed_answer, s.correct_answer, JSON.stringify(s.issue_types), s.title]
    );
  }
}

async function listPromptTemplates(userId, category = null) {
  if (category) {
    return q(
      `SELECT * FROM prompt_templates WHERE user_id = $1 AND category = $2 ORDER BY created_at DESC`,
      [userId, category]
    );
  }
  return q(`SELECT * FROM prompt_templates WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}

async function createPromptTemplate(userId, body) {
  const rows = await q(
    `INSERT INTO prompt_templates
    (user_id, title, description, category, tags, prompt_text, recommended_persona_id, recommended_model, example_output, is_favorite)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10) RETURNING *`,
    [
      userId,
      body.title,
      body.description || '',
      body.category,
      JSON.stringify(body.tags || []),
      body.prompt_text,
      body.recommended_persona_id || null,
      body.recommended_model || null,
      body.example_output || '',
      !!body.is_favorite
    ]
  );
  return rows[0];
}

async function updatePromptTemplate(userId, id, body) {
  const rows = await q(
    `UPDATE prompt_templates SET
      title = COALESCE($3, title),
      description = COALESCE($4, description),
      category = COALESCE($5, category),
      tags = COALESCE($6::jsonb, tags),
      prompt_text = COALESCE($7, prompt_text),
      recommended_persona_id = COALESCE($8, recommended_persona_id),
      recommended_model = COALESCE($9, recommended_model),
      example_output = COALESCE($10, example_output),
      is_favorite = COALESCE($11, is_favorite)
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [
      id,
      userId,
      body.title ?? null,
      body.description ?? null,
      body.category ?? null,
      body.tags ? JSON.stringify(body.tags) : null,
      body.prompt_text ?? null,
      body.recommended_persona_id ?? null,
      body.recommended_model ?? null,
      body.example_output ?? null,
      typeof body.is_favorite === 'boolean' ? body.is_favorite : null
    ]
  );
  return rows[0] || null;
}

async function duplicatePromptTemplate(userId, id) {
  const rows = await q(
    `INSERT INTO prompt_templates
    (user_id, title, description, category, tags, prompt_text, recommended_persona_id, recommended_model, example_output, is_favorite)
    SELECT user_id, title || ' (copy)', description, category, tags, prompt_text, recommended_persona_id, recommended_model, example_output, is_favorite
    FROM prompt_templates WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );
  return rows[0] || null;
}

async function listAssistants(userId) {
  return q(`SELECT * FROM user_assistants WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`, [userId]);
}

async function createAssistant(userId, body) {
  const rows = await q(
    `INSERT INTO user_assistants
    (user_id, name, description, role, instructions, tone, output_format, restrictions, connected_kb_id, default_model, starter_prompts)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING *`,
    [
      userId,
      body.name,
      body.description || '',
      body.role || '',
      body.instructions || '',
      body.tone || '',
      body.output_format || '',
      body.restrictions || '',
      body.connected_kb_id || null,
      body.default_model || null,
      JSON.stringify(body.starter_prompts || [])
    ]
  );
  return rows[0];
}

async function updateAssistant(userId, assistantId, body) {
  const rows = await q(
    `UPDATE user_assistants SET
      name = COALESCE($3, name),
      description = COALESCE($4, description),
      role = COALESCE($5, role),
      instructions = COALESCE($6, instructions),
      tone = COALESCE($7, tone),
      output_format = COALESCE($8, output_format),
      restrictions = COALESCE($9, restrictions),
      connected_kb_id = COALESCE($10, connected_kb_id),
      default_model = COALESCE($11, default_model),
      starter_prompts = COALESCE($12::jsonb, starter_prompts)
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [
      assistantId,
      userId,
      body.name ?? null,
      body.description ?? null,
      body.role ?? null,
      body.instructions ?? null,
      body.tone ?? null,
      body.output_format ?? null,
      body.restrictions ?? null,
      body.connected_kb_id ?? null,
      body.default_model ?? null,
      body.starter_prompts ? JSON.stringify(body.starter_prompts) : null
    ]
  );
  return rows[0] || null;
}

async function softDeleteAssistant(userId, assistantId) {
  const rows = await q(
    `UPDATE user_assistants SET deleted_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id`,
    [assistantId, userId]
  );
  return !!rows[0];
}

async function duplicateAssistant(userId, assistantId) {
  const rows = await q(
    `INSERT INTO user_assistants
    (user_id, name, description, role, instructions, tone, output_format, restrictions, connected_kb_id, default_model, starter_prompts)
    SELECT user_id, name || ' (copy)', description, role, instructions, tone, output_format, restrictions, connected_kb_id, default_model, starter_prompts
    FROM user_assistants WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
    RETURNING *`,
    [assistantId, userId]
  );
  return rows[0] || null;
}

async function createWorkflow(userId, body) {
  const rows = await q(`INSERT INTO workflows (user_id, name, description) VALUES ($1,$2,$3) RETURNING *`, [
    userId,
    body.name,
    body.description || ''
  ]);
  return rows[0];
}

async function addWorkflowStep(workflowId, step) {
  const rows = await q(
    `INSERT INTO workflow_steps (workflow_id, step_order, title, prompt_text)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [workflowId, step.step_order, step.title, step.prompt_text]
  );
  return rows[0];
}

async function getWorkflowForUser(workflowId, userId) {
  const rows = await q(`SELECT * FROM workflows WHERE id = $1 AND user_id = $2`, [workflowId, userId]);
  return rows[0] || null;
}

async function listWorkflowSteps(workflowId) {
  return q(`SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC`, [workflowId]);
}

async function createWorkflowRun(workflowId, userId, inputText) {
  const rows = await q(
    `INSERT INTO workflow_runs (workflow_id, user_id, input_text, status) VALUES ($1,$2,$3,'running') RETURNING *`,
    [workflowId, userId, inputText || '']
  );
  return rows[0];
}

async function addWorkflowStepRun(runId, stepId, outputText, status = 'completed') {
  const rows = await q(
    `INSERT INTO workflow_step_runs (run_id, step_id, output_text, status) VALUES ($1,$2,$3,$4) RETURNING *`,
    [runId, stepId, outputText, status]
  );
  return rows[0];
}

async function finishWorkflowRun(runId, status = 'completed') {
  await q(`UPDATE workflow_runs SET status = $2 WHERE id = $1`, [runId, status]);
}

async function listHallucinationScenarios() {
  return q(`SELECT * FROM hallucination_scenarios ORDER BY created_at DESC`);
}

async function createHallucinationAttempt(input) {
  const rows = await q(
    `INSERT INTO hallucination_attempts
    (scenario_id, user_id, selected_issue, explanation, score, feedback)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [input.scenarioId, input.userId, input.selectedIssue, input.explanation, input.score, input.feedback]
  );
  return rows[0];
}

async function getHallucinationProgress(userId) {
  return q(
    `SELECT COUNT(*)::int AS attempts, COALESCE(AVG(score),0)::numeric(5,2) AS avg_score
     FROM hallucination_attempts WHERE user_id = $1`,
    [userId]
  );
}

async function upsertCourseExerciseFields() {
  await q(`ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS lesson_tasks JSONB DEFAULT '[]'::jsonb`);
  await q(`ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS practice_prompts JSONB DEFAULT '[]'::jsonb`);
  await q(`ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS mini_assignments JSONB DEFAULT '[]'::jsonb`);
  await q(`ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS evaluation_criteria JSONB DEFAULT '[]'::jsonb`);
  await q(`ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS suggested_tools JSONB DEFAULT '[]'::jsonb`);
  await q(`ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS expected_outputs JSONB DEFAULT '[]'::jsonb`);
}

async function upsertCertificate(input) {
  const rows = await q(
    `INSERT INTO certificates (certificate_id, user_id, user_name, course_name, completion_date, completed_modules)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb)
    ON CONFLICT (certificate_id) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      course_name = EXCLUDED.course_name,
      completion_date = EXCLUDED.completion_date,
      completed_modules = EXCLUDED.completed_modules
    RETURNING *`,
    [
      input.certificateId,
      input.userId,
      input.userName,
      input.courseName,
      input.completionDate,
      JSON.stringify(input.completedModules || [])
    ]
  );
  return rows[0];
}

module.exports = {
  initializePracticumSchema,
  upsertBuiltinPersonas,
  seedHallucinationScenarios,
  upsertCourseExerciseFields,
  createKnowledgeBase,
  listKnowledgeBases,
  createKnowledgeDocument,
  listKnowledgeDocuments,
  updateKnowledgeDocument,
  clearChunksForDocument,
  addKnowledgeChunk,
  createIndexJob,
  setIndexJobStatus,
  getKnowledgeDocument,
  getChunksForKnowledgeBase,
  listPersonas,
  createPersona,
  getPersonaForUser,
  listPromptTemplates,
  createPromptTemplate,
  updatePromptTemplate,
  duplicatePromptTemplate,
  listAssistants,
  createAssistant,
  updateAssistant,
  softDeleteAssistant,
  duplicateAssistant,
  createWorkflow,
  addWorkflowStep,
  getWorkflowForUser,
  listWorkflowSteps,
  createWorkflowRun,
  addWorkflowStepRun,
  finishWorkflowRun,
  listHallucinationScenarios,
  createHallucinationAttempt,
  getHallucinationProgress,
  upsertCertificate
};
