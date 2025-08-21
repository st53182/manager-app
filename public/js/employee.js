let currentEmployee = null;
let employeeId = null;
let isEmployeeView = false; // true if accessed via employee secure link

const SOFT_SKILLS_DATA = {
    'business_communication': {
        id: 'business_communication',
        position: { x: 200, y: 100 },
        prerequisites: [],
        nameKey: 'soft_skill_business_communication',
        descKey: 'soft_skill_business_communication_desc',
        benefitKey: 'soft_skill_business_communication_benefit'
    },
    'communication': {
        id: 'communication',
        position: { x: 400, y: 100 },
        prerequisites: ['business_communication'],
        nameKey: 'soft_skill_communication',
        descKey: 'soft_skill_communication_desc',
        benefitKey: 'soft_skill_communication_benefit'
    },
    'presentation': {
        id: 'presentation',
        position: { x: 600, y: 100 },
        prerequisites: ['communication'],
        nameKey: 'soft_skill_presentation',
        descKey: 'soft_skill_presentation_desc',
        benefitKey: 'soft_skill_presentation_benefit'
    },
    'client_centricity': {
        id: 'client_centricity',
        position: { x: 100, y: 250 },
        prerequisites: [],
        nameKey: 'soft_skill_client_centricity',
        descKey: 'soft_skill_client_centricity_desc',
        benefitKey: 'soft_skill_client_centricity_benefit'
    },
    'emotional_intelligence': {
        id: 'emotional_intelligence',
        position: { x: 300, y: 250 },
        prerequisites: ['client_centricity'],
        nameKey: 'soft_skill_emotional_intelligence',
        descKey: 'soft_skill_emotional_intelligence_desc',
        benefitKey: 'soft_skill_emotional_intelligence_benefit'
    },
    'mentoring': {
        id: 'mentoring',
        position: { x: 500, y: 250 },
        prerequisites: ['emotional_intelligence', 'communication'],
        nameKey: 'soft_skill_mentoring',
        descKey: 'soft_skill_mentoring_desc',
        benefitKey: 'soft_skill_mentoring_benefit'
    },
    'management': {
        id: 'management',
        position: { x: 700, y: 250 },
        prerequisites: ['mentoring', 'presentation'],
        nameKey: 'soft_skill_management',
        descKey: 'soft_skill_management_desc',
        benefitKey: 'soft_skill_management_benefit'
    },
    'cognitive_flexibility': {
        id: 'cognitive_flexibility',
        position: { x: 150, y: 400 },
        prerequisites: [],
        nameKey: 'soft_skill_cognitive_flexibility',
        descKey: 'soft_skill_cognitive_flexibility_desc',
        benefitKey: 'soft_skill_cognitive_flexibility_benefit'
    },
    'creative_thinking': {
        id: 'creative_thinking',
        position: { x: 350, y: 400 },
        prerequisites: ['cognitive_flexibility'],
        nameKey: 'soft_skill_creative_thinking',
        descKey: 'soft_skill_creative_thinking_desc',
        benefitKey: 'soft_skill_creative_thinking_benefit'
    },
    'critical_thinking': {
        id: 'critical_thinking',
        position: { x: 550, y: 400 },
        prerequisites: ['creative_thinking'],
        nameKey: 'soft_skill_critical_thinking',
        descKey: 'soft_skill_critical_thinking_desc',
        benefitKey: 'soft_skill_critical_thinking_benefit'
    },
    'problem_solving': {
        id: 'problem_solving',
        position: { x: 750, y: 400 },
        prerequisites: ['critical_thinking'],
        nameKey: 'soft_skill_problem_solving',
        descKey: 'soft_skill_problem_solving_desc',
        benefitKey: 'soft_skill_problem_solving_benefit'
    },
    'systems_thinking': {
        id: 'systems_thinking',
        position: { x: 200, y: 550 },
        prerequisites: ['cognitive_flexibility'],
        nameKey: 'soft_skill_systems_thinking',
        descKey: 'soft_skill_systems_thinking_desc',
        benefitKey: 'soft_skill_systems_thinking_benefit'
    },
    'goal_setting': {
        id: 'goal_setting',
        position: { x: 400, y: 550 },
        prerequisites: ['systems_thinking'],
        nameKey: 'soft_skill_goal_setting',
        descKey: 'soft_skill_goal_setting_desc',
        benefitKey: 'soft_skill_goal_setting_benefit'
    },
    'resource_management': {
        id: 'resource_management',
        position: { x: 600, y: 550 },
        prerequisites: ['goal_setting', 'problem_solving'],
        nameKey: 'soft_skill_resource_management',
        descKey: 'soft_skill_resource_management_desc',
        benefitKey: 'soft_skill_resource_management_benefit'
    },
    'stress_management': {
        id: 'stress_management',
        position: { x: 400, y: 700 },
        prerequisites: ['goal_setting'],
        nameKey: 'soft_skill_stress_management',
        descKey: 'soft_skill_stress_management_desc',
        benefitKey: 'soft_skill_stress_management_benefit'
    }
};

const HARD_SKILLS_DATA = {
    'backend': {
        'javascript': { id: 'javascript', position: { x: 200, y: 100 }, prerequisites: [], name: 'JavaScript', desc: 'Programming language for web development', benefit: 'Enables dynamic web applications' },
        'nodejs': { id: 'nodejs', position: { x: 400, y: 100 }, prerequisites: ['javascript'], name: 'Node.js', desc: 'JavaScript runtime for server-side development', benefit: 'Allows full-stack JavaScript development' },
        'express': { id: 'express', position: { x: 600, y: 100 }, prerequisites: ['nodejs'], name: 'Express.js', desc: 'Web framework for Node.js', benefit: 'Simplifies API and web server development' },
        'databases': { id: 'databases', position: { x: 200, y: 250 }, prerequisites: [], name: 'Databases', desc: 'Data storage and retrieval systems', benefit: 'Enables persistent data management' },
        'sql': { id: 'sql', position: { x: 400, y: 250 }, prerequisites: ['databases'], name: 'SQL', desc: 'Language for relational database queries', benefit: 'Allows complex data operations' },
        'mongodb': { id: 'mongodb', position: { x: 600, y: 250 }, prerequisites: ['databases'], name: 'MongoDB', desc: 'NoSQL document database', benefit: 'Provides flexible data modeling' },
        'api_design': { id: 'api_design', position: { x: 800, y: 200 }, prerequisites: ['express'], name: 'API Design', desc: 'Creating well-structured APIs', benefit: 'Improves system integration' },
        'docker': { id: 'docker', position: { x: 300, y: 400 }, prerequisites: ['nodejs'], name: 'Docker', desc: 'Containerization platform', benefit: 'Ensures consistent deployment environments' },
        'testing': { id: 'testing', position: { x: 500, y: 400 }, prerequisites: ['express'], name: 'Testing', desc: 'Automated testing frameworks', benefit: 'Improves code quality and reliability' },
        'security': { id: 'security', position: { x: 700, y: 400 }, prerequisites: ['api_design'], name: 'Security', desc: 'Application security practices', benefit: 'Protects against vulnerabilities' }
    },
    'frontend': {
        'html': { id: 'html', position: { x: 200, y: 100 }, prerequisites: [], name: 'HTML', desc: 'Markup language for web pages', benefit: 'Creates web page structure' },
        'css': { id: 'css', position: { x: 400, y: 100 }, prerequisites: ['html'], name: 'CSS', desc: 'Styling language for web pages', benefit: 'Controls visual presentation' },
        'javascript': { id: 'javascript', position: { x: 600, y: 100 }, prerequisites: ['css'], name: 'JavaScript', desc: 'Programming language for web interactivity', benefit: 'Adds dynamic behavior to web pages' },
        'react': { id: 'react', position: { x: 300, y: 250 }, prerequisites: ['javascript'], name: 'React', desc: 'JavaScript library for building UIs', benefit: 'Simplifies complex UI development' },
        'vue': { id: 'vue', position: { x: 500, y: 250 }, prerequisites: ['javascript'], name: 'Vue.js', desc: 'Progressive JavaScript framework', benefit: 'Provides flexible UI development' },
        'responsive_design': { id: 'responsive_design', position: { x: 700, y: 250 }, prerequisites: ['css'], name: 'Responsive Design', desc: 'Creating mobile-friendly layouts', benefit: 'Ensures cross-device compatibility' },
        'webpack': { id: 'webpack', position: { x: 400, y: 400 }, prerequisites: ['react', 'vue'], name: 'Webpack', desc: 'Module bundler for JavaScript', benefit: 'Optimizes application performance' },
        'testing': { id: 'testing', position: { x: 600, y: 400 }, prerequisites: ['react', 'vue'], name: 'Testing', desc: 'Frontend testing frameworks', benefit: 'Ensures UI reliability' }
    },
    'devops': {
        'linux': { id: 'linux', position: { x: 200, y: 100 }, prerequisites: [], name: 'Linux', desc: 'Operating system fundamentals', benefit: 'Provides server management skills' },
        'bash': { id: 'bash', position: { x: 400, y: 100 }, prerequisites: ['linux'], name: 'Bash Scripting', desc: 'Shell scripting for automation', benefit: 'Automates repetitive tasks' },
        'docker': { id: 'docker', position: { x: 600, y: 100 }, prerequisites: ['linux'], name: 'Docker', desc: 'Containerization platform', benefit: 'Ensures consistent deployments' },
        'kubernetes': { id: 'kubernetes', position: { x: 800, y: 100 }, prerequisites: ['docker'], name: 'Kubernetes', desc: 'Container orchestration platform', benefit: 'Manages containerized applications at scale' },
        'aws': { id: 'aws', position: { x: 300, y: 250 }, prerequisites: ['bash'], name: 'AWS', desc: 'Amazon Web Services cloud platform', benefit: 'Provides scalable cloud infrastructure' },
        'terraform': { id: 'terraform', position: { x: 500, y: 250 }, prerequisites: ['aws'], name: 'Terraform', desc: 'Infrastructure as Code tool', benefit: 'Automates infrastructure provisioning' },
        'monitoring': { id: 'monitoring', position: { x: 700, y: 250 }, prerequisites: ['kubernetes'], name: 'Monitoring', desc: 'System monitoring and alerting', benefit: 'Ensures system reliability' },
        'ci_cd': { id: 'ci_cd', position: { x: 400, y: 400 }, prerequisites: ['terraform'], name: 'CI/CD', desc: 'Continuous integration and deployment', benefit: 'Automates software delivery' }
    }
};

let currentSkillTreeData = {};
let skillTreeState = {
    softSkills: {
        mastered: [],
        selected: []
    },
    hardSkills: {
        mastered: [],
        selected: []
    },
    competencyArea: 'backend'
};

function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user_info');
    
    const urlParams = new URLSearchParams(window.location.search);
    const employeeToken = urlParams.get('token');
    
    if (employeeToken) {
        isEmployeeView = true;
        return employeeToken;
    }
    
    if (!token || !user) {
        window.location.href = '/login';
        return false;
    }
    
    const userInfo = JSON.parse(user);
    document.getElementById('userName').textContent = userInfo.name;
    return token;
}

