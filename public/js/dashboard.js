let currentTeams = [];
let currentEmployees = [];
let editingTeamId = null;
let editingEmployeeId = null;

function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user_info');
    
    if (!token || !user) {
        window.location.href = '/login';
        return false;
    }
    
    const userInfo = JSON.parse(user);
    document.getElementById('userName').textContent = userInfo.name;
    document.getElementById('welcomeUserName').textContent = userInfo.name;
    return token;
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadTeams() {
    const token = checkAuth();
    if (!token) return;

    try {
        const response = await fetch('/api/teams', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const teams = await response.json();

        if (response.ok) {
            currentTeams = teams;
            displayTeams(teams);
        } else {
            throw new Error(teams.error || 'Ошибка загрузки команд');
        }
    } catch (error) {
        document.getElementById('teamsLoading').classList.add('hidden');
        document.getElementById('error').classList.remove('hidden');
        document.getElementById('errorMessage').textContent = error.message;
    }
}

function displayTeams(teams) {
    document.getElementById('teamsLoading').classList.add('hidden');
    document.getElementById('teamsContainer').classList.remove('hidden');

    if (teams.length === 0) {
        document.getElementById('noTeams').classList.remove('hidden');
        return;
    }

    const teamsList = document.getElementById('teamsList');
    teamsList.innerHTML = '';

    teams.forEach(team => {
        const teamCard = document.createElement('div');
        teamCard.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer';
        teamCard.onclick = (e) => {
            if (e.target.closest('button')) {
                return;
            }
            window.location.href = `/team/${team.id}`;
        };
        
        const createdDate = new Date(team.created_at).toLocaleDateString('ru-RU');
        teamCard.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors">${escapeHtml(team.name)}</h3>
                <div class="flex space-x-2">
                    <button onclick="editTeam('${team.id}')" class="text-blue-600 hover:text-blue-800">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteTeam('${team.id}', '${escapeHtml(team.name)}')" class="text-red-600 hover:text-red-800">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <p class="text-gray-600 text-sm mb-4">${team.description ? escapeHtml(team.description) : 'Нет описания'}</p>
            <p class="text-gray-500 text-xs">Создана: ${createdDate}</p>
        `;
        
        teamsList.appendChild(teamCard);
    });
    
    if (window.translationManager) {
        window.translationManager.updatePageContent();
    }
}

async function loadEmployees() {
    const token = checkAuth();
    if (!token) return;

    try {
        const response = await fetch('/api/employees', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const employees = await response.json();

        if (response.ok) {
            currentEmployees = employees;
            displayEmployees(employees);
        } else {
            throw new Error(employees.error || 'Ошибка загрузки сотрудников');
        }
    } catch (error) {
        document.getElementById('employeesLoading').classList.add('hidden');
        document.getElementById('error').classList.remove('hidden');
        document.getElementById('errorMessage').textContent = error.message;
    }
}

function displayEmployees(employees) {
    document.getElementById('employeesLoading').classList.add('hidden');
    document.getElementById('employeesContainer').classList.remove('hidden');

    if (employees.length === 0) {
        document.getElementById('noEmployees').classList.remove('hidden');
        return;
    }

    const employeesList = document.getElementById('employeesList');
    employeesList.innerHTML = '';

    employees.forEach(employee => {
        const employeeCard = document.createElement('div');
        employeeCard.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer';
        
        employeeCard.addEventListener('click', (e) => {
            if (e.target.closest('button')) {
                return;
            }
            window.location.href = `/employee/${employee.id}`;
        });
        
        const hireDate = employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('ru-RU') : 'Не указана';
        employeeCard.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900 truncate">${escapeHtml(employee.name)}</h3>
                <div class="flex space-x-2">
                    <button onclick="editEmployee('${employee.id}')" class="text-blue-600 hover:text-blue-800 z-10 relative">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteEmployee('${employee.id}', '${escapeHtml(employee.name)}')" class="text-red-600 hover:text-red-800 z-10 relative">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="space-y-2 text-sm text-gray-600">
                ${employee.position ? `<p><span class="font-medium">Должность:</span> ${escapeHtml(employee.position)}</p>` : ''}
                ${employee.email ? `<p><span class="font-medium">Email:</span> ${escapeHtml(employee.email)}</p>` : ''}
                ${employee.phone ? `<p><span class="font-medium">Телефон:</span> ${escapeHtml(employee.phone)}</p>` : ''}
                ${employee.team_name ? `<p><span class="font-medium">Команда:</span> ${escapeHtml(employee.team_name)}</p>` : ''}
                <p><span class="font-medium">Дата найма:</span> ${hireDate}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-gray-200">
                <button onclick="window.location.href='/employee/${employee.id}'" class="text-xs text-blue-600 hover:text-blue-800 underline" data-translate="employees.click_to_view_profile">
                    Нажмите для просмотра полного профиля
                </button>
            </div>
        `;
        
        employeesList.appendChild(employeeCard);
    });
    
    if (window.translationManager) {
        window.translationManager.updatePageContent();
    }
}

function showTeamModal(isEdit = false) {
    const modal = document.getElementById('teamModal');
    const title = document.getElementById('teamModalTitle');
    
    if (isEdit) {
        title.textContent = window.translationManager ? window.translationManager.t('teams.edit_team') : 'Редактировать команду';
    } else {
        title.textContent = window.translationManager ? window.translationManager.t('teams.create_team') : 'Создать команду';
        document.getElementById('teamForm').reset();
        editingTeamId = null;
    }
    
    modal.classList.add('show');
}

function hideTeamModal() {
    document.getElementById('teamModal').classList.remove('show');
    document.getElementById('teamForm').reset();
    editingTeamId = null;
}

function showEmployeeModal(isEdit = false) {
    const modal = document.getElementById('employeeModal');
    const title = document.getElementById('employeeModalTitle');
    
    const teamSelect = document.getElementById('employeeTeam');
    teamSelect.innerHTML = '<option value="">Без команды</option>';
    currentTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamSelect.appendChild(option);
    });
    
    if (isEdit) {
        title.textContent = window.translationManager ? window.translationManager.t('employees.edit_employee') : 'Редактировать сотрудника';
    } else {
        title.textContent = window.translationManager ? window.translationManager.t('employees.create_employee') : 'Добавить сотрудника';
        document.getElementById('employeeForm').reset();
        editingEmployeeId = null;
    }
    
    modal.classList.add('show');
}

