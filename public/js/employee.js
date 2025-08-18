let currentEmployee = null;
let employeeId = null;
let isEmployeeView = false; // true if accessed via employee secure link

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
    document.getElementById('homeBase').textContent = employee.home_base || '-';
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

    container.innerHTML = goals.map(goal => `
        <div class="border border-gray-200 rounded-lg p-4">
            <div class="flex items-start justify-between mb-2">
                <h4 class="font-medium text-gray-900">${goal.objective || 'Цель не указана'}</h4>
                <span class="text-xs px-2 py-1 rounded-full ${
                    goal.status === 'completed' ? 'bg-green-100 text-green-800' :
                    goal.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                }">
                    ${goal.status === 'completed' ? 'Выполнено' :
                      goal.status === 'in_progress' ? 'В процессе' : 'Не начато'}
                </span>
            </div>
            ${goal.key_results ? `
                <div class="space-y-1">
                    <p class="text-sm font-medium text-gray-700">Ключевые результаты:</p>
                    <ul class="text-sm text-gray-600 space-y-1">
                        ${goal.key_results.map(kr => `<li>• ${kr}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${goal.deadline ? `
                <p class="text-xs text-gray-500 mt-2">Срок: ${formatDate(goal.deadline)}</p>
            ` : ''}
        </div>
    `).join('');
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
    
    if (!plan || plan.length === 0) {
        container.innerHTML = `
            <div class="text-gray-500 text-center py-8" data-translate="employee.no_development_plan">
                План развития не создан
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

    document.getElementById('addOkrBtn').addEventListener('click', () => {
        showToast('Функция добавления OKR целей будет добавлена позже');
    });
    
    document.getElementById('setDiscBtn').addEventListener('click', openDiscModal);
    
    document.getElementById('addDevelopmentBtn').addEventListener('click', () => {
        showToast('Функция добавления плана развития будет добавлена позже');
    });

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
            `/api/employee/${employeeId}/disc-test?token=${token}` : 
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
    
    populateTagField('roles', currentEmployee.roles);
    populateTagField('domains', currentEmployee.domains);
    populateTagField('expertise', currentEmployee.expertise);
    populateTagField('personal_interests', currentEmployee.personal_interests);
    populateTagField('comm_channels', currentEmployee.comm_channels);
    
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
    
    const profileData = {
        name: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        position: document.getElementById('editPosition').value,
        phone: document.getElementById('editPhone').value,
        roles: getTagValues('roles'),
        domains: getTagValues('domains'),
        expertise: getTagValues('expertise'),
        personal_interests: getTagValues('personal_interests'),
        comm_channels: getTagValues('comm_channels'),
        meeting_times: document.getElementById('editMeetingTimes').value,
        comm_style: document.getElementById('editCommStyle').value,
        work_style: document.getElementById('editWorkStyle').value,
        motivators: document.getElementById('editMotivators').value,
        demotivators: document.getElementById('editDemotivators').value
    };
    
    try {
        const headers = isEmployeeView ? {} : {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        if (isEmployeeView) {
            headers['Content-Type'] = 'application/json';
        }
        
        const endpoint = isEmployeeView ? 
            `/api/employee/${employeeId}/profile?token=${token}` : 
            `/api/employee/${employeeId}/profile`;
        
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(profileData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Profile save failed:', response.status, errorText);
            throw new Error('Не удалось сохранить изменения');
        }
        
        const updatedEmployee = await response.json();
        currentEmployee = updatedEmployee;
        displayEmployeeProfile(updatedEmployee);
        hideEditModal();
        showToast('Профиль успешно обновлен');
        
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Ошибка сохранения профиля', 'error');
    }
}