function getEmployeeIdFromUrl() {
    const path = window.location.pathname;
    const matches = path.match(/\/employee\/([a-f0-9-]+)/);
    return matches ? matches[1] : null;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
        'bg-red-50 border border-red-200 text-red-800'
    }`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function getInitials(name) {
    if (!name) return '??';
    return name.split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

async function loadEmployeeProfile() {
    const token = checkAuth();
    if (!token) return;

    employeeId = getEmployeeIdFromUrl();
    if (!employeeId) {
        showToast('Неверный ID сотрудника', 'error');
        return;
    }

    try {
        const endpoint = isEmployeeView ? 
            `/api/employee/${employeeId}/profile?token=${token}` : 
            `/api/employee/${employeeId}`;
            
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(endpoint, { headers });
        
        if (!response.ok) {
            throw new Error('Не удалось загрузить профиль сотрудника');
        }

        currentEmployee = await response.json();
        displayEmployeeProfile(currentEmployee);
        window.currentEmployee = currentEmployee;

        
    } catch (error) {
        console.error('Error loading employee profile:', error);
        showToast('Ошибка загрузки профиля сотрудника', 'error');
    } finally {
        document.getElementById('loadingIndicator').classList.add('hidden');
    }
}

function displayEmployeeProfile(employee) {
    document.getElementById('employeeName').textContent = employee.name || 'Имя не указано';
    document.getElementById('employeePosition').textContent = employee.position || 'Должность не указана';
    document.getElementById('employeeTeam').textContent = employee.team_name || 'Без команды';
    document.getElementById('employeeEmail').textContent = employee.email || '';
    document.getElementById('employeePhone').textContent = employee.phone || '';
    document.getElementById('employeeHireDate').textContent = employee.hire_date ? 
        `Принят: ${formatDate(employee.hire_date)}` : '';

    const initials = getInitials(employee.name);
    document.getElementById('employeeInitials').textContent = initials;

    document.getElementById('basicName').textContent = employee.name || '-';
    document.getElementById('basicEmail').textContent = employee.email || '-';
    document.getElementById('basicPosition').textContent = employee.position || '-';
    document.getElementById('basicTeamName').textContent = employee.team_name || 'Без команды';
    document.getElementById('basicPhone').textContent = employee.phone || '-';
    document.getElementById('basicHireDate').textContent = formatDate(employee.hire_date);

    displayOkrGoals(employee.okr_goals || []);

    displayDiscPersonality(employee.disc_type, employee.disc_data);

    displayDevelopmentPlan(employee.development_plan || []);

    document.getElementById('roles').textContent = employee.roles || '-';
    document.getElementById('timeZone').textContent = employee.time_zone || '-';
    document.getElementById('domains').textContent = employee.domains || '-';
    document.getElementById('expertise').textContent = employee.expertise || '-';
    document.getElementById('personalInterests').textContent = employee.personal_interests || '-';
    document.getElementById('stakeholders').textContent = employee.stakeholders || '-';
    document.getElementById('importantTraits').textContent = employee.important_traits || '-';

    document.getElementById('commChannels').textContent = employee.comm_channels || '-';
    document.getElementById('meetingTimes').textContent = employee.meeting_times || '-';
    document.getElementById('commStyle').textContent = employee.comm_style || '-';

    document.getElementById('workStyle').textContent = employee.work_style || '-';
    document.getElementById('motivators').textContent = employee.motivators || '-';
    document.getElementById('demotivators').textContent = employee.demotivators || '-';

    if (window.translationManager && window.translationManager.translations && 
        (window.translationManager.translations.ru || window.translationManager.translations.en)) {
        initializeMotivationalTriggers();
        setupWorkspaceDropZone();
    } else {
        setTimeout(() => {
            initializeMotivationalTriggers();
            setupWorkspaceDropZone();
        }, 500);
    }

    if (isEmployeeView) {
        document.getElementById('shareProfileBtn').style.display = 'none';
    }
}

function displayOkrGoals(goals) {
    const container = document.getElementById('okrContent');
    
    if (!goals || goals.length === 0) {
        container.innerHTML = `
            <div class="text-gray-500 text-center py-8" data-translate="employee.no_okr_goals">
                OKR цели не установлены
            </div>
        `;
        return;
    }

    container.innerHTML = goals.map((goal, goalIndex) => {
        const progress = calculateOkrProgress(goal);
        const timeRemaining = calculateTimeRemaining(goal.deadline);
        const isOverdue = timeRemaining.isOverdue;
        
        return `
            <div class="border border-gray-200 rounded-lg p-4 mb-4">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <input type="checkbox" 
                               id="objective-${goalIndex}" 
                               ${goal.completed ? 'checked' : ''} 
                               onchange="toggleOkrCompletion(${goalIndex}, 'objective')"
                               class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                        <h4 class="font-medium text-gray-900 ${goal.completed ? 'line-through text-gray-500' : ''}">${goal.objective || 'Цель не указана'}</h4>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs px-2 py-1 rounded-full ${
                            goal.completed ? 'bg-green-100 text-green-800' :
                            goal.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            isOverdue ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                        }" data-translate="employee.okr_${goal.completed ? 'completed' : goal.status || 'not_started'}">
                            ${goal.completed ? 'Выполнено' :
                              goal.status === 'in_progress' ? 'В процессе' : 
                              isOverdue ? 'Просрочено' : 'Не начато'}
                        </span>
                        <button onclick="editOkr(${goalIndex})" class="text-blue-600 hover:text-blue-800 text-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button onclick="deleteOkr(${goalIndex})" class="text-red-600 hover:text-red-800 text-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="mb-3">
                    <div class="flex justify-between text-sm text-gray-600 mb-1">
                        <span data-translate="employee.okr_progress">Прогресс</span>
                        <span>${progress}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                </div>
                
                <!-- Time Remaining -->
                ${goal.deadline ? `
                    <div class="mb-3 text-sm ${isOverdue ? 'text-red-600' : 'text-gray-600'}">
                        <span data-translate="employee.okr_time_remaining">Осталось времени</span>: 
                        ${isOverdue ? 
                            `<span class="font-medium" data-translate="employee.okr_overdue">Просрочено</span>` :
                            `<span class="font-medium">${timeRemaining.days} <span data-translate="employee.okr_days">дней</span></span>`
                        }
                        <span class="text-gray-400 ml-2">до ${formatDate(goal.deadline)}</span>
                    </div>
                ` : ''}
                
                <!-- Key Results -->
                ${goal.key_results && goal.key_results.length > 0 ? `
                    <div class="space-y-2">
                        <p class="text-sm font-medium text-gray-700">Ключевые результаты:</p>
                        <ul class="space-y-2">
                            ${goal.key_results.map((kr, krIndex) => `
                                <li class="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" 
                                           id="kr-${goalIndex}-${krIndex}" 
                                           ${goal.key_results_completed && goal.key_results_completed[krIndex] ? 'checked' : ''} 
                                           onchange="toggleOkrCompletion(${goalIndex}, 'key_result', ${krIndex})"
                                           class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                    <span class="${goal.key_results_completed && goal.key_results_completed[krIndex] ? 'line-through text-gray-500' : 'text-gray-600'}">${kr}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function displayDiscPersonality(discType, discData) {
    const typeElement = document.getElementById('discType');
    const descriptionElement = document.getElementById('discDescription');
    const detailsElement = document.getElementById('discDetails');

    if (!discType) {
        typeElement.textContent = '?';
        descriptionElement.textContent = 'Тип личности не определен';
        detailsElement.classList.add('hidden');
        return;
    }

    typeElement.textContent = discType.toUpperCase();
    
    const discDescriptions = {
        'D': 'Соратник - Прямой, решительный, ориентированный на результат',
        'I': 'Энтузиаст - Общительный, оптимистичный, вдохновляющий',
        'S': 'Миротворец - Терпеливый, надежный, поддерживающий',
        'C': 'Аналитик - Аналитический, точный, систематичный',
        'DI': 'Вдохновитель - Энергичный лидер, мотивирующий других',
        'DS': 'Организатор - Решительный и стабильный исполнитель',
        'DC': 'Организатор - Требовательный и систематичный лидер',
        'IS': 'Связной - Дружелюбный и поддерживающий коммуникатор',
        'IC': 'Связной - Влиятельный и детально-ориентированный',
        'SC': 'Координатор - Терпеливый и методичный исполнитель'
    };

    descriptionElement.textContent = discDescriptions[discType.toUpperCase()] || 'Описание недоступно';

    if (discData) {
        document.getElementById('discStrengths').textContent = discData.strengths || '-';
        document.getElementById('discChallenges').textContent = discData.challenges || '-';
        document.getElementById('discCommunication').textContent = discData.communication || '-';
        detailsElement.classList.remove('hidden');
    } else {
        detailsElement.classList.add('hidden');
    }
}

function displayDevelopmentPlan(plan) {
    const container = document.getElementById('developmentContent');
    
    if (!plan || (!plan.softSkills && !plan.hardSkills && plan.length === 0)) {
        container.innerHTML = `
            <div class="text-gray-500 text-center py-8" data-translate="employee.no_development_plan">
                План развития не создан
            </div>
        `;
        return;
    }

    if (plan.softSkills || plan.hardSkills) {
        const softSkills = plan.softSkills || {};
        const hardSkills = plan.hardSkills || {};
        
        container.innerHTML = `
            <div class="space-y-6">
                ${softSkills.selected && softSkills.selected.length > 0 ? `
                    <div class="border border-gray-200 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3" data-translate="soft_skills">Софт скиллы</h4>
                        <div class="space-y-2">
                            ${softSkills.selected.map(skillId => {
                                const skill = SOFT_SKILLS_DATA[skillId];
                                const skillName = skill ? (window.translationManager ? window.translationManager.t(skill.nameKey) : skill.nameKey) : skillId;
                                const isMastered = softSkills.mastered && softSkills.mastered.includes(skillId);
                                return `
                                    <div class="flex items-center justify-between p-2 bg-blue-50 rounded">
                                        <span class="text-sm font-medium text-blue-900">${skillName}</span>
                                        <span class="text-xs px-2 py-1 rounded-full ${isMastered ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">
                                            ${isMastered ? 'Освоен' : 'В развитии'}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
                ${hardSkills.selected && hardSkills.selected.length > 0 ? `
                    <div class="border border-gray-200 rounded-lg p-4">
                        <h4 class="font-medium text-gray-900 mb-3" data-translate="hard_skills">Хард скиллы</h4>
                        <div class="space-y-2">
                            ${hardSkills.selected.map(skillId => {
                                const competencyArea = hardSkills.competencyArea || 'backend';
                                const skill = HARD_SKILLS_DATA[competencyArea] && HARD_SKILLS_DATA[competencyArea][skillId];
                                const skillName = skill ? skill.name : skillId;
                                const isMastered = hardSkills.mastered && hardSkills.mastered.includes(skillId);
                                return `
                                    <div class="flex items-center justify-between p-2 bg-purple-50 rounded">
                                        <span class="text-sm font-medium text-purple-900">${skillName}</span>
                                        <span class="text-xs px-2 py-1 rounded-full ${isMastered ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}">
                                            ${isMastered ? 'Освоен' : 'В развитии'}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = plan.map(item => `
        <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-start justify-between mb-2">
                <h4 class="font-medium text-gray-900">${item.skill || 'Навык не указан'}</h4>
                <span class="text-xs px-2 py-1 rounded-full ${
                    item.priority === 'high' ? 'bg-red-100 text-red-800' :
                    item.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                }">
                    ${item.priority === 'high' ? 'Высокий' :
                      item.priority === 'medium' ? 'Средний' : 'Низкий'}
                </span>
            </div>
            ${item.description ? `
                <p class="text-sm text-gray-600 mb-2">${item.description}</p>
            ` : ''}
            ${item.actions ? `
                <div class="space-y-1">
                    <p class="text-sm font-medium text-gray-700">Действия:</p>
                    <ul class="text-sm text-gray-600 space-y-1">
                        ${item.actions.map(action => `<li>• ${action}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${item.deadline ? `
                <p class="text-xs text-gray-500 mt-2">Срок: ${formatDate(item.deadline)}</p>
            ` : ''}
        </div>
    `).join('');
}

async function persistMotivationalTriggers() {
  const token = checkAuth();
  if (!token || !employeeId) return;

  const headers = isEmployeeView
    ? { 'Content-Type': 'application/json' }
    : { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const endpoint = isEmployeeView
    ? `/employee/${employeeId}/profile?token=${token}`
    : `/api/employee/${employeeId}/profile`;

  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        // отправляем только нужное поле, чтобы ничего лишнего не затирать
        motivationalTriggers: currentEmployee.motivational_triggers || []
      })
    });
    if (response.ok) {
      const updated = await response.json();
      currentEmployee = updated;
      window.currentEmployee = updated;
    } else {
      console.warn('Failed to persist motivational triggers');
    }
  } catch (err) {
    console.error('Persist motivators error:', err);
  }
}


async function generateSecureLink() {
    const token = checkAuth();
    if (!token || !employeeId) return;

    try {
        const response = await fetch(`/api/employee/${employeeId}/secure-link`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Secure link generation failed:', response.status, errorText);
            throw new Error('Не удалось создать защищенную ссылку');
        }

        const data = await response.json();
        const secureUrl = `${window.location.origin}/employee/${employeeId}?token=${data.token}`;
        
        document.getElementById('shareLink').value = secureUrl;
        document.getElementById('shareModal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error generating secure link:', error);
        showToast('Ошибка создания защищенной ссылки', 'error');
    }
}

function copyToClipboard() {
    const linkInput = document.getElementById('shareLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    
    try {
        document.execCommand('copy');
        showToast('Ссылка скопирована в буфер обмена');
    } catch (err) {
        console.error('Failed to copy: ', err);
        showToast('Не удалось скопировать ссылку', 'error');
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', function() {
    employeeId = getEmployeeIdFromUrl();
    loadEmployeeProfile();

    document.getElementById('langRu').addEventListener('click', () => window.translationManager.setLanguage('ru'));
    document.getElementById('langEn').addEventListener('click', () => window.translationManager.setLanguage('en'));

    document.getElementById('shareProfileBtn').addEventListener('click', generateSecureLink);
    document.getElementById('closeShareModal').addEventListener('click', () => {
        document.getElementById('shareModal').classList.add('hidden');
    });
    document.getElementById('copyLinkBtn').addEventListener('click', copyToClipboard);

    document.getElementById('editProfileBtn').addEventListener('click', showEditModal);

    document.getElementById('addOkrBtn').addEventListener('click', openOkrModal);
    
    document.getElementById('setDiscBtn').addEventListener('click', openDiscModal);
    
    document.getElementById('addDevelopmentBtn').addEventListener('click', () => {
        openSkillTreeModal();
    });

    document.getElementById('closeSkillTreeModal').addEventListener('click', closeSkillTreeModal);
    document.getElementById('cancelSkillTree').addEventListener('click', closeSkillTreeModal);
    document.getElementById('saveSkillTree').addEventListener('click', saveSkillTreeData);
    document.getElementById('resetSkillSelection').addEventListener('click', resetSkillSelection);
    
    document.getElementById('softSkillsTab').addEventListener('click', () => switchSkillTreeTab('soft'));
    document.getElementById('hardSkillsTab').addEventListener('click', () => switchSkillTreeTab('hard'));

    initializeSkillTreeModal();

    document.getElementById('shareModal').addEventListener('click', (e) => {
        if (e.target.id === 'shareModal') {
            document.getElementById('shareModal').classList.add('hidden');
        }
    });

    document.getElementById('closeEditModal').addEventListener('click', hideEditModal);
    document.getElementById('cancelEditBtn').addEventListener('click', hideEditModal);
    document.getElementById('editProfileForm').addEventListener('submit', saveProfileChanges);
    
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') {
            hideEditModal();
        }
    });

    initializeTagInputs();
    initializeDiscModal();
});

function initializeSkillTreeModal() {
    if (currentEmployee && currentEmployee.development_plan) {
        const plan = currentEmployee.development_plan;
        if (plan.softSkills || plan.hardSkills) {
            skillTreeState = {
                softSkills: plan.softSkills || { mastered: [], selected: [] },
                hardSkills: plan.hardSkills || { mastered: [], selected: [] },
                competencyArea: plan.hardSkills?.competencyArea || getCompetencyAreaFromDomains()
            };
        }
    }
}

function getCompetencyAreaFromDomains() {
    if (!currentEmployee || !currentEmployee.domains) return 'backend';
    
    const domains = currentEmployee.domains.toLowerCase();
    if (domains.includes('frontend') || domains.includes('фронтенд')) return 'frontend';
    if (domains.includes('devops') || domains.includes('девопс')) return 'devops';
    if (domains.includes('backend') || domains.includes('бэкенд')) return 'backend';
    if (domains.includes('qa') || domains.includes('тестирование')) return 'qa';
    if (domains.includes('data') || domains.includes('данные')) return 'data-analyst';
    if (domains.includes('ios')) return 'ios';
    if (domains.includes('android')) return 'android';
    if (domains.includes('ux') || domains.includes('дизайн')) return 'ux-design';
    
    return 'backend';
}

function openSkillTreeModal() {
    document.getElementById('skillTreeModal').classList.remove('hidden');
    initializeSkillTreeModal();
    renderSkillTree('soft');
    updateSkillCounters();
    updateCompetencyAreaDisplay();
}

function closeSkillTreeModal() {
    document.getElementById('skillTreeModal').classList.add('hidden');
    document.getElementById('skillDetailsPanel').classList.add('hidden');
}

function switchSkillTreeTab(type) {
    document.querySelectorAll('.skill-tree-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (type === 'soft') {
        document.getElementById('softSkillsTab').classList.add('active');
        document.getElementById('softSkillsTree').classList.remove('hidden');
        document.getElementById('hardSkillsTree').classList.add('hidden');
        renderSkillTree('soft');
    } else {
        document.getElementById('hardSkillsTab').classList.add('active');
        document.getElementById('softSkillsTree').classList.add('hidden');
        document.getElementById('hardSkillsTree').classList.remove('hidden');
        renderSkillTree('hard');
    }
}

function renderSkillTree(type) {
    const svgId = type === 'soft' ? 'softSkillsTreeSvg' : 'hardSkillsTreeSvg';
    const svg = document.getElementById(svgId);
    
    if (!svg) return;
    
    svg.innerHTML = '';
    
    let skillsData;
    if (type === 'soft') {
        skillsData = SOFT_SKILLS_DATA;
    } else {
        const competencyArea = skillTreeState.competencyArea;
        skillsData = HARD_SKILLS_DATA[competencyArea] || HARD_SKILLS_DATA.backend;
    }
    
    currentSkillTreeData = skillsData;
    
    Object.values(skillsData).forEach(skill => {
        skill.prerequisites.forEach(prereqId => {
            const prereq = skillsData[prereqId];
            if (prereq) {
                drawConnection(svg, prereq.position, skill.position, isConnectionActive(prereqId, skill.id, type));
            }
        });
    });
    
    Object.values(skillsData).forEach(skill => {
        drawSkillNode(svg, skill, type);
    });
    
    addSkillLegend(svg);
}

function drawConnection(svg, fromPos, toPos, isActive) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fromPos.x);
    line.setAttribute('y1', fromPos.y);
    line.setAttribute('x2', toPos.x);
    line.setAttribute('y2', toPos.y);
    line.setAttribute('class', `skill-connection ${isActive ? 'active' : ''}`);
    svg.appendChild(line);
}

function drawSkillNode(svg, skill, type) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', `skill-node ${getSkillState(skill.id, type)}`);
    group.setAttribute('data-skill-id', skill.id);
    group.setAttribute('data-skill-type', type);
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', skill.position.x);
    circle.setAttribute('cy', skill.position.y);
    circle.setAttribute('class', 'skill-node-circle');
    group.appendChild(circle);
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', skill.position.x);
    text.setAttribute('y', skill.position.y);
    text.setAttribute('class', 'skill-node-text');
    
    let skillName;
    if (type === 'soft') {
        skillName = window.translationManager ? window.translationManager.t(skill.nameKey) : skill.nameKey;
    } else {
        skillName = skill.name;
    }
    
    const words = skillName.split(' ');
    if (words.length > 2) {
        const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan1.setAttribute('x', skill.position.x);
        tspan1.setAttribute('dy', '-0.3em');
        tspan1.textContent = words.slice(0, Math.ceil(words.length / 2)).join(' ');
        text.appendChild(tspan1);
        
        const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan2.setAttribute('x', skill.position.x);
        tspan2.setAttribute('dy', '1em');
        tspan2.textContent = words.slice(Math.ceil(words.length / 2)).join(' ');
        text.appendChild(tspan2);
    } else {
        text.textContent = skillName;
    }
    
    group.appendChild(text);
    
    group.addEventListener('click', () => handleSkillClick(skill.id, type));
    group.addEventListener('mouseenter', () => showSkillDetails(skill, type));
    group.addEventListener('mouseleave', () => hideSkillDetails());
    
    svg.appendChild(group);
}

function getSkillState(skillId, type) {
    const skills = skillTreeState[type === 'soft' ? 'softSkills' : 'hardSkills'];
    
    if (skills.mastered.includes(skillId)) {
        return 'mastered';
    }
    
    if (skills.selected.includes(skillId)) {
        return 'selected';
    }
    
    if (isSkillUnlocked(skillId, type)) {
        return 'available';
    }
    
    return 'locked';
}

function isSkillUnlocked(skillId, type) {
    const skill = currentSkillTreeData[skillId];
    if (!skill) return false;
    
    const skills = skillTreeState[type === 'soft' ? 'softSkills' : 'hardSkills'];
    
    return skill.prerequisites.every(prereqId => skills.mastered.includes(prereqId));
}

function isConnectionActive(fromSkillId, toSkillId, type) {
    const skills = skillTreeState[type === 'soft' ? 'softSkills' : 'hardSkills'];
    return skills.mastered.includes(fromSkillId) && (skills.mastered.includes(toSkillId) || skills.selected.includes(toSkillId));
}

function handleSkillClick(skillId, type) {
    const state = getSkillState(skillId, type);
    const skills = skillTreeState[type === 'soft' ? 'softSkills' : 'hardSkills'];
    
    if (state === 'locked') {
        showToast(window.translationManager ? window.translationManager.t('prerequisite_required') : 'Требуется изучить предварительные навыки');
        return;
    }
    
    if (state === 'mastered') {
        const index = skills.mastered.indexOf(skillId);
        if (index > -1) {
            skills.mastered.splice(index, 1);
        }
    } else if (state === 'selected') {
        const index = skills.selected.indexOf(skillId);
        if (index > -1) {
            skills.selected.splice(index, 1);
        }
    } else if (state === 'available') {
        if (skills.selected.length >= 3) {
            showToast('Максимум 3 навыка для развития в каждой категории');
            return;
        }
        
        skills.selected.push(skillId);
    }
    
    renderSkillTree(type);
    updateSkillCounters();
}

function showSkillDetails(skill, type) {
    const panel = document.getElementById('skillDetailsPanel');
    const title = document.getElementById('skillDetailTitle');
    const description = document.getElementById('skillDetailDescription');
    const benefit = document.getElementById('skillDetailBenefit');
    
    if (type === 'soft') {
        title.textContent = window.translationManager ? window.translationManager.t(skill.nameKey) : skill.nameKey;
        description.textContent = window.translationManager ? window.translationManager.t(skill.descKey) : skill.descKey;
        benefit.textContent = window.translationManager ? window.translationManager.t(skill.benefitKey) : skill.benefitKey;
    } else {
        title.textContent = skill.name;
        description.textContent = skill.desc;
        benefit.textContent = skill.benefit;
    }
    
    panel.classList.remove('hidden');
}

function hideSkillDetails() {
    setTimeout(() => {
        if (!document.getElementById('skillDetailsPanel').matches(':hover')) {
            document.getElementById('skillDetailsPanel').classList.add('hidden');
        }
    }, 100);
}

function updateSkillCounters() {
    const softCounter = document.getElementById('softSkillsCounter');
    const hardCounter = document.getElementById('hardSkillsCounter');
    
    softCounter.textContent = `${skillTreeState.softSkills.selected.length}/3`;
    hardCounter.textContent = `${skillTreeState.hardSkills.selected.length}/3`;
}

function updateCompetencyAreaDisplay() {
    const display = document.getElementById('currentCompetencyArea');
    const competencyArea = skillTreeState.competencyArea;
    
    const areaNames = {
        'backend': 'Backend Development',
        'frontend': 'Frontend Development',
        'devops': 'DevOps',
        'qa': 'QA Testing',
        'data-analyst': 'Data Analysis',
        'ios': 'iOS Development',
        'android': 'Android Development',
        'ux-design': 'UX Design'
    };
    
    display.textContent = areaNames[competencyArea] || competencyArea;
}

function addSkillLegend(svg) {
    const legend = document.createElement('div');
    legend.className = 'skill-legend';
    legend.innerHTML = `
        <div class="skill-legend-item">
            <div class="skill-legend-circle skill-legend-available"></div>
            <span>Доступен</span>
        </div>
        <div class="skill-legend-item">
            <div class="skill-legend-circle skill-legend-selected"></div>
            <span>Выбран</span>
        </div>
        <div class="skill-legend-item">
            <div class="skill-legend-circle skill-legend-mastered"></div>
            <span>Освоен</span>
        </div>
        <div class="skill-legend-item">
            <div class="skill-legend-circle skill-legend-locked"></div>
            <span>Заблокирован</span>
        </div>
    `;
    
    svg.parentElement.style.position = 'relative';
    svg.parentElement.appendChild(legend);
}

function resetSkillSelection() {
    skillTreeState.softSkills.selected = [];
    skillTreeState.hardSkills.selected = [];
    
    const currentTab = document.querySelector('.skill-tree-tab.active');
    const type = currentTab.id === 'softSkillsTab' ? 'soft' : 'hard';
    renderSkillTree(type);
    updateSkillCounters();
    
    showToast('Выбор навыков сброшен');
}

async function saveSkillTreeData() {
    const token = checkAuth();
    if (!token || !employeeId) return;
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        let endpoint;
        if (token.startsWith('Bearer ')) {
            headers['Authorization'] = token;
            endpoint = `/api/employee/${employeeId}/profile`;
        } else {
            endpoint = `/api/employee/${employeeId}/profile?token=${token}`;
        }
        
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
                developmentPlan: {
                    softSkills: skillTreeState.softSkills,
                    hardSkills: {
                        ...skillTreeState.hardSkills,
                        competencyArea: skillTreeState.competencyArea
                    }
                }
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save skill tree');
        }
        
        const updatedEmployee = await response.json();
        currentEmployee = updatedEmployee;
        
        displayDevelopmentPlan(updatedEmployee.development_plan);
        
        closeSkillTreeModal();
        showToast('Карта навыков сохранена');
        
    } catch (error) {
        console.error('Error saving skill tree:', error);
        showToast('Ошибка при сохранении карты навыков');
    }
}

const DISC_QUESTIONS = [
    {
        "id": 1,
        "question": "Как сотрудник, я предпочитаю принимать решения:",
        "options": [
            {"text": "Быстро и решительно, основываясь на своей интуиции", "type": "D", "score": 3},
            {"text": "После обсуждения с коллегами и получения их мнений", "type": "I", "score": 3},
            {"text": "Тщательно взвесив все за и против, не торопясь", "type": "S", "score": 3},
            {"text": "На основе детального анализа данных и фактов", "type": "C", "score": 3}
        ]
    },
    {
        "id": 2,
        "question": "В конфликтной ситуации в команде я:",
        "options": [
            {"text": "Беру инициативу и решаю проблему напрямую", "type": "D", "score": 3},
            {"text": "Стараюсь найти компромисс, который устроит всех", "type": "I", "score": 3},
            {"text": "Выслушиваю все стороны и ищу мирное решение", "type": "S", "score": 3},
            {"text": "Анализирую факты и предлагаю логичное решение", "type": "C", "score": 3}
        ]
    },
    {
        "id": 3,
        "question": "При работе над целями я:",
        "options": [
            {"text": "Ставлю амбициозные цели и стремлюсь к их достижению", "type": "D", "score": 3},
            {"text": "Вдохновляюсь общими целями команды", "type": "I", "score": 3},
            {"text": "Устанавливаю реалистичные цели с учетом своих возможностей", "type": "S", "score": 3},
            {"text": "Определяю четкие, измеримые цели с конкретными критериями", "type": "C", "score": 3}
        ]
    },
    {
        "id": 4,
        "question": "Мой стиль коммуникации с коллегами:",
        "options": [
            {"text": "Прямой и четкий, без лишних слов", "type": "D", "score": 3},
            {"text": "Дружелюбный и открытый, поощряю диалог", "type": "I", "score": 3},
            {"text": "Терпеливый и поддерживающий", "type": "S", "score": 3},
            {"text": "Точный и основанный на фактах", "type": "C", "score": 3}
        ]
    },
    {
        "id": 5,
        "question": "При планировании проектов я:",
        "options": [
            {"text": "Фокусируюсь на конечном результате и сроках", "type": "D", "score": 3},
            {"text": "Учитываю мнения всех участников команды", "type": "I", "score": 3},
            {"text": "Создаю стабильный план с минимальными рисками", "type": "S", "score": 3},
            {"text": "Разрабатываю детальный план с четкими этапами", "type": "C", "score": 3}
        ]
    },
    {
        "id": 6,
        "question": "Когда я делаю ошибку, я:",
        "options": [
            {"text": "Быстро признаю ошибку и исправляю ее", "type": "D", "score": 3},
            {"text": "Обсуждаю ошибку с коллегами и ищу решение вместе", "type": "I", "score": 3},
            {"text": "Анализирую причины ошибки, чтобы избежать ее в будущем", "type": "S", "score": 3},
            {"text": "Создаю процедуры для предотвращения подобных ошибок", "type": "C", "score": 3}
        ]
    },
    {
        "id": 7,
        "question": "В стрессовых ситуациях я:",
        "options": [
            {"text": "Беру контроль и быстро принимаю решения", "type": "D", "score": 3},
            {"text": "Поддерживаю команду и ищу творческие решения", "type": "I", "score": 3},
            {"text": "Остаюсь спокойным и стабилизирую ситуацию", "type": "S", "score": 3},
            {"text": "Систематически анализирую проблему и ищу оптимальное решение", "type": "C", "score": 3}
        ]
    },
    {
        "id": 8,
        "question": "Моя мотивация в работе:",
        "options": [
            {"text": "Вызовы и возможность конкурировать", "type": "D", "score": 3},
            {"text": "Позитивная атмосфера и признание достижений", "type": "I", "score": 3},
            {"text": "Стабильность и поддержка коллег", "type": "S", "score": 3},
            {"text": "Четкие критерии оценки и справедливое вознаграждение", "type": "C", "score": 3}
        ]
    },
    {
        "id": 9,
        "question": "При получении задач я:",
        "options": [
            {"text": "Сразу приступаю к выполнению и жду результатов", "type": "D", "score": 3},
            {"text": "Понимаю важность задачи и вдохновляюсь на выполнение", "type": "I", "score": 3},
            {"text": "Убеждаюсь, что готов и прошу поддержки при необходимости", "type": "S", "score": 3},
            {"text": "Изучаю детальные инструкции и критерии качества", "type": "C", "score": 3}
        ]
    },
    {
        "id": 10,
        "question": "На совещаниях я:",
        "options": [
            {"text": "Эффективно участвую, фокусируюсь на результатах", "type": "D", "score": 3},
            {"text": "Активно участвую и поощряю других к обсуждению", "type": "I", "score": 3},
            {"text": "Внимательно слушаю и даю всем высказаться", "type": "S", "score": 3},
            {"text": "Готовлюсь заранее и основываюсь на данных", "type": "C", "score": 3}
        ]
    },
    {
        "id": 11,
        "question": "При внедрении изменений в работе я:",
        "options": [
            {"text": "Быстро адаптируюсь к необходимым изменениям", "type": "D", "score": 3},
            {"text": "Активно участвую в процессе изменений", "type": "I", "score": 3},
            {"text": "Постепенно привыкаю к изменениям, минимизируя стресс", "type": "S", "score": 3},
            {"text": "Изучаю изменения поэтапно с четкими критериями", "type": "C", "score": 3}
        ]
    },
    {
        "id": 12,
        "question": "Мой подход к развитию навыков:",
        "options": [
            {"text": "Ставлю сложные задачи для быстрого роста", "type": "D", "score": 3},
            {"text": "Учусь через взаимодействие и обмен опытом", "type": "I", "score": 3},
            {"text": "Развиваюсь постепенно в комфортном темпе", "type": "S", "score": 3},
            {"text": "Следую структурированным программам развития", "type": "C", "score": 3}
        ]
    },
    {
        "id": 13,
        "question": "При работе в команде я предпочитаю:",
        "options": [
            {"text": "Брать на себя лидерство и направлять команду", "type": "D", "score": 3},
            {"text": "Поддерживать позитивную атмосферу и мотивировать коллег", "type": "I", "score": 3},
            {"text": "Быть надежным исполнителем и поддерживать других", "type": "S", "score": 3},
            {"text": "Обеспечивать качество и точность выполнения задач", "type": "C", "score": 3}
        ]
    },
    {
        "id": 14,
        "question": "Мой подход к рабочим процессам:",
        "options": [
            {"text": "Оптимизирую процессы для достижения максимальных результатов", "type": "D", "score": 3},
            {"text": "Делаю процессы более интерактивными и вовлекающими", "type": "I", "score": 3},
            {"text": "Поддерживаю стабильные и проверенные процессы", "type": "S", "score": 3},
            {"text": "Создаю детальные и структурированные процессы", "type": "C", "score": 3}
        ]
    },
    {
        "id": 15,
        "question": "При оценке своей работы я:",
        "options": [
            {"text": "Фокусируюсь на достигнутых результатах и целях", "type": "D", "score": 3},
            {"text": "Учитываю влияние на команду и общую атмосферу", "type": "I", "score": 3},
            {"text": "Оцениваю стабильность и надежность выполнения", "type": "S", "score": 3},
            {"text": "Анализирую качество и соответствие стандартам", "type": "C", "score": 3}
        ]
    }
];

let currentDiscQuestion = 0;
let discAnswers = {};
let selectedDiscAnswer = null;

function initializeDiscModal() {
    document.getElementById('closeDiscModal').addEventListener('click', closeDiscModal);
    document.getElementById('startDiscTest').addEventListener('click', startDiscTest);
    document.getElementById('prevQuestion').addEventListener('click', previousDiscQuestion);
    document.getElementById('nextQuestion').addEventListener('click', nextDiscQuestion);
    document.getElementById('retakeDiscTest').addEventListener('click', retakeDiscTest);
    document.getElementById('closeDiscResults').addEventListener('click', closeDiscModal);
    
    document.getElementById('discModal').addEventListener('click', (e) => {
        if (e.target.id === 'discModal') {
            closeDiscModal();
        }
    });
}

function openDiscModal() {
    document.getElementById('discModal').classList.remove('hidden');
    resetDiscTest();
}

function closeDiscModal() {
    document.getElementById('discModal').classList.add('hidden');
}

function resetDiscTest() {
    currentDiscQuestion = 0;
    discAnswers = {};
    selectedDiscAnswer = null;
    
    document.getElementById('discIntro').classList.remove('hidden');
    document.getElementById('discQuestion').classList.add('hidden');
    document.getElementById('discResults').classList.add('hidden');
    document.getElementById('discLoading').classList.add('hidden');
}

function startDiscTest() {
    document.getElementById('discIntro').classList.add('hidden');
    document.getElementById('discQuestion').classList.remove('hidden');
    
    currentDiscQuestion = 0;
    discAnswers = {};
    selectedDiscAnswer = null;
    
    showDiscQuestion();
}

function showDiscQuestion() {
    const question = DISC_QUESTIONS[currentDiscQuestion];
    const totalQuestions = DISC_QUESTIONS.length;
    const progress = ((currentDiscQuestion + 1) / totalQuestions) * 100;
    
    document.getElementById('currentQuestionNum').textContent = currentDiscQuestion + 1;
    document.getElementById('totalQuestions').textContent = totalQuestions;
    document.getElementById('progressPercent').textContent = Math.round(progress) + '%';
    document.getElementById('progressBar').style.width = progress + '%';
    
    document.getElementById('questionText').textContent = question.question;
    
    const optionsContainer = document.getElementById('questionOptions');
    optionsContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-item border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 transition-colors';
        optionDiv.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="radio w-5 h-5 border-2 border-gray-300 rounded-full flex items-center justify-center">
                    <div class="radio-selected w-2.5 h-2.5 bg-blue-600 rounded-full hidden"></div>
                </div>
                <span class="text-gray-700">${option.text}</span>
            </div>
        `;
        
        optionDiv.addEventListener('click', () => selectDiscAnswer(option.text, optionDiv));
        optionsContainer.appendChild(optionDiv);
    });
    
    selectedDiscAnswer = discAnswers[question.id] || null;
    if (selectedDiscAnswer) {
        const selectedOption = Array.from(optionsContainer.children).find(opt => 
            opt.querySelector('span').textContent === selectedDiscAnswer
        );
        if (selectedOption) {
            selectDiscAnswer(selectedDiscAnswer, selectedOption);
        }
    }
    
    updateDiscNavigation();
}

function selectDiscAnswer(answerText, optionElement) {
    document.querySelectorAll('.option-item').forEach(opt => {
        opt.classList.remove('border-blue-500', 'bg-blue-50');
        opt.classList.add('border-gray-200');
        opt.querySelector('.radio-selected').classList.add('hidden');
    });
    
    optionElement.classList.remove('border-gray-200');
    optionElement.classList.add('border-blue-500', 'bg-blue-50');
    optionElement.querySelector('.radio-selected').classList.remove('hidden');
    
    selectedDiscAnswer = answerText;
    updateDiscNavigation();
}

function updateDiscNavigation() {
    const prevBtn = document.getElementById('prevQuestion');
    const nextBtn = document.getElementById('nextQuestion');
    
    prevBtn.style.visibility = currentDiscQuestion === 0 ? 'hidden' : 'visible';
    nextBtn.disabled = !selectedDiscAnswer;
    nextBtn.textContent = currentDiscQuestion === DISC_QUESTIONS.length - 1 ? 'Завершить' : 'Далее';
}

function previousDiscQuestion() {
    if (currentDiscQuestion > 0) {
        currentDiscQuestion--;
        showDiscQuestion();
    }
}

function nextDiscQuestion() {
    if (!selectedDiscAnswer) return;
    
    discAnswers[DISC_QUESTIONS[currentDiscQuestion].id] = selectedDiscAnswer;
    
    if (currentDiscQuestion === DISC_QUESTIONS.length - 1) {
        submitDiscTest();
    } else {
        currentDiscQuestion++;
        selectedDiscAnswer = null;
        showDiscQuestion();
    }
}

async function submitDiscTest() {
    document.getElementById('discQuestion').classList.add('hidden');
    document.getElementById('discLoading').classList.remove('hidden');
    
    try {
        const token = checkAuth();
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/employee/${employeeId}/disc-test?token=${token}` : 
            `/api/employee/${employeeId}/disc-test`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ answers: discAnswers })
        });
        
        if (!response.ok) {
            throw new Error('Не удалось сохранить результаты теста');
        }
        
        const result = await response.json();
        showDiscResults(result);
        
        if (currentEmployee) {
            currentEmployee.disc_type = result.personalityType;
            currentEmployee.disc_data = result.discData;
            displayEmployeeProfile(currentEmployee);
        }
        
        showToast('DISC тест успешно завершен!');
        
    } catch (error) {
        console.error('Error submitting DISC test:', error);
        showToast('Ошибка при сохранении результатов теста', 'error');
        document.getElementById('discLoading').classList.add('hidden');
        document.getElementById('discQuestion').classList.remove('hidden');
    }
}

function showDiscResults(result) {
    document.getElementById('discLoading').classList.add('hidden');
    document.getElementById('discResults').classList.remove('hidden');
    
    document.getElementById('resultPersonalityType').textContent = result.personalityType;
    
    const maxScore = 45;
    const scores = result.scores;
    
    document.getElementById('scoreD').style.width = (scores.D / maxScore * 100) + '%';
    document.getElementById('scoreI').style.width = (scores.I / maxScore * 100) + '%';
    document.getElementById('scoreS').style.width = (scores.S / maxScore * 100) + '%';
    document.getElementById('scoreC').style.width = (scores.C / maxScore * 100) + '%';
    
    document.getElementById('scoreDText').textContent = `${scores.D}/${maxScore}`;
    document.getElementById('scoreIText').textContent = `${scores.I}/${maxScore}`;
    document.getElementById('scoreSText').textContent = `${scores.S}/${maxScore}`;
    document.getElementById('scoreCText').textContent = `${scores.C}/${maxScore}`;
}

function calculateDiscScores(answers) {
    const scores = { D: 0, I: 0, S: 0, C: 0 };
    
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

function retakeDiscTest() {
    resetDiscTest();
    startDiscTest();
}

let currentOkrs = [];
let editingOkrIndex = -1;

function openOkrModal() {
    document.getElementById('okrModal').classList.remove('hidden');
    loadCurrentOkrs();
    initializeOkrModal();
}

function closeOkrModal() {
    document.getElementById('okrModal').classList.add('hidden');
    resetOkrModal();
}

function initializeOkrModal() {
    document.getElementById('closeOkrModal').addEventListener('click', closeOkrModal);
    document.getElementById('cancelOkrBtn').addEventListener('click', closeOkrModal);
    document.getElementById('okrForm').addEventListener('submit', saveOkrs);
    document.getElementById('addObjectiveBtn').addEventListener('click', addObjective);
    
    const generateBtn = document.getElementById('generateOkrBtn');
    const improveBtn = document.getElementById('improveOkrBtn');
    
    if (generateBtn) {
        generateBtn.addEventListener('click', generateOkrWithAI);
    }
    if (improveBtn) {
        improveBtn.addEventListener('click', improveOkrWithAI);
    }
    
    document.getElementById('okrModal').addEventListener('click', (e) => {
        if (e.target.id === 'okrModal') {
            closeOkrModal();
        }
    });
}

function loadCurrentOkrs() {
    const employee = currentEmployee || window.currentEmployee;
    if (employee && employee.okr_goals) {
        try {
            currentOkrs = typeof employee.okr_goals === 'string' ? 
                JSON.parse(employee.okr_goals) : employee.okr_goals;
        } catch (e) {
            currentOkrs = [];
        }
    } else {
        currentOkrs = [];
    }
    
    if (currentOkrs.length > 0) {
        document.getElementById('improveOkrBtn').classList.remove('hidden');
        document.getElementById('okrImprovementSection').classList.remove('hidden');
        renderOkrForm();
    } else {
        addObjective();
    }
}

function resetOkrModal() {
    document.getElementById('okrObjectives').innerHTML = '';
    document.getElementById('okrContext').value = '';
    document.getElementById('okrAdditionalGoals').value = '';
    document.getElementById('okrFeedback').value = '';
    document.getElementById('improveOkrBtn').classList.add('hidden');
    document.getElementById('okrImprovementSection').classList.add('hidden');
    editingOkrIndex = -1;
}

function addObjective() {
    const objectivesContainer = document.getElementById('okrObjectives');
    const objectiveIndex = objectivesContainer.children.length;
    
    if (objectiveIndex >= 3) {
        showToast('Максимум 3 цели на квартал');
        return;
    }
    
    const objectiveHtml = `
        <div class="objective-item border border-gray-200 rounded-lg p-4" data-index="${objectiveIndex}">
            <div class="flex justify-between items-start mb-3">
                <h4 class="font-medium text-gray-900">Цель ${objectiveIndex + 1}</h4>
                <button type="button" onclick="removeObjective(${objectiveIndex})" class="text-red-600 hover:text-red-800">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" data-translate="employee.okr_objective">Цель</label>
                    <div class="flex space-x-2">
                        <textarea name="objective-${objectiveIndex}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" rows="2" required></textarea>
                        <button type="button" onclick="improveObjectiveWithAI(${objectiveIndex})" class="px-3 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 text-sm" title="Улучшить с ИИ">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" data-translate="employee.okr_deadline">Срок выполнения</label>
                    <input type="date" name="deadline-${objectiveIndex}" class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" data-translate="employee.okr_key_results">Ключевые результаты</label>
                    <div class="key-results-container space-y-2" data-objective="${objectiveIndex}">
                        <div class="key-result-item flex space-x-2">
                            <input type="text" name="key-result-${objectiveIndex}-0" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ключевой результат 1" required>
                            <button type="button" onclick="improveKeyResultWithAI(${objectiveIndex}, 0)" class="px-3 py-2 bg-green-100 text-green-600 rounded-md hover:bg-green-200 text-sm" title="Улучшить с ИИ">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                            </button>
                            <button type="button" onclick="removeKeyResult(this)" class="text-red-600 hover:text-red-800">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <button type="button" onclick="addKeyResult(${objectiveIndex})" class="mt-2 text-sm text-blue-600 hover:text-blue-800">
                        + Добавить ключевой результат
                    </button>
                </div>
            </div>
        </div>
    `;
    
    objectivesContainer.insertAdjacentHTML('beforeend', objectiveHtml);
}

function removeObjective(index) {
    const objective = document.querySelector(`[data-index="${index}"]`);
    if (objective) {
        objective.remove();
        reindexObjectives();
    }
}

function addKeyResult(objectiveIndex) {
    const container = document.querySelector(`[data-objective="${objectiveIndex}"]`);
    const keyResultIndex = container.children.length;
    
    if (keyResultIndex >= 3) {
        showToast('Максимум 3 ключевых результата на цель');
        return;
    }
    
    const keyResultHtml = `
        <div class="key-result-item flex space-x-2">
            <input type="text" name="key-result-${objectiveIndex}-${keyResultIndex}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ключевой результат ${keyResultIndex + 1}" required>
            <button type="button" onclick="improveKeyResultWithAI(${objectiveIndex}, ${keyResultIndex})" class="px-3 py-2 bg-green-100 text-green-600 rounded-md hover:bg-green-200 text-sm" title="Улучшить с ИИ">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
            </button>
            <button type="button" onclick="removeKeyResult(this)" class="text-red-600 hover:text-red-800">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', keyResultHtml);
}

function removeKeyResult(button) {
    const keyResultItem = button.closest('.key-result-item');
    const container = keyResultItem.parentElement;
    
    if (container.children.length > 1) {
        keyResultItem.remove();
    } else {
        showToast('Должен быть хотя бы один ключевой результат');
    }
}

function reindexObjectives() {
    const objectives = document.querySelectorAll('.objective-item');
    objectives.forEach((objective, index) => {
        objective.setAttribute('data-index', index);
        objective.querySelector('h4').textContent = `Цель ${index + 1}`;
        
        const inputs = objective.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            const name = input.getAttribute('name');
            if (name) {
                const newName = name.replace(/\d+/, index);
                input.setAttribute('name', newName);
            }
        });
    });
}

function renderOkrForm() {
    const objectivesContainer = document.getElementById('okrObjectives');
    objectivesContainer.innerHTML = '';
    
    currentOkrs.forEach((okr, index) => {
        addObjective();
        const objective = document.querySelector(`[data-index="${index}"]`);
        
        objective.querySelector(`[name="objective-${index}"]`).value = okr.objective || '';
        objective.querySelector(`[name="deadline-${index}"]`).value = okr.deadline || '';
        
        if (okr.key_results && okr.key_results.length > 0) {
            const keyResultsContainer = objective.querySelector(`[data-objective="${index}"]`);
            keyResultsContainer.innerHTML = '';
            
            okr.key_results.forEach((kr, krIndex) => {
                addKeyResult(index);
                const keyResultInput = objective.querySelector(`[name="key-result-${index}-${krIndex}"]`);
                if (keyResultInput) {
                    keyResultInput.value = kr;
                }
            });
        }
    });
}

async function improveObjectiveWithAI(objectiveIndex) {
    const objectiveTextarea = document.querySelector(`textarea[name="objective-${objectiveIndex}"]`);
    const currentText = objectiveTextarea.value.trim();
    
    if (!currentText) {
        showToast('Введите текст цели для улучшения');
        return;
    }
    
    const button = document.querySelector(`button[onclick="improveObjectiveWithAI(${objectiveIndex})"]`);
    const originalHtml = button.innerHTML;
    
    try {
        button.innerHTML = '<div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>';
        button.disabled = true;
        
        const token = checkAuth();
        if (!token) return;
        
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/employee/${employeeId}/okr-improve-single?token=${token}` : 
            `/api/employee/${employeeId}/okr-improve-single`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                text: currentText,
                type: 'objective',
                context: window.currentEmployee?.position || 'Сотрудник'
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.improvedText) {
            objectiveTextarea.value = data.improvedText;
            showToast('Цель улучшена с помощью ИИ');
        } else {
            throw new Error(data.error || 'Ошибка улучшения цели');
        }
    } catch (error) {
        console.error('Error improving objective:', error);
        showToast('Ошибка при улучшении цели: ' + error.message);
    } finally {
        button.innerHTML = originalHtml;
        button.disabled = false;
    }
}

async function improveKeyResultWithAI(objectiveIndex, keyResultIndex) {
    const keyResultInput = document.querySelector(`input[name="key-result-${objectiveIndex}-${keyResultIndex}"]`);
    const currentText = keyResultInput.value.trim();
    
    if (!currentText) {
        showToast('Введите текст ключевого результата для улучшения');
        return;
    }
    
    const button = document.querySelector(`button[onclick="improveKeyResultWithAI(${objectiveIndex}, ${keyResultIndex})"]`);
    const originalHtml = button.innerHTML;
    
    try {
        button.innerHTML = '<div class="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>';
        button.disabled = true;
        
        const token = checkAuth();
        if (!token) return;
        
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/employee/${employeeId}/okr-improve-single?token=${token}` : 
            `/api/employee/${employeeId}/okr-improve-single`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                text: currentText,
                type: 'key_result',
                context: window.currentEmployee?.position || 'Сотрудник'
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.improvedText) {
            keyResultInput.value = data.improvedText;
            showToast('Ключевой результат улучшен с помощью ИИ');
        } else {
            throw new Error(data.error || 'Ошибка улучшения ключевого результата');
        }
    } catch (error) {
        console.error('Error improving key result:', error);
        showToast('Ошибка при улучшении ключевого результата: ' + error.message);
    } finally {
        button.innerHTML = originalHtml;
        button.disabled = false;
    }
}
// === OKR helpers (вставить выше displayOkrGoals) ===
function ensureKeyResultsCompleted(goal) {
  // гарантируем согласованность длин массивов
  const krCount = Array.isArray(goal.key_results) ? goal.key_results.length : 0;
  if (!Array.isArray(goal.key_results_completed)) {
    goal.key_results_completed = Array(krCount).fill(false);
  } else if (goal.key_results_completed.length !== krCount) {
    const arr = Array(krCount).fill(false);
    for (let i = 0; i < Math.min(goal.key_results_completed.length, krCount); i++) {
      arr[i] = !!goal.key_results_completed[i];
    }
    goal.key_results_completed = arr;
  }
  return goal;
}

function calculateOkrProgress(goal) {
  // Если есть ключевые результаты — считаем по ним
  if (Array.isArray(goal.key_results) && goal.key_results.length > 0) {
    ensureKeyResultsCompleted(goal);
    const total = goal.key_results.length;
    const done = goal.key_results_completed.filter(Boolean).length;
    return Math.round((done / total) * 100);
  }
  // Иначе — по статусу/флажку completed
  if (goal.completed) return 100;
  if (goal.status === 'in_progress') return 50;
  return 0;
}

function calculateTimeRemaining(deadline) {
  if (!deadline) return { days: null, isOverdue: false };
  const now = new Date();
  // поддержим как ISO, так и 'YYYY-MM-DD'
  const due = new Date(deadline);
  // нормализуем к полуночи без времени для корректного подсчёта дней
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.ceil((due.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / msPerDay);
  return { days: Math.abs(days), isOverdue: days < 0 };
}
// === /OKR helpers ===

function collectOkrsFromForm() {
    const objectives = document.querySelectorAll('.objective-item');
    const okrs = [];
    
    objectives.forEach((objective, index) => {
        const objectiveText = objective.querySelector(`[name="objective-${index}"]`).value;
        const deadline = objective.querySelector(`[name="deadline-${index}"]`).value;
        
        const keyResults = [];
        const keyResultInputs = objective.querySelectorAll(`[name^="key-result-${index}-"]`);
        keyResultInputs.forEach(input => {
            if (input.value.trim()) {
                keyResults.push(input.value.trim());
            }
        });
        
        if (objectiveText.trim()) {
            const existingOkr = currentOkrs[index] || {};
            okrs.push({
                objective: objectiveText.trim(),
                key_results: keyResults,
                deadline: deadline,
                progress: existingOkr.progress || 0,
                status: existingOkr.status || 'not_started',
                completed: existingOkr.completed || false,
                key_results_completed: existingOkr.key_results_completed || keyResults.map(() => false)
            });
        }
    });
    
    return okrs;
}

async function saveOkrs(event) {
    event.preventDefault();

    const saveBtn = document.getElementById('saveOkrBtn');
    const originalText = saveBtn.textContent;

    try {
        saveBtn.textContent = 'Сохранение...';
        saveBtn.disabled = true;

        // 1) Собираем OKR из формы
        const okrs = collectOkrsFromForm();
        if (!okrs || okrs.length === 0) {
            showToast('Добавьте хотя бы одну цель');
            return;
        }

        const token = checkAuth();
        if (!token) return;

        // 2) Заголовки для обоих режимов
        const headers = isEmployeeView
            ? { 'Content-Type': 'application/json' }
            : { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        let response;

        if (!isEmployeeView) {
            // ---------- АВТОРИЗОВАННЫЙ РЕЖИМ ----------
            // Пишем OKR через специальный эндпоинт
            response = await fetch(`/api/employee/${employeeId}/okrs`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ okr_goals: okrs }) // snake_case на фронте, camel на бэке
            });

            // Fallback: если вдруг маршрута нет — merge через PUT профиля
            if (response.status === 404) {
                const getResp = await fetch(`/api/employee/${employeeId}/profile`, { headers });
                if (!getResp.ok) {
                    throw new Error('Не удалось загрузить профиль для сохранения OKR');
                }
                const profile = await getResp.json();

                const mergedProfile = { ...profile, okr_goals: okrs };
                delete mergedProfile.created_at;
                delete mergedProfile.updated_at;

                response = await fetch(`/api/employee/${employeeId}/profile`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(mergedProfile)
                });
            }
        } else {
            // ---------- РЕЖИМ ЗАЩИЩЁННОЙ ССЫЛКИ ----------
            response = await fetch(`/employee/${employeeId}/profile?token=${token}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ okr_goals: okrs })
            });
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data?.error || 'Ошибка сохранения OKR');
        }

        // 3) Обновляем локально и UI
        if (currentEmployee) {
            currentEmployee.okr_goals = okrs;
        }
        if (window.currentEmployee) {
    window.currentEmployee.okr_goals = okrs;
}
        displayOkrGoals(okrs);
        closeOkrModal();
        showToast('OKR успешно сохранены');
    } catch (error) {
        console.error('Error saving OKRs:', error);
        showToast('Ошибка при сохранении OKR: ' + error.message, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}



async function toggleOkrCompletion(goalIndex, type, keyResultIndex = null) {
    try {
        const employee = window.currentEmployee;
        let okrs = [];
        
        if (employee && employee.okr_goals) {
            okrs = typeof employee.okr_goals === 'string' ? 
                JSON.parse(employee.okr_goals) : employee.okr_goals;
        }
        
        if (!okrs[goalIndex]) return;
        
        if (type === 'objective') {
            okrs[goalIndex].completed = !okrs[goalIndex].completed;
            okrs[goalIndex].status = okrs[goalIndex].completed ? 'completed' : 'in_progress';
        } else if (type === 'key_result' && keyResultIndex !== null) {
            if (!okrs[goalIndex].key_results_completed) {
                okrs[goalIndex].key_results_completed = okrs[goalIndex].key_results.map(() => false);
            }
            okrs[goalIndex].key_results_completed[keyResultIndex] = !okrs[goalIndex].key_results_completed[keyResultIndex];
            
            const completedCount = okrs[goalIndex].key_results_completed.filter(completed => completed).length;
            const totalCount = okrs[goalIndex].key_results_completed.length;
            
            if (completedCount === totalCount) {
                okrs[goalIndex].status = 'completed';
                okrs[goalIndex].completed = true;
            } else if (completedCount > 0) {
                okrs[goalIndex].status = 'in_progress';
                okrs[goalIndex].completed = false;
            } else {
                okrs[goalIndex].status = 'not_started';
                okrs[goalIndex].completed = false;
            }
        }
        
        okrs[goalIndex].progress = calculateOkrProgress(okrs[goalIndex]);
        
        const token = checkAuth();
        if (!token) return;
        
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/employee/${employeeId}/profile?token=${token}` : 
            `/api/employee/${employeeId}/profile`;
        
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                okr_goals: okrs
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (currentEmployee) {
                currentEmployee.okr_goals = okrs;
                displayOkrGoals(okrs);
            }
        } else {
            throw new Error('Ошибка обновления статуса');
        }
    } catch (error) {
        console.error('Error toggling OKR completion:', error);
        showToast('Ошибка при обновлении статуса: ' + error.message);
    }
}

function generateOkrWithAI() {
    const context = document.getElementById('okrContext').value;
    const additionalGoals = document.getElementById('okrAdditionalGoals').value;
    const position = window.currentEmployee?.position || 'Not specified';
    
    const generateBtn = document.getElementById('generateOkrBtn');
    const originalText = generateBtn.textContent;
    generateBtn.textContent = translations[currentLanguage].employee.okr_generating || 'Генерация...';
    generateBtn.disabled = true;
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
    
    const endpoint = `/api/employee/${getEmployeeIdFromUrl()}/okr-generate`;
    
    fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            context: context,
            position: position,
            goals: additionalGoals
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to generate OKRs');
        }
        return response.json();
    })
    .then(data => {
        if (data.success && data.okrs) {
            populateOkrForm(data.okrs);
            document.getElementById('improveOkrBtn').classList.remove('hidden');
        }
    })
    .catch(error => {
        console.error('Error generating OKRs:', error);
        showToast(translations[currentLanguage].employee.okr_error || 'Ошибка при генерации OKR', 'error');
    })
    .finally(() => {
        generateBtn.textContent = originalText;
        generateBtn.disabled = false;
    });
}

