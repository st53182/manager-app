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

    document.getElementById('commChannels').textContent = employee.comm_channels || '-';
    document.getElementById('meetingTimes').textContent = employee.meeting_times || '-';
    document.getElementById('commStyle').textContent = employee.comm_style || '-';

    document.getElementById('workStyle').textContent = employee.work_style || '-';
    document.getElementById('motivators').textContent = employee.motivators || '-';
    document.getElementById('demotivators').textContent = employee.demotivators || '-';

    if (isEmployeeView) {
        document.getElementById('editProfileBtn').style.display = 'none';
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
        'D': 'Доминирование - Прямой, решительный, ориентированный на результат',
        'I': 'Влияние - Общительный, оптимистичный, вдохновляющий',
        'S': 'Постоянство - Терпеливый, надежный, поддерживающий',
        'C': 'Соответствие - Аналитический, точный, систематичный'
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
    loadEmployeeProfile();

    document.getElementById('langRu').addEventListener('click', () => switchLanguage('ru'));
    document.getElementById('langEn').addEventListener('click', () => switchLanguage('en'));

    document.getElementById('shareProfileBtn').addEventListener('click', generateSecureLink);
    document.getElementById('closeShareModal').addEventListener('click', () => {
        document.getElementById('shareModal').classList.add('hidden');
    });
    document.getElementById('copyLinkBtn').addEventListener('click', copyToClipboard);

    document.getElementById('editProfileBtn').addEventListener('click', () => {
        showToast('Функция редактирования будет добавлена позже');
    });

    document.getElementById('addOkrBtn').addEventListener('click', () => {
        showToast('Функция добавления OKR целей будет добавлена позже');
    });
    
    document.getElementById('setDiscBtn').addEventListener('click', () => {
        showToast('Функция установки DISC типа будет добавлена позже');
    });
    
    document.getElementById('addDevelopmentBtn').addEventListener('click', () => {
        showToast('Функция добавления плана развития будет добавлена позже');
    });

    document.getElementById('shareModal').addEventListener('click', (e) => {
        if (e.target.id === 'shareModal') {
            document.getElementById('shareModal').classList.add('hidden');
        }
    });
});