function hideEmployeeModal() {
    document.getElementById('employeeModal').classList.remove('show');
    document.getElementById('employeeForm').reset();
    editingEmployeeId = null;
}

async function saveTeam(formData) {
    const token = localStorage.getItem('auth_token');
    const url = editingTeamId ? `/api/teams/${editingTeamId}` : '/api/teams';
    const method = editingTeamId ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: formData.get('name'),
                description: formData.get('description')
            })
        });

        const result = await response.json();

        if (response.ok) {
            const message = editingTeamId ? 
                (window.translationManager ? window.translationManager.t('teams.team_updated') : 'Команда успешно обновлена') :
                (window.translationManager ? window.translationManager.t('teams.team_created') : 'Команда успешно создана');
            showToast(message);
            hideTeamModal();
            loadTeams();
        } else {
            throw new Error(result.error || 'Ошибка сохранения команды');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function saveEmployee(formData) {
    const token = localStorage.getItem('auth_token');
    const url = editingEmployeeId ? `/api/employees/${editingEmployeeId}` : '/api/employees';
    const method = editingEmployeeId ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: formData.get('name'),
                email: formData.get('email'),
                position: formData.get('position'),
                teamId: formData.get('teamId') || null,
                phone: formData.get('phone'),
                hireDate: formData.get('hireDate')
            })
        });

        const result = await response.json();

        if (response.ok) {
            const message = editingEmployeeId ? 
                (window.translationManager ? window.translationManager.t('employees.employee_updated') : 'Сотрудник успешно обновлен') :
                (window.translationManager ? window.translationManager.t('employees.employee_created') : 'Сотрудник успешно добавлен');
            showToast(message);
            hideEmployeeModal();
            loadEmployees();
        } else {
            throw new Error(result.error || 'Ошибка сохранения сотрудника');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function editTeam(teamId) {
    const team = currentTeams.find(t => t.id === teamId);
    if (!team) return;
    
    editingTeamId = teamId;
    document.getElementById('teamName').value = team.name;
    document.getElementById('teamDescription').value = team.description || '';
    showTeamModal(true);
}

function editEmployee(employeeId) {
    const employee = currentEmployees.find(e => e.id === employeeId);
    if (!employee) return;
    
    editingEmployeeId = employeeId;
    document.getElementById('employeeName').value = employee.name;
    document.getElementById('employeeEmail').value = employee.email || '';
    document.getElementById('employeePosition').value = employee.position || '';
    document.getElementById('employeeTeam').value = employee.team_id || '';
    document.getElementById('employeePhone').value = employee.phone || '';
    document.getElementById('employeeHireDate').value = employee.hire_date ? employee.hire_date.split('T')[0] : '';
    showEmployeeModal(true);
}

async function deleteTeam(teamId, teamName) {
    const confirmMessage = window.translationManager ? 
        window.translationManager.t('teams.confirm_delete').replace('{teamName}', teamName) : 
        `Вы уверены, что хотите удалить команду "${teamName}"?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    const token = localStorage.getItem('auth_token');
    
    try {
        const response = await fetch(`/api/teams/${teamId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const message = window.translationManager ? window.translationManager.t('teams.team_deleted') : 'Команда успешно удалена';
            showToast(message);
            loadTeams();
        } else {
            showToast(result.error || 'Ошибка при удалении команды', 'error');
        }
    } catch (error) {
        showToast('Ошибка при удалении команды', 'error');
    }
}