function improveOkrWithAI() {
    const feedback = document.getElementById('okrFeedback').value;
    const currentOkrs = collectOkrsFromForm();
    
    if (currentOkrs.length === 0) {
        showToast('Сначала добавьте OKR цели', 'error');
        return;
    }
    
    const improveBtn = document.getElementById('improveOkrBtn');
    const originalText = improveBtn.textContent;
    improveBtn.textContent = translations[currentLanguage].employee.okr_improving || 'Улучшение...';
    improveBtn.disabled = true;
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
    
    const endpoint = `/api/employee/${getEmployeeIdFromUrl()}/okr-improve`;
    
    fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            okrs: currentOkrs,
            feedback: feedback
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to improve OKRs');
        }
        return response.json();
    })
    .then(data => {
        if (data.success && data.okrs) {
            populateOkrForm(data.okrs);
        }
    })
    .catch(error => {
        console.error('Error improving OKRs:', error);
        showToast(translations[currentLanguage].employee.okr_error || 'Ошибка при улучшении OKR', 'error');
    })
    .finally(() => {
        improveBtn.textContent = originalText;
        improveBtn.disabled = false;
    });
}

function populateOkrForm(okrs) {
    const objectivesContainer = document.getElementById('okrObjectives');
    objectivesContainer.innerHTML = '';
    
    okrs.forEach((okr, index) => {
        addObjective();
        const objectiveDiv = objectivesContainer.children[index];
        
        const objectiveInput = objectiveDiv.querySelector('input[name="objective"]');
        const deadlineInput = objectiveDiv.querySelector('input[name="deadline"]');
        const progressInput = objectiveDiv.querySelector('input[name="progress"]');
        
        if (objectiveInput) objectiveInput.value = okr.objective || '';
        if (deadlineInput) deadlineInput.value = okr.deadline || '';
        if (progressInput) progressInput.value = okr.progress || 0;
        
        const keyResultsContainer = objectiveDiv.querySelector('.key-results-container');
        if (keyResultsContainer && okr.key_results) {
            keyResultsContainer.innerHTML = '';
            okr.key_results.forEach(keyResult => {
                addKeyResult(index);
                const keyResultInputs = keyResultsContainer.querySelectorAll('input[name="key_result"]');
                const lastInput = keyResultInputs[keyResultInputs.length - 1];
                if (lastInput) lastInput.value = keyResult;
            });
        }
    });
}

