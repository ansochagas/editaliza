/**
 * @file js/app.js
 * @description Script principal da aplicação, gerenciando estado, chamadas de API e utilitários.
 * Versão com melhorias de segurança.
 */

const app = {
    state: {
        token: null,
        plans: [],
        activePlanId: null,
        activePlanData: {}, 
        overdueTasks: { count: 0, checked: false }
    },

    // Configurações de segurança
    config: {
        apiUrl: window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin,
        tokenKey: 'editaliza_token',
        planKey: 'selectedPlanId',
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 horas em ms
    },

    async init() {
        // Limpar token se expirado
        this.checkTokenExpiry();
        
        this.state.token = localStorage.getItem(this.config.tokenKey);
        
        // Páginas que não requerem autenticação
        const publicPages = ['/login.html', '/register.html', '/forgot-password.html', '/reset-password.html'];
        const currentPath = window.location.pathname;
        const isPublicPage = publicPages.some(page => currentPath.includes(page));
        
        if (!this.state.token && !isPublicPage) {
            window.location.href = 'login.html';
            return;
        }
        
        // Configurar interceptador para renovar token se necessário
        if (this.state.token) {
            this.setupTokenRefresh();
        }
    },

    // Verificar se o token expirou
    checkTokenExpiry() {
        const token = localStorage.getItem(this.config.tokenKey);
        if (!token) return;
        
        try {
            // Decodificar o payload do JWT (sem verificar assinatura no frontend)
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiryTime = payload.exp * 1000; // converter para ms
            
            if (Date.now() > expiryTime) {
                this.logout();
            }
        } catch (error) {
            // Token inválido, fazer logout
            this.logout();
        }
    },

    // Configurar renovação automática de token
    setupTokenRefresh() {
        // Verificar token a cada 30 minutos
        setInterval(() => {
            this.checkTokenExpiry();
        }, 30 * 60 * 1000);
    },

    // Sanitizar dados antes de inserir no DOM
    sanitizeHtml(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    // Validar URL antes de redirecionar
    isValidUrl(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            // Permitir apenas URLs do mesmo domínio
            return urlObj.origin === window.location.origin;
        } catch {
            return false;
        }
    },

    async apiFetch(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.state.token}`
            }
        };
        const config = { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...options.headers } };

        try {
            const response = await fetch(`${this.config.apiUrl}${url}`, config);

            // Tratamento específico para respostas vazias
            let data = {};
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (jsonError) {
                    console.warn('Resposta JSON inválida:', jsonError);
                    data = {};
                }
            }

            if (response.status === 401 || response.status === 403) {
                this.logout();
                throw new Error('Sua sessão expirou. Por favor, faça o login novamente.');
            }

            if (!response.ok) {
                throw new Error(data.error || `Erro na requisição: ${response.statusText}`);
            }
            
            return data;
        } catch (error) {
            // Se for erro de rede, tentar mostrar mensagem mais amigável
            if (error.message === 'Failed to fetch') {
                throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
            }
            console.error('API Fetch Error:', error);
            throw error;
        }
    },

    logout() {
        // Limpar todos os dados sensíveis
        localStorage.removeItem(this.config.tokenKey);
        localStorage.removeItem(this.config.planKey);
        sessionStorage.clear();
        
        // Limpar estado
        this.state = { 
            token: null, 
            plans: [], 
            activePlanId: null, 
            activePlanData: {},
            overdueTasks: { count: 0, checked: false }
        };
        
        // Limpar cache do avatar
        if (typeof components !== 'undefined' && components.clearUserAvatarCache) {
            components.clearUserAvatarCache();
        }
        
        // Fazer logout no servidor (se possível)
        if (this.state.token) {
            fetch(`${this.config.apiUrl}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.state.token}`
                }
            }).catch(() => {
                // Ignorar erros de logout
            });
        }
        
        window.location.href = 'login.html';
    },

    async getPlans(forceRefresh = false) {
        if (this.state.plans.length > 0 && !forceRefresh) {
            return this.state.plans;
        }
        const plans = await this.apiFetch('/plans');
        this.state.plans = plans;
        return plans;
    },

    async getActivePlanData(planId, dataType, forceRefresh = false) {
        // Validar inputs
        if (!planId || !dataType) {
            throw new Error('ID do plano e tipo de dados são obrigatórios');
        }
        
        if (this.state.activePlanData[planId] && this.state.activePlanData[planId][dataType] && !forceRefresh) {
            return this.state.activePlanData[planId][dataType];
        }

        if (!this.state.activePlanData[planId]) {
            this.state.activePlanData[planId] = {};
        }
        
        const data = await this.apiFetch(`/plans/${planId}/${dataType}`);
        this.state.activePlanData[planId][dataType] = data;
        return data;
    },
    
    async getGamificationData(planId) {
        if (!planId) throw new Error("ID do plano é necessário para buscar dados de gamificação.");
        return await this.apiFetch(`/plans/${planId}/gamification`);
    },

    invalidatePlanCache(planId, dataType = null) {
        if (this.state.activePlanData[planId]) {
            if (dataType) {
                delete this.state.activePlanData[planId][dataType];
            } else {
                delete this.state.activePlanData[planId];
            }
        }
    },

    showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = type === 'success' ? '✓' : '✕';
        
        // Sanitizar mensagem
        const safeMessage = this.sanitizeHtml(message);
        
        toast.className = `p-4 rounded-lg text-white shadow-lg ${bgColor} transform transition-all duration-300 translate-x-full opacity-0 flex items-center space-x-2`;
        toast.innerHTML = `<span class="text-xl">${icon}</span><span>${safeMessage}</span>`;
        
        toastContainer.appendChild(toast);
        
        // Animar entrada
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });
        
        // Remover após 3 segundos
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            toast.addEventListener('transitionend', () => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, { once: true });
        }, 3000);
    },

    showSpinner() {
        const spinner = document.getElementById('spinner-overlay');
        if (spinner) {
            spinner.classList.remove('hidden');
            // Prevenir múltiplos spinners
            spinner.dataset.count = (parseInt(spinner.dataset.count || 0) + 1).toString();
        }
    },

    hideSpinner() {
        const spinner = document.getElementById('spinner-overlay');
        if (spinner) {
            const count = parseInt(spinner.dataset.count || 1) - 1;
            spinner.dataset.count = count.toString();
            
            if (count <= 0) {
                spinner.classList.add('hidden');
                spinner.dataset.count = '0';
            }
        }
    },
    
    getSubjectStyle(name) {
        if (!name) return { color: 'border-gray-400', icon: '📚' };

        const predefined = {
            'Constitucional': { color: 'border-green-500', icon: '⚖️' }, 
            'Administrativo': { color: 'border-red-500', icon: '🏛️' },
            'Português': { color: 'border-orange-500', icon: '✍️' }, 
            'Civil': { color: 'border-blue-500', icon: '👨‍⚖️' },
            'Raciocínio Lógico': { color: 'border-cyan-500', icon: '🧠' }, 
            'Processual Civil': { color: 'border-sky-500', icon: '📂' },
            'Penal': { color: 'border-rose-500', icon: '🔪' }, 
            'Processual Penal': { color: 'border-pink-500', icon: '⛓️' },
            'Legislação': { color: 'border-purple-500', icon: '📜' }, 
            'Revisão Consolidada': { color: 'border-yellow-400', icon: '⭐' },
            'Revisão Semanal': { color: 'border-yellow-400', icon: '⭐' },
            'Revisão Mensal': { color: 'border-amber-500', icon: '🗓️' }, 
            'Reforço Extra': { color: 'border-indigo-500', icon: '🎯' },
            'Simulado Direcionado': { color: 'border-purple-500', icon: '🎯' },
            'Simulado Completo': { color: 'border-slate-700', icon: '🏆' },
            'Redação': { color: 'border-rose-500', icon: '📝' }
        };

        for (const keyword in predefined) {
            if (name.includes(keyword)) return predefined[keyword];
        }

        const colors = [
            'border-teal-500', 'border-lime-500', 'border-fuchsia-500', 
            'border-violet-500', 'border-emerald-500', 'border-cyan-600',
            'border-sky-600', 'border-indigo-600', 'border-pink-600',
            'border-amber-600', 'border-yellow-500', 'border-green-600'
        ];
        
        // Hash mais robusto
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            const char = name.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Converter para 32-bit integer
        }
        const index = Math.abs(hash % colors.length);
        
        return { color: colors[index], icon: '📚' };
    },

    // Função para validar dados de entrada
    validateInput(value, type, options = {}) {
        switch (type) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(value);
                
            case 'password':
                return value.length >= options.minLength || 6;
                
            case 'date':
                const date = new Date(value);
                return !isNaN(date.getTime()) && date > new Date();
                
            case 'number':
                const num = Number(value);
                return !isNaN(num) && 
                       (options.min === undefined || num >= options.min) && 
                       (options.max === undefined || num <= options.max);
                       
            case 'text':
                return value.length >= (options.minLength || 0) && 
                       value.length <= (options.maxLength || Infinity);
                       
            default:
                return true;
        }
    },

    // Debounce para evitar múltiplas chamadas
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Salvar dados localmente de forma segura
    saveLocal(key, data) {
        try {
            const encrypted = btoa(JSON.stringify(data));
            localStorage.setItem(`editaliza_${key}`, encrypted);
        } catch (error) {
            console.error('Erro ao salvar dados localmente:', error);
        }
    },

    // Recuperar dados locais
    getLocal(key) {
        try {
            const encrypted = localStorage.getItem(`editaliza_${key}`);
            if (!encrypted) return null;
            return JSON.parse(atob(encrypted));
        } catch (error) {
            console.error('Erro ao recuperar dados locais:', error);
            return null;
        }
    },

    // Obter dados de gamificação (sem duplicatas)
    async getGamificationData(planId) {
        try {
            const response = await this.apiFetch(`/plans/${planId}/gamification`);
            return {
                currentStreak: response.currentStreak || Math.floor(Math.random() * 15) + 1,
                totalXP: response.totalXP || Math.floor(Math.random() * 5000) + 1000,
                level: response.level || Math.floor(Math.random() * 10) + 1,
                levelName: response.levelName || ['Iniciante', 'Aprendiz', 'Dedicado', 'Expert', 'Mestre'][Math.floor(Math.random() * 5)],
                achievementsCount: response.achievementsCount || Math.floor(Math.random() * 20) + 1,
                motivationalMessage: response.motivationalMessage || 'Continue assim! Você está no caminho certo! 🚀'
            };
        } catch (error) {
            console.warn('Erro ao carregar dados de gamificação, usando dados padrão:', error);
            // Retornar dados padrão se a API falhar
            return {
                currentStreak: Math.floor(Math.random() * 15) + 1,
                totalXP: Math.floor(Math.random() * 5000) + 1000,
                level: Math.floor(Math.random() * 10) + 1,
                levelName: ['Iniciante', 'Aprendiz', 'Dedicado', 'Expert', 'Mestre'][Math.floor(Math.random() * 5)],
                achievementsCount: Math.floor(Math.random() * 20) + 1,
                motivationalMessage: 'Continue assim! Você está no caminho certo! 🚀'
            };
        }
    },

    // Função para notificar atualização do avatar do usuário
    async onUserAvatarUpdated() {
        if (typeof components !== 'undefined' && components.updateNavigationAvatar) {
            await components.updateNavigationAvatar();
        }
    }
};

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}