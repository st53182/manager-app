const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');
require('dotenv').config();

const { 
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
  updateUserLastLogin
} = require('./database');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdn.tailwindcss.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
    },
  },
}));

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await createUser(email, passwordHash, name);
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }
    
    await updateUserLastLogin(user.id);
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token: token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const team = await createTeam(name, description, req.user.userId);
    res.json(team);
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/teams', authenticateToken, async (req, res) => {
  try {
    const teams = await getTeamsByManager(req.user.userId);
    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const team = await getTeamById(req.params.id);
    if (!team || team.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(team);
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const existingTeam = await getTeamById(req.params.id);
    if (!existingTeam || existingTeam.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = await updateTeam(req.params.id, name, description);
    res.json(team);
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/teams/:id', authenticateToken, async (req, res) => {
  try {
    const existingTeam = await getTeamById(req.params.id);
    if (!existingTeam || existingTeam.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Team not found' });
    }

    await deleteTeam(req.params.id);
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    const { name, email, position, teamId, phone, hireDate } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Employee name is required' });
    }

    if (teamId) {
      const team = await getTeamById(teamId);
      if (!team || team.manager_id !== req.user.userId) {
        return res.status(400).json({ error: 'Invalid team' });
      }
    }

    const employee = await createEmployee(name, email, position, teamId, req.user.userId, phone, hireDate || null);
    res.json(employee);
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const employees = await getEmployeesByManager(req.user.userId);
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/teams/:teamId/employees', authenticateToken, async (req, res) => {
  try {
    const team = await getTeamById(req.params.teamId);
    if (!team || team.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const employees = await getEmployeesByTeam(req.params.teamId);
    res.json(employees);
  } catch (error) {
    console.error('Get team employees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee || employee.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, position, teamId, phone, hireDate } = req.body;
    
    const existingEmployee = await getEmployeeById(req.params.id);
    if (!existingEmployee || existingEmployee.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (teamId) {
      const team = await getTeamById(teamId);
      if (!team || team.manager_id !== req.user.userId) {
        return res.status(400).json({ error: 'Invalid team' });
      }
    }

    const employee = await updateEmployee(req.params.id, name, email, position, teamId, phone, hireDate || null);
    res.json(employee);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    const existingEmployee = await getEmployeeById(req.params.id);
    if (!existingEmployee || existingEmployee.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await deleteEmployee(req.params.id);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/employee/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'employee.html'));
});

app.get('/api/employee/:id', authenticateToken, async (req, res) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee || employee.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    console.error('Get employee profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/employee/:id/profile', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'Secure token required' });
    }

    const tokenData = await validateEmployeeSecureToken(token);
    if (!tokenData || tokenData.employee_id !== req.params.id) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    res.json(tokenData);
  } catch (error) {
    console.error('Get employee profile via token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/employee/:id/profile', async (req, res) => {
  try {
    const token = req.query.token;
    const authHeader = req.headers['authorization'];
    
    let employee;
    let isEmployeeAccess = false;
    
    if (token) {
      const tokenData = await validateEmployeeSecureToken(token);
      if (!tokenData || tokenData.employee_id !== req.params.id) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      employee = await getEmployeeById(req.params.id);
      isEmployeeAccess = true;
    } else if (authHeader) {
      const jwtToken = authHeader.split(' ')[1];
      if (!jwtToken) {
        return res.status(401).json({ error: 'Access token required' });
      }
      
      try {
        const user = jwt.verify(jwtToken, JWT_SECRET);
        employee = await getEmployeeById(req.params.id);
        if (!employee || employee.manager_id !== user.userId) {
          return res.status(404).json({ error: 'Employee not found' });
        }
      } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const updatedEmployee = await updateEmployeeProfile(req.params.id, req.body);
    res.json(updatedEmployee);
  } catch (error) {
    console.error('Update employee profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/employee/:id/secure-link', authenticateToken, async (req, res) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee || employee.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const tokenData = await createEmployeeSecureToken(req.params.id, req.user.userId);
    res.json({ token: tokenData.token, expires_at: tokenData.expires_at });
  } catch (error) {
    console.error('Generate secure link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/employee/:id/disc-test', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.params.id;
    const { answers } = req.body;
    
    if (!answers || Object.keys(answers).length === 0) {
      return res.status(400).json({ error: 'Ответы не предоставлены' });
    }
    
    const scores = calculateDiscScores(answers);
    const personalityType = determinePersonalityType(scores);
    const discData = generateDiscData(personalityType, scores);
    
    const updatedEmployee = await updateEmployeeProfile(employeeId, {
      discType: personalityType,
      discData: discData
    });
    
    if (!updatedEmployee) {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }
    
    res.json({
      personalityType,
      scores,
      discData,
      employee: updatedEmployee
    });
  } catch (error) {
    console.error('Error submitting DISC test:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/employee/:id/disc-test', async (req, res) => {
  try {
    const employeeId = req.params.id;
    const token = req.query.token;
    const { answers } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }
    
    const tokenData = await validateEmployeeSecureToken(token);
    if (!tokenData || tokenData.employee_id !== employeeId) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
    
    if (!answers || Object.keys(answers).length === 0) {
      return res.status(400).json({ error: 'Ответы не предоставлены' });
    }
    
    const scores = calculateDiscScores(answers);
    const personalityType = determinePersonalityType(scores);
    const discData = generateDiscData(personalityType, scores);
    
    const updatedEmployee = await updateEmployeeProfile(employeeId, {
      discType: personalityType,
      discData: discData
    });
    
    if (!updatedEmployee) {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }
    
    res.json({
      personalityType,
      scores,
      discData,
      employee: updatedEmployee
    });
  } catch (error) {
    console.error('Error submitting DISC test via secure token:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/employee/:id/okr-generate', authenticateToken, async (req, res) => {
  try {
    const { context, position, goals } = req.body;
    
    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const employee = await getEmployeeById(req.params.id);
    if (!employee || employee.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const prompt = `Generate 1-3 OKR (Objectives and Key Results) for an employee with the following context:
Position: ${position || employee.position || 'Not specified'}
Context: ${context || 'General professional development'}
Additional goals: ${goals || 'Not specified'}

Return a JSON array of objects with this exact structure:
[
  {
    "objective": "Clear, measurable objective statement",
    "key_results": ["Specific measurable result 1", "Specific measurable result 2", "Specific measurable result 3"],
    "deadline": "2024-12-31",
    "progress": 0,
    "status": "not_started",
    "completed": false,
    "key_results_completed": [false, false, false]
  }
]

Make objectives SMART (Specific, Measurable, Achievable, Relevant, Time-bound). Each objective should have 2-3 key results. Set deadline to end of current quarter. Return only valid JSON without markdown formatting.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000
    });

    let okrs;
    try {
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      okrs = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', response.choices[0].message.content);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    if (!Array.isArray(okrs)) {
      return res.status(500).json({ error: 'AI response is not an array' });
    }

    res.json({ success: true, okrs });
  } catch (error) {
    console.error('Error in okr-generate:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/employee/:id/okr-improve-single', authenticateToken, async (req, res) => {
  try {
    const { text, type, context } = req.body;
    
    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const employee = await getEmployeeById(req.params.id);
    if (!employee || employee.manager_id !== req.user.userId) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const typeText = type === 'objective' ? 'цель' : 'ключевой результат';
    const prompt = `Улучши следующий ${typeText} для сотрудника на позиции "${context}":

Текущий ${typeText}: "${text}"

Сделай его более конкретным, измеримым и достижимым. Верни только улучшенный текст без дополнительных объяснений.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 200
    });

    const improvedText = response.choices[0].message.content.trim();
    
    res.json({ success: true, improvedText });
  } catch (error) {
    console.error('Error in okr-improve-single:', error);
    res.status(500).json({ error: error.message });
  }
});


function calculateDiscScores(answers) {
  const scores = { D: 0, I: 0, S: 0, C: 0 };
  
  const DISC_QUESTIONS = [
    {
      "id": 1,
      "options": [
        {"text": "Быстро и решительно, основываясь на своей интуиции", "type": "D", "score": 3},
        {"text": "После обсуждения с коллегами и получения их мнений", "type": "I", "score": 3},
        {"text": "Тщательно взвесив все за и против, не торопясь", "type": "S", "score": 3},
        {"text": "На основе детального анализа данных и фактов", "type": "C", "score": 3}
      ]
    },
    {
      "id": 2,
      "options": [
        {"text": "Беру инициативу и решаю проблему напрямую", "type": "D", "score": 3},
        {"text": "Стараюсь найти компромисс, который устроит всех", "type": "I", "score": 3},
        {"text": "Выслушиваю все стороны и ищу мирное решение", "type": "S", "score": 3},
        {"text": "Анализирую факты и предлагаю логичное решение", "type": "C", "score": 3}
      ]
    },
    {
      "id": 3,
      "options": [
        {"text": "Ставлю амбициозные цели и стремлюсь к их достижению", "type": "D", "score": 3},
        {"text": "Вдохновляюсь общими целями команды", "type": "I", "score": 3},
        {"text": "Устанавливаю реалистичные цели с учетом своих возможностей", "type": "S", "score": 3},
        {"text": "Определяю четкие, измеримые цели с конкретными критериями", "type": "C", "score": 3}
      ]
    },
    {
      "id": 4,
      "options": [
        {"text": "Прямой и четкий, без лишних слов", "type": "D", "score": 3},
        {"text": "Дружелюбный и открытый, поощряю диалог", "type": "I", "score": 3},
        {"text": "Терпеливый и поддерживающий", "type": "S", "score": 3},
        {"text": "Точный и основанный на фактах", "type": "C", "score": 3}
      ]
    },
    {
      "id": 5,
      "options": [
        {"text": "Фокусируюсь на конечном результате и сроках", "type": "D", "score": 3},
        {"text": "Учитываю мнения всех участников команды", "type": "I", "score": 3},
        {"text": "Создаю стабильный план с минимальными рисками", "type": "S", "score": 3},
        {"text": "Разрабатываю детальный план с четкими этапами", "type": "C", "score": 3}
      ]
    },
    {
      "id": 6,
      "options": [
        {"text": "Быстро признаю ошибку и исправляю ее", "type": "D", "score": 3},
        {"text": "Обсуждаю ошибку с коллегами и ищу решение вместе", "type": "I", "score": 3},
        {"text": "Анализирую причины ошибки, чтобы избежать ее в будущем", "type": "S", "score": 3},
        {"text": "Создаю процедуры для предотвращения подобных ошибок", "type": "C", "score": 3}
      ]
    },
    {
      "id": 7,
      "options": [
        {"text": "Беру контроль и быстро принимаю решения", "type": "D", "score": 3},
        {"text": "Поддерживаю команду и ищу творческие решения", "type": "I", "score": 3},
        {"text": "Остаюсь спокойным и стабилизирую ситуацию", "type": "S", "score": 3},
        {"text": "Систематически анализирую проблему и ищу оптимальное решение", "type": "C", "score": 3}
      ]
    },
    {
      "id": 8,
      "options": [
        {"text": "Вызовы и возможность конкурировать", "type": "D", "score": 3},
        {"text": "Позитивная атмосфера и признание достижений", "type": "I", "score": 3},
        {"text": "Стабильность и поддержка коллег", "type": "S", "score": 3},
        {"text": "Четкие критерии оценки и справедливое вознаграждение", "type": "C", "score": 3}
      ]
    },
    {
      "id": 9,
      "options": [
        {"text": "Сразу приступаю к выполнению и жду результатов", "type": "D", "score": 3},
        {"text": "Понимаю важность задачи и вдохновляюсь на выполнение", "type": "I", "score": 3},
        {"text": "Убеждаюсь, что готов и прошу поддержки при необходимости", "type": "S", "score": 3},
        {"text": "Изучаю детальные инструкции и критерии качества", "type": "C", "score": 3}
      ]
    },
    {
      "id": 10,
      "options": [
        {"text": "Эффективно участвую, фокусируюсь на результатах", "type": "D", "score": 3},
        {"text": "Активно участвую и поощряю других к обсуждению", "type": "I", "score": 3},
        {"text": "Внимательно слушаю и даю всем высказаться", "type": "S", "score": 3},
        {"text": "Готовлюсь заранее и основываюсь на данных", "type": "C", "score": 3}
      ]
    },
    {
      "id": 11,
      "options": [
        {"text": "Быстро адаптируюсь к необходимым изменениям", "type": "D", "score": 3},
        {"text": "Активно участвую в процессе изменений", "type": "I", "score": 3},
        {"text": "Постепенно привыкаю к изменениям, минимизируя стресс", "type": "S", "score": 3},
        {"text": "Изучаю изменения поэтапно с четкими критериями", "type": "C", "score": 3}
      ]
    },
    {
      "id": 12,
      "options": [
        {"text": "Ставлю сложные задачи для быстрого роста", "type": "D", "score": 3},
        {"text": "Учусь через взаимодействие и обмен опытом", "type": "I", "score": 3},
        {"text": "Развиваюсь постепенно в комфортном темпе", "type": "S", "score": 3},
        {"text": "Следую структурированным программам развития", "type": "C", "score": 3}
      ]
    },
    {
      "id": 13,
      "options": [
        {"text": "Брать на себя лидерство и направлять команду", "type": "D", "score": 3},
        {"text": "Поддерживать позитивную атмосферу и мотивировать коллег", "type": "I", "score": 3},
        {"text": "Быть надежным исполнителем и поддерживать других", "type": "S", "score": 3},
        {"text": "Обеспечивать качество и точность выполнения задач", "type": "C", "score": 3}
      ]
    },
    {
      "id": 14,
      "options": [
        {"text": "Оптимизирую процессы для достижения максимальных результатов", "type": "D", "score": 3},
        {"text": "Делаю процессы более интерактивными и вовлекающими", "type": "I", "score": 3},
        {"text": "Поддерживаю стабильные и проверенные процессы", "type": "S", "score": 3},
        {"text": "Создаю детальные и структурированные процессы", "type": "C", "score": 3}
      ]
    },
    {
      "id": 15,
      "options": [
        {"text": "Фокусируюсь на достигнутых результатах и целях", "type": "D", "score": 3},
        {"text": "Учитываю влияние на команду и общую атмосферу", "type": "I", "score": 3},
        {"text": "Оцениваю стабильность и надежность выполнения", "type": "S", "score": 3},
        {"text": "Анализирую качество и соответствие стандартам", "type": "C", "score": 3}
      ]
    }
  ];
  
  for (const [questionId, selectedAnswer] of Object.entries(answers)) {
    const question = DISC_QUESTIONS.find(q => q.id === parseInt(questionId));
    if (question) {
      const option = question.options.find(opt => opt.text === selectedAnswer);
      if (option) {
        scores[option.type] += option.score;
      }
    }
  }
  
  return scores;
}

function determinePersonalityType(scores) {
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topScore = sortedScores[0][1];
  const secondScore = sortedScores[1][1];
  
  const topTypes = sortedScores.filter(([type, score]) => score === topScore).map(([type]) => type);
  
  if (topTypes.length === 1) {
    const scoreDifference = topScore - secondScore;
    if (scoreDifference <= 3) {
      const combinedTypes = {
        'DI': 'Вдохновитель',
        'DS': 'Организатор',
        'DC': 'Организатор', 
        'IS': 'Связной',
        'IC': 'Связной',
        'SC': 'Координатор'
      };
      
      const sortedTopTwo = [topTypes[0], sortedScores[1][0]].sort().join('');
      return combinedTypes[sortedTopTwo] || topTypes[0];
    }
    return topTypes[0];
  } else {
    const combinedTypes = {
      'DI': 'Вдохновитель',
      'DS': 'Организатор',
      'DC': 'Организатор',
      'IS': 'Связной', 
      'IC': 'Связной',
      'SC': 'Координатор'
    };
    
    const sortedTypes = topTypes.sort().join('');
    return combinedTypes[sortedTypes] || topTypes[0];
  }
}

function generateDiscData(personalityType, scores) {
  const discProfiles = {
    'D': {
      strengths: 'Решительность, лидерство, ориентация на результат, быстрое принятие решений',
      challenges: 'Может быть слишком прямолинейным, нетерпеливым к деталям',
      communication: 'Предпочитает краткое, прямое общение, фокус на результатах'
    },
    'I': {
      strengths: 'Коммуникабельность, оптимизм, вдохновение других, творческий подход',
      challenges: 'Может отвлекаться на детали, избегать конфликтов',
      communication: 'Открытое, дружелюбное общение, любит обсуждения'
    },
    'S': {
      strengths: 'Надежность, терпение, поддержка команды, стабильность',
      challenges: 'Может сопротивляться изменениям, избегать рисков',
      communication: 'Спокойное, поддерживающее общение, хороший слушатель'
    },
    'C': {
      strengths: 'Аналитические способности, точность, систематичность, качество',
      challenges: 'Может быть слишком критичным, медленным в принятии решений',
      communication: 'Основанное на фактах, детальное общение'
    },
    'Вдохновитель': {
      strengths: 'Энергичное лидерство, мотивация других, быстрые решения с учетом людей',
      challenges: 'Может быть импульсивным, недооценивать детали',
      communication: 'Динамичное, вдохновляющее общение'
    },
    'Организатор': {
      strengths: 'Эффективное планирование, контроль качества, достижение целей',
      challenges: 'Может быть слишком требовательным, негибким',
      communication: 'Структурированное, целенаправленное общение'
    },
    'Связной': {
      strengths: 'Отличная коммуникация, поддержка команды, адаптивность',
      challenges: 'Может избегать сложных решений, быть слишком дипломатичным',
      communication: 'Гармоничное, поддерживающее общение'
    },
    'Координатор': {
      strengths: 'Методичность, надежность, качественное выполнение задач',
      challenges: 'Может быть медлительным, сопротивляться изменениям',
      communication: 'Осторожное, продуманное общение'
    }
  };
  
  return discProfiles[personalityType] || discProfiles['D'];
}

async function startServer() {
  try {
    await initializeDatabase();
    server.listen(PORT, () => {
      console.log(`Manager app server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