function editOkr(index) {
    editingOkrIndex = index;
    openOkrModal();
}

async function deleteOkr(index) {
    if (!confirm('Вы уверены, что хотите удалить эту цель?')) {
        return;
    }
    
    try {
        const employee = window.currentEmployee;
        let okrs = [];
        
        if (employee && employee.okr_goals) {
            okrs = typeof employee.okr_goals === 'string' ? 
                JSON.parse(employee.okr_goals) : employee.okr_goals;
        }
        
        okrs.splice(index, 1);
        
        const token = checkAuth();
        if (!token) return;
        
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/employee/${employeeId}/profile?token=${token}` : 
            `/api/employee/${employeeId}/profile`;
        
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                okr_goals: okrs
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (currentEmployee) {
                currentEmployee.okr_goals = okrs;
                displayOkrGoals(okrs);
            }
            showToast('Цель успешно удалена');
        } else {
            throw new Error('Ошибка удаления цели');
        }
    } catch (error) {
        console.error('Error deleting OKR:', error);
        showToast('Ошибка при удалении цели: ' + error.message);
    }
}

function showEditModal() {
    if (!currentEmployee) return;
    
    document.getElementById('editName').value = currentEmployee.name || '';
    document.getElementById('editEmail').value = currentEmployee.email || '';
    document.getElementById('editPosition').value = currentEmployee.position || '';
    document.getElementById('editPhone').value = currentEmployee.phone || '';
    document.getElementById('editMeetingTimes').value = currentEmployee.meeting_times || '';
    document.getElementById('editCommStyle').value = currentEmployee.comm_style || '';
    document.getElementById('editWorkStyle').value = currentEmployee.work_style || '';
    document.getElementById('editMotivators').value = currentEmployee.motivators || '';
    document.getElementById('editDemotivators').value = currentEmployee.demotivators || '';
    
    initializeEditMotivationalTriggers();
    setupEditWorkspaceDropZone();
    
    populateTagField('roles', currentEmployee.roles);
    populateTagField('domains', currentEmployee.domains);
    populateTagField('expertise', currentEmployee.expertise);
    populateTagField('personal_interests', currentEmployee.personal_interests);
    populateTagField('comm_channels', currentEmployee.comm_channels);
    populateTagField('stakeholders', currentEmployee.stakeholders);
    populateTagField('important_traits', currentEmployee.important_traits);

const tzEl = document.getElementById('editTimeZone');
if (tzEl) tzEl.value = currentEmployee.time_zone || '';
    document.getElementById('editModal').classList.remove('hidden');
}

function hideEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

function populateTagField(fieldName, value) {
    const container = document.querySelector(`[data-field="${fieldName}"]`);
    const display = container.querySelector('.tag-display');
    
    display.innerHTML = '';
    
    if (value) {
        const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
        tags.forEach(tag => {
            addTagToDisplay(display, tag);
        });
    }
}

function addTagToDisplay(display, tagText) {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag-item';
    tagElement.innerHTML = `
        <span>${tagText}</span>
        <span class="tag-remove" onclick="removeTag(this)">×</span>
    `;
    display.appendChild(tagElement);
}

function removeTag(element) {
    element.parentElement.remove();
}

function initializeTagInputs() {
    document.querySelectorAll('.tag-input-container').forEach(container => {
        const input = container.querySelector('.tag-input');
        const suggestions = container.querySelector('.tag-suggestions');
        const display = container.querySelector('.tag-display');
        
        input.addEventListener('focus', () => {
            suggestions.classList.remove('hidden');
        });
        
        input.addEventListener('blur', (e) => {
            setTimeout(() => {
                suggestions.classList.add('hidden');
            }, 200);
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const value = input.value.trim();
                if (value) {
                    addTagToDisplay(display, value);
                    input.value = '';
                }
            }
        });
        
        suggestions.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-option')) {
                const value = e.target.dataset.value;
                addTagToDisplay(display, value);
                input.value = '';
                suggestions.classList.add('hidden');
            }
        });
    });
}

function getTagValues(fieldName) {
    const container = document.querySelector(`[data-field="${fieldName}"]`);
    const tags = container.querySelectorAll('.tag-item span:first-child');
    return Array.from(tags).map(tag => tag.textContent).join(', ');
}

async function saveProfileChanges(e) {
    e.preventDefault();
    
    const token = checkAuth();
    if (!token || !employeeId) return;

    // собираем данные из формы
    const profileData = {
        name: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        position: document.getElementById('editPosition').value,
        phone: document.getElementById('editPhone').value,

        // теги
        roles: getTagValues('roles'),
        domains: getTagValues('domains'),
        expertise: getTagValues('expertise'),
        personalInterests: getTagValues('personal_interests'), // было personal_interests
        commChannels: getTagValues('comm_channels'),           // было comm_channels
        stakeholders: getTagValues('stakeholders'),            // добавили
        importantTraits: getTagValues('important_traits'),     // добавили

        // строки
        meetingTimes: document.getElementById('editMeetingTimes').value, // было meeting_times
        commStyle: document.getElementById('editCommStyle').value,       // было comm_style
        workStyle: document.getElementById('editWorkStyle').value,       // было work_style
        motivators: document.getElementById('editMotivators').value,
        demotivators: document.getElementById('editDemotivators').value,
        motivationalTriggers: currentEmployee.motivational_triggers || []
    };

    // опционально — часовой пояс, если поле есть в модалке
    const tzEl = document.getElementById('editTimeZone');
    if (tzEl) profileData.timeZone = tzEl.value;

    try {
        const headers = isEmployeeView
            ? { 'Content-Type': 'application/json' }
            : { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        // ВАЖНО: в режиме по токену должен быть публичный endpoint (без /api)
        const endpoint = isEmployeeView
            ? `/employee/${employeeId}/profile?token=${token}`
            : `/api/employee/${employeeId}/profile`;

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers,
            body: JSON.stringify(profileData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Profile save failed:', response.status, errorText);
            throw new Error('Не удалось сохранить изменения');
        }

        const updatedEmployee = await response.json();
        currentEmployee = updatedEmployee;
        window.currentEmployee = updatedEmployee; // синхронизируем оба места
        displayEmployeeProfile(updatedEmployee);
        hideEditModal();
        showToast('Профиль успешно обновлен');
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Ошибка сохранения профиля', 'error');
    }
}
// === Tips for motivational triggers ===
const DEFAULT_TRIGGER_TIPS = {
  curiosity:   'Любопытство: доступ к новой информации и исследованиям.',
  honor:       'Честь/признание: видимая оценка вклада и достижений.',
  acceptance:  'Принятие: ощущение принадлежности к команде/культуре.',
  mastery:     'Мастерство: сложные задачи, рост компетенций, обучение.',
  power:       'Влияние: возможность принимать решения и менять исход.',
  freedom:     'Свобода: автономия в выборе способов и порядка работы.',
  relatedness: 'Связи: работа с людьми, доверие и командные взаимодействия.',
  order:       'Порядок: ясные процессы, правила, предсказуемость.',
  goal:        'Цели: ясные, измеримые ориентиры и прогресс к ним.',
  status:      'Статус: роль/титул/видимость экспертизы и результатов.'
};

// Берём перевод из файлов локализаций, иначе — фолбэк
function getTriggerTip(triggerId) {
  const key = `motivational_triggers.tips.${triggerId}`;
  if (window.translationManager) {
    const tip = window.translationManager.t(key);
    if (tip && tip !== key) return tip;

    // общий дефолт из переводов, если есть
    const common = window.translationManager.t('motivational_triggers.tips._default');
    if (common && common !== 'motivational_triggers.tips._default') return common;
  }
  return DEFAULT_TRIGGER_TIPS[triggerId] || 'Подсказка будет добавлена позже.';
}

// Создаёт/показывает тултип рядом с кнопкой
function showTriggerTooltip(anchorEl, text) {
  hideTriggerTooltip(); // на всякий случай закрыть другие

  const rect = anchorEl.getBoundingClientRect();
  const tt = document.createElement('div');
  tt.id = 'trigger-tooltip';
  tt.className = 'fixed z-50 max-w-xs bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg';
  tt.style.top = `${rect.bottom + 8}px`;
  tt.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 260))}px`;
  tt.textContent = text;

  document.body.appendChild(tt);

  // клик вне — закрыть
  setTimeout(() => {
    function off(e) {
      if (!tt.contains(e.target) && e.target !== anchorEl) {
        hideTriggerTooltip();
        document.removeEventListener('mousedown', off, true);
        document.removeEventListener('touchstart', off, true);
      }
    }
    document.addEventListener('mousedown', off, true);
    document.addEventListener('touchstart', off, true);
  }, 0);
}

function hideTriggerTooltip() {
  const el = document.getElementById('trigger-tooltip');
  if (el) el.remove();
}

// Добавляет кнопку "i" на карточку и вешает обработчики
function attachTriggerHelp(cardEl) {
  if (!cardEl || cardEl.querySelector('.trigger-help-btn')) return;

  // Обертка, чтобы позиционировать иконку
  cardEl.classList.add('relative');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'trigger-help-btn absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow focus:outline-none';
  btn.setAttribute('aria-label', 'Подсказка по триггеру');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11 17h2m-1-8h.01M12 3a9 9 0 100 18 9 9 0 000-18z"/>
    </svg>
  `;

  // не даем начаться drag при нажатии на кнопку
  btn.addEventListener('mousedown', e => e.stopPropagation(), { passive: true });
  btn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = cardEl.getAttribute('data-trigger-id');
    showTriggerTooltip(btn, getTriggerTip(id));
  });

  cardEl.appendChild(btn);
}

// Вызывает attachTriggerHelp для всех карточек триггеров (и в библиотеке, и на рабочем поле)
function attachHelpToAllTriggers() {
  const nodes = document.querySelectorAll(
    '#triggersLibrary [data-trigger-id], #triggersWorkspace [data-trigger-id], #editTriggersWorkspace [data-trigger-id]'
  );
  nodes.forEach(attachTriggerHelp);
}

const MOTIVATIONAL_TRIGGERS = [
    { id: 'curiosity', color: '#3b82f6', icon: '🔍' },
    { id: 'honor', color: '#10b981', icon: '🏆' },
    { id: 'acceptance', color: '#f59e0b', icon: '👥' },
    { id: 'mastery', color: '#8b5cf6', icon: '⚡' },
    { id: 'power', color: '#ef4444', icon: '💪' },
    { id: 'freedom', color: '#06b6d4', icon: '🕊️' },
    { id: 'relatedness', color: '#ec4899', icon: '❤️' },
    { id: 'order', color: '#84cc16', icon: '📋' },
    { id: 'goal', color: '#f97316', icon: '🎯' },
    { id: 'status', color: '#6366f1', icon: '👑' }
];

function initializeMotivationalTriggers() {
    const palette = document.getElementById('triggersPalette');
    const workspace = document.getElementById('triggersWorkspace');
    
    if (!palette || !workspace) return;
    
    palette.innerHTML = '';
    
    MOTIVATIONAL_TRIGGERS.forEach(trigger => {
        const card = createTriggerCard(trigger, false);
        palette.appendChild(card);
    });
    
    if (currentEmployee && currentEmployee.motivational_triggers) {
        loadTriggerPositions(currentEmployee.motivational_triggers, false);
    }
    attachHelpToAllTriggers();

}

function initializeEditMotivationalTriggers() {
    const palette = document.getElementById('editTriggersPalette');
    const workspace = document.getElementById('editTriggersWorkspace');
    
    if (!palette || !workspace) return;
    
    palette.innerHTML = '';
    
    MOTIVATIONAL_TRIGGERS.forEach(trigger => {
        const card = createTriggerCard(trigger, true);
        palette.appendChild(card);
    });
    
    if (currentEmployee && currentEmployee.motivational_triggers) {
        loadTriggerPositions(currentEmployee.motivational_triggers, true);
    }
     attachHelpToAllTriggers();
}

function createTriggerCard(trigger, isEdit) {
    const card = document.createElement('div');
    card.className = 'trigger-card';
    card.draggable = true;
    card.dataset.triggerId = trigger.id;
    card.dataset.isEdit = isEdit;
    card.style.backgroundColor = trigger.color;
    card.style.color = 'white';
    
    const translationKey = `motivational_triggers.cards.${trigger.id}`;
    const translatedName = window.translationManager ? window.translationManager.t(translationKey) : trigger.id;
    
    card.innerHTML = `
        <div style="font-size: 20px; margin-bottom: 4px;">${trigger.icon}</div>
        <div style="font-weight: 600; font-size: 9px; line-height: 1.1;">${translatedName}</div>
    `;
    
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    
    return card;
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.triggerId);
    e.dataTransfer.setData('application/x-is-edit', e.target.dataset.isEdit);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function setupWorkspaceDropZone() {
    const workspace = document.getElementById('triggersWorkspace');
    if (!workspace) return;
    
    workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        const triggerId = e.dataTransfer.getData('text/plain');
        const isEdit = e.dataTransfer.getData('application/x-is-edit') === 'true';
        
        if (isEdit) return;
        
        const rect = workspace.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const scale = Math.max(1, Math.min(10, Math.round((x / rect.width) * 10)));
        const isAboveLine = y < rect.height / 2;
        
        const existingCardInSection = currentEmployee.motivational_triggers?.find(t => t.scale === scale);
        if (existingCardInSection && existingCardInSection.id !== triggerId) {
            returnCardToPalette(existingCardInSection.id, false);
        }
        
        positionTriggerCard(triggerId, scale, isAboveLine, x, y, false);
    });
}

function setupEditWorkspaceDropZone() {
    const workspace = document.getElementById('editTriggersWorkspace');
    if (!workspace) return;
    
    workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        const triggerId = e.dataTransfer.getData('text/plain');
        const isEdit = e.dataTransfer.getData('application/x-is-edit') === 'true';
        
        if (!isEdit) return;
        
        const rect = workspace.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const scale = Math.max(1, Math.min(10, Math.round((x / rect.width) * 10)));
        const isAboveLine = y < rect.height / 2;
        
        const existingCardInSection = currentEmployee.motivational_triggers?.find(t => t.scale === scale);
        if (existingCardInSection && existingCardInSection.id !== triggerId) {
            returnCardToPalette(existingCardInSection.id, true);
        }
        
        positionTriggerCard(triggerId, scale, isAboveLine, x, y, true);
    });
}

function positionTriggerCard(triggerId, scale, isAboveLine, x, y, isEdit) {
  const cardSelector = `[data-trigger-id="${triggerId}"][data-is-edit="${isEdit}"]`;
  const card = document.querySelector(cardSelector);
  const workspaceId = isEdit ? 'editTriggersWorkspace' : 'triggersWorkspace';
  const workspace = document.getElementById(workspaceId);
  if (!card || !workspace) return;

  // --- защёлкивание по X к «центрам» 10 колонок ---
  const bucketWidth = workspace.clientWidth / 10;   // ширина одного деления
  const halfCard = 40;                               // половина 80px
  const snappedLeft = Math.max(
    0,
    Math.min((scale - 0.5) * bucketWidth - halfCard, workspace.clientWidth - 80)
  );

  // --- два «яруса» по Y: верх (25%) или низ (75%) области ---
  const centerYTop = Math.max(halfCard, Math.min(workspace.clientHeight * 0.25, workspace.clientHeight - halfCard));
  const centerYBottom = Math.max(halfCard, Math.min(workspace.clientHeight * 0.75, workspace.clientHeight - halfCard));
  const snappedTop = (isAboveLine ? centerYTop : centerYBottom) - halfCard;

  card.classList.add('positioned', 'in-workspace');
  card.style.position = 'absolute';
  card.style.left = `${snappedLeft}px`;
  card.style.top = `${snappedTop}px`;
  card.style.zIndex = '10';
  workspace.appendChild(card);

  // сохраняем уже «защёлкнутые» координаты (центр карточки)
  saveTriggerPosition(triggerId, scale, isAboveLine, snappedLeft + halfCard, snappedTop + halfCard);

  // автосохранение в БД после каждого перетаскивания
  persistMotivationalTriggers();
}


function saveTriggerPosition(triggerId, scale, isAboveLine, x, y) {
    if (!currentEmployee.motivational_triggers) {
        currentEmployee.motivational_triggers = [];
    }
    
    currentEmployee.motivational_triggers = currentEmployee.motivational_triggers.filter(
        t => t.id !== triggerId
    );
    
    currentEmployee.motivational_triggers.push({
        id: triggerId,
        scale: scale,
        isAboveLine: isAboveLine,
        x: x,
        y: y
    });
}

function loadTriggerPositions(positions, isEdit) {
    const workspaceId = isEdit ? 'editTriggersWorkspace' : 'triggersWorkspace';
    const workspace = document.getElementById(workspaceId);
    if (!workspace || !positions) return;
    
    positions.forEach(pos => {
        const cardSelector = `[data-trigger-id="${pos.id}"][data-is-edit="${isEdit}"]`;
        const card = document.querySelector(cardSelector);
        if (card) {
            positionTriggerCard(pos.id, pos.scale, pos.isAboveLine, pos.x, pos.y, isEdit);
        }
    });
}

function returnCardToPalette(triggerId, isEdit) {
    const cardSelector = `[data-trigger-id="${triggerId}"][data-is-edit="${isEdit}"]`;
    const card = document.querySelector(cardSelector);
    const paletteId = isEdit ? 'editTriggersPalette' : 'triggersPalette';
    const palette = document.getElementById(paletteId);
    
    if (card && palette) {
        card.classList.remove('positioned', 'in-workspace');
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        card.style.zIndex = '';
        
        palette.appendChild(card);
        
        if (currentEmployee.motivational_triggers) {
            currentEmployee.motivational_triggers = currentEmployee.motivational_triggers.filter(
                t => t.id !== triggerId
            );
        }
    }
}