async function deleteEmployee(employeeId, employeeName) {
    const confirmMessage = window.translationManager ? 
        window.translationManager.t('employees.confirm_delete').replace('{employeeName}', employeeName) : 
        `Вы уверены, что хотите удалить сотрудника "${employeeName}"?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    const token = localStorage.getItem('auth_token');
    
    try {
        const response = await fetch(`/api/employees/${employeeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const message = window.translationManager ? window.translationManager.t('employees.employee_deleted') : 'Сотрудник успешно удален';
            showToast(message);
            loadEmployees();
        } else {
            showToast(result.error || 'Ошибка при удалении сотрудника', 'error');
        }
    } catch (error) {
        showToast('Ошибка при удалении сотрудника', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    loadTeams();
    loadEmployees();
    
    document.getElementById('createTeamBtn').addEventListener('click', () => showTeamModal());
    document.getElementById('createFirstTeamBtn').addEventListener('click', () => showTeamModal());
    document.getElementById('closeTeamModal').addEventListener('click', hideTeamModal);
    document.getElementById('cancelTeamBtn').addEventListener('click', hideTeamModal);
    
    document.getElementById('createEmployeeBtn').addEventListener('click', () => showEmployeeModal());
    document.getElementById('createFirstEmployeeBtn').addEventListener('click', () => showEmployeeModal());
    document.getElementById('closeEmployeeModal').addEventListener('click', hideEmployeeModal);
    document.getElementById('cancelEmployeeBtn').addEventListener('click', hideEmployeeModal);
    
    document.getElementById('teamForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        saveTeam(formData);
    });
    
    document.getElementById('employeeForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        saveEmployee(formData);
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.href = '/';
    });
    
    document.getElementById('teamModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            hideTeamModal();
        }
    });
    
    document.getElementById('employeeModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            hideEmployeeModal();
        }
    });
});
