let currentTeam = null;
let teamEmployees = [];
let motivationChart = null;

function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user_info');
    
    if (!token || !user) {
        window.location.href = '/login';
        return false;
    }
    
    const userInfo = JSON.parse(user);
    document.getElementById('userName').textContent = userInfo.name;
    return token;
}

function getTeamIdFromUrl() {
    const path = window.location.pathname;
    const matches = path.match(/\/team\/([a-f0-9-]+)/);
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
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.href = '/login';
}

async function loadTeamData() {
    const token = checkAuth();
    if (!token) return;

    const teamId = getTeamIdFromUrl();
    if (!teamId) {
        showToast('Неверный ID команды', 'error');
        return;
    }

    try {
        const [teamResponse, employeesResponse] = await Promise.all([
            fetch(`/api/teams/${teamId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`/api/teams/${teamId}/employees`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!teamResponse.ok || !employeesResponse.ok) {
            throw new Error('Не удалось загрузить данные команды');
        }

        currentTeam = await teamResponse.json();
        teamEmployees = await employeesResponse.json();

        displayTeamInfo(currentTeam);
        displayEmployeeCards(teamEmployees);
        generateRadarChart(teamEmployees);
        displayInitialAdviceMessage();

    } catch (error) {
        console.error('Error loading team data:', error);
        showToast('Ошибка загрузки данных команды', 'error');
    } finally {
        document.getElementById('loadingIndicator').classList.add('hidden');
    }
}

function displayTeamInfo(team) {
    document.getElementById('teamName').textContent = team.name || 'Название команды';
    document.getElementById('teamDescription').textContent = team.description || 'Описание отсутствует';
    document.getElementById('teamSize').textContent = `${teamEmployees.length} ${getEmployeeCountText(teamEmployees.length)}`;
    document.getElementById('teamCreated').textContent = team.created_at ? 
        `Создана: ${formatDate(team.created_at)}` : '';
}

function getEmployeeCountText(count) {
    if (count === 1) return 'сотрудник';
    if (count >= 2 && count <= 4) return 'сотрудника';
    return 'сотрудников';
}

function displayEmployeeCards(employees) {
    const container = document.getElementById('employeeCardsContainer');
    
    if (!employees || employees.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="text-gray-400 text-6xl mb-4">👥</div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">В команде пока нет сотрудников</h3>
                <p class="text-gray-500">Добавьте сотрудников через панель управления</p>
            </div>
        `;
        return;
    }

    container.innerHTML = employees.map(employee => {
        const initials = getInitials(employee.name);
        const discType = employee.disc_type || '?';
        const discColor = getDiscColor(discType);
        const topTriggers = getTopMotivationalTriggers(employee.motivational_triggers);
        const okrProgress = calculateOkrProgress(employee.okr_goals);

        return `
            <div class="employee-card" onclick="window.location.href='/employee/${employee.id}'">
                <div class="flex items-start space-x-4">
                    <div class="avatar-placeholder" style="width: 60px; height: 60px; font-size: 1.5rem;">
                        ${initials}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-lg font-semibold text-gray-900 truncate">${employee.name}</h3>
                        <p class="text-sm text-gray-600 truncate">${employee.position || 'Должность не указана'}</p>
                        <div class="mt-2">
                            <span class="disc-badge" style="background-color: ${discColor}; color: white;">
                                DISC: ${discType}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="mt-4 space-y-3">
                    <!-- Contact Info -->
                    <div class="text-xs text-gray-500 space-y-1">
                        ${employee.email ? `<div>📧 ${employee.email}</div>` : ''}
                        ${employee.phone ? `<div>📱 ${employee.phone}</div>` : ''}
                    </div>

                    <!-- Expertise & Role -->
                    <div class="space-y-2">
                        ${employee.expertise ? `
                            <div>
                                <span class="text-xs font-medium text-gray-700">Экспертиза:</span>
                                <p class="text-xs text-gray-600 truncate">${employee.expertise}</p>
                            </div>
                        ` : ''}
                        ${employee.roles ? `
                            <div>
                                <span class="text-xs font-medium text-gray-700">Роль:</span>
                                <p class="text-xs text-gray-600 truncate">${employee.roles}</p>
                            </div>
                        ` : ''}
                        ${employee.domains ? `
                            <div>
                                <span class="text-xs font-medium text-gray-700">Компетенции:</span>
                                <p class="text-xs text-gray-600 truncate">${employee.domains}</p>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Top Motivational Triggers -->
                    ${topTriggers.length > 0 ? `
                        <div>
                            <span class="text-xs font-medium text-gray-700 block mb-1">Топ мотиваторы:</span>
                            <div class="flex flex-wrap">
                                ${topTriggers.map(trigger => `
                                    <span class="trigger-mini" style="background-color: ${trigger.color};">
                                        ${trigger.icon} ${trigger.name}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- OKR Progress -->
                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-xs font-medium text-gray-700">OKR прогресс:</span>
                            <span class="text-xs text-gray-600">${okrProgress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${okrProgress}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getDiscColor(discType) {
    const colors = {
        'D': '#ef4444',
        'I': '#f59e0b', 
        'S': '#10b981',
        'C': '#3b82f6',
        'DI': '#ec4899',
        'DS': '#8b5cf6',
        'DC': '#6366f1',
        'IS': '#06b6d4',
        'IC': '#84cc16',
        'SC': '#f97316'
    };
    return colors[discType.toUpperCase()] || '#6b7280';
}

const MOTIVATIONAL_TRIGGERS = [
    { id: 'curiosity', color: '#3b82f6', icon: '🔍', name: 'Любопытство' },
    { id: 'honor', color: '#10b981', icon: '🏆', name: 'Честь' },
    { id: 'acceptance', color: '#f59e0b', icon: '👥', name: 'Принятие' },
    { id: 'mastery', color: '#8b5cf6', icon: '⚡', name: 'Мастерство' },
    { id: 'power', color: '#ef4444', icon: '💪', name: 'Власть' },
    { id: 'freedom', color: '#06b6d4', icon: '🕊️', name: 'Свобода' },
    { id: 'relatedness', color: '#ec4899', icon: '❤️', name: 'Связь' },
    { id: 'order', color: '#84cc16', icon: '📋', name: 'Порядок' },
    { id: 'goal', color: '#f97316', icon: '🎯', name: 'Цель' },
    { id: 'status', color: '#6366f1', icon: '👑', name: 'Статус' }
];

function getTopMotivationalTriggers(triggers) {
    if (!triggers || !Array.isArray(triggers)) return [];
    
    return triggers
        .filter(t => t.scale >= 7)
        .sort((a, b) => b.scale - a.scale)
        .slice(0, 4)
        .map(trigger => {
            const triggerInfo = MOTIVATIONAL_TRIGGERS.find(mt => mt.id === trigger.id);
            return triggerInfo ? {
                ...triggerInfo,
                scale: trigger.scale
            } : null;
        })
        .filter(Boolean);
}

function calculateOkrProgress(okrGoals) {
    if (!okrGoals || !Array.isArray(okrGoals) || okrGoals.length === 0) {
        return 0;
    }

    let totalProgress = 0;
    let totalGoals = okrGoals.length;

    okrGoals.forEach(goal => {
        if (goal.completed) {
            totalProgress += 100;
        } else if (goal.key_results && goal.key_results_completed) {
            const completedKRs = goal.key_results_completed.filter(Boolean).length;
            const totalKRs = goal.key_results.length;
            if (totalKRs > 0) {
                totalProgress += (completedKRs / totalKRs) * 100;
            }
        } else if (goal.progress) {
            totalProgress += goal.progress;
        }
    });

    return Math.round(totalProgress / totalGoals);
}

function generateRadarChart(employees) {
    const triggerCounts = {};
    
    MOTIVATIONAL_TRIGGERS.forEach(trigger => {
        triggerCounts[trigger.id] = 0;
    });

    employees.forEach(employee => {
        const topTriggers = getTopMotivationalTriggers(employee.motivational_triggers);
        topTriggers.forEach(trigger => {
            if (triggerCounts.hasOwnProperty(trigger.id)) {
                triggerCounts[trigger.id]++;
            }
        });
    });

    const ctx = document.getElementById('motivationRadarChart').getContext('2d');
    
    if (motivationChart) {
        motivationChart.destroy();
    }

    const labels = MOTIVATIONAL_TRIGGERS.map(trigger => trigger.name);
    const data = MOTIVATIONAL_TRIGGERS.map(trigger => triggerCounts[trigger.id]);
    const backgroundColors = MOTIVATIONAL_TRIGGERS.map(trigger => trigger.color + '20');
    const borderColors = MOTIVATIONAL_TRIGGERS.map(trigger => trigger.color);

    motivationChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Количество сотрудников',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                pointBackgroundColor: borderColors,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: Math.max(...data) + 1,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 10
                        }
                    },
                    pointLabels: {
                        font: {
                            size: 11
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

async function generateTeamAdvice(employees) {
    const token = checkAuth();
    if (!token) return;

    const teamId = getTeamIdFromUrl();
    if (!teamId) return;

    const currentLanguage = window.translationManager ? window.translationManager.currentLanguage : 'ru';

    const triggerCounts = {};
    MOTIVATIONAL_TRIGGERS.forEach(trigger => {
        triggerCounts[trigger.id] = 0;
    });

    employees.forEach(employee => {
        const topTriggers = getTopMotivationalTriggers(employee.motivational_triggers);
        topTriggers.forEach(trigger => {
            if (triggerCounts.hasOwnProperty(trigger.id)) {
                triggerCounts[trigger.id]++;
            }
        });
    });

    const sortedTriggers = Object.entries(triggerCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 4)
        .map(([id]) => {
            const trigger = MOTIVATIONAL_TRIGGERS.find(t => t.id === id);
            return trigger ? trigger.name : id;
        });

    try {
        const response = await fetch(`/api/team/${teamId}/motivation-advice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topTriggers: sortedTriggers,
                language: currentLanguage
            })
        });

        if (!response.ok) {
            throw new Error('Не удалось получить рекомендации');
        }

        const data = await response.json();
        displayMotivationAdvice(data.advice);

    } catch (error) {
        console.error('Error generating team advice:', error);
        const errorMessage = currentLanguage === 'ru' 
            ? 'Не удалось сгенерировать рекомендации. Попробуйте обновить страницу.'
            : 'Failed to generate recommendations. Please try refreshing the page.';
        displayMotivationAdvice(errorMessage);
    }
}

function displayMotivationAdvice(advice) {
    const container = document.getElementById('motivationAdvice');
    
    const formattedAdvice = advice
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
            line = line.trim();
            if (/^\d+\./.test(line)) {
                return `<div class="mb-3"><strong class="text-white">${line}</strong></div>`;
            }
            if (line.startsWith('•') || line.startsWith('-')) {
                return `<div class="mb-2 pl-4">${line}</div>`;
            }
            return `<div class="mb-2">${line}</div>`;
        })
        .join('');
    
    container.innerHTML = `<div class="leading-relaxed">${formattedAdvice}</div>`;
}

function displayInitialAdviceMessage() {
    const container = document.getElementById('motivationAdvice');
    const currentLanguage = window.translationManager ? window.translationManager.currentLanguage : 'ru';
    
    const message = currentLanguage === 'ru' 
        ? 'Нажмите "Обновить рекомендации" для получения персонализированных советов по мотивации команды на основе анализа мотивационных триггеров.'
        : 'Click "Refresh Recommendations" to get personalized team motivation advice based on motivational triggers analysis.';
    
    container.innerHTML = `<p class="leading-relaxed opacity-75 italic">${message}</p>`;
}

document.addEventListener('DOMContentLoaded', function() {
    loadTeamData();

    document.getElementById('refreshAdviceBtn').addEventListener('click', function() {
        const adviceContainer = document.getElementById('motivationAdvice');
        adviceContainer.innerHTML = `
            <div class="animate-pulse">
                <div class="h-4 bg-white bg-opacity-20 rounded mb-2"></div>
                <div class="h-4 bg-white bg-opacity-20 rounded mb-2"></div>
                <div class="h-4 bg-white bg-opacity-20 rounded w-3/4"></div>
            </div>
        `;
        generateTeamAdvice(teamEmployees);
    });

    document.getElementById('langRu').addEventListener('click', function() {
        if (window.translationManager) {
            window.translationManager.setLanguage('ru');
        }
        this.classList.add('bg-blue-600', 'text-white');
        this.classList.remove('bg-gray-300', 'text-gray-700');
        document.getElementById('langEn').classList.remove('bg-blue-600', 'text-white');
        document.getElementById('langEn').classList.add('bg-gray-300', 'text-gray-700');
    });

    document.getElementById('langEn').addEventListener('click', function() {
        if (window.translationManager) {
            window.translationManager.setLanguage('en');
        }
        this.classList.add('bg-blue-600', 'text-white');
        this.classList.remove('bg-gray-300', 'text-gray-700');
        document.getElementById('langRu').classList.remove('bg-blue-600', 'text-white');
        document.getElementById('langRu').classList.add('bg-gray-300', 'text-gray-700');
    });
});
