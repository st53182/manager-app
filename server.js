const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

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
