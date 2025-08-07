/**
 * @file js/components.js
 * @description Funções para renderizar componentes de UI reutilizáveis com a nova identidade visual.
 */

const components = {
    // Renderiza os componentes globais da UI (spinner, toast)
    renderGlobalUI() {
        const uiContainer = document.createElement('div');
        uiContainer.innerHTML = `
            <div id="toast-container" class="fixed top-5 right-5 z-50 space-y-3"></div>
            <div id="spinner-overlay" class="hidden fixed inset-0 bg-editaliza-black bg-opacity-60 z-50 flex items-center justify-center">
                <div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-editaliza-blue"></div>
            </div>
        `;
        document.body.prepend(uiContainer);
    },

    // Cache do avatar do usuário para evitar múltiplas requisições
    userAvatarCache: null,
    userAvatarCacheTime: null,
    userAvatarCacheTimeout: 5 * 60 * 1000, // 5 minutos

    // Carregar dados do usuário (avatar) para a navegação
    async loadUserAvatar() {
        // Verificar se há cache válido
        const now = Date.now();
        if (this.userAvatarCache && this.userAvatarCacheTime && 
            (now - this.userAvatarCacheTime) < this.userAvatarCacheTimeout) {
            return this.userAvatarCache;
        }

        try {
            const userProfile = await app.apiFetch('/profile');
            this.userAvatarCache = userProfile.profile_picture || null;
            this.userAvatarCacheTime = now;
            return this.userAvatarCache;
        } catch (error) {
            console.warn('Erro ao carregar avatar do usuário:', error);
            return null;
        }
    },

    // Limpar cache do avatar (chamado quando avatar é atualizado)
    clearUserAvatarCache() {
        this.userAvatarCache = null;
        this.userAvatarCacheTime = null;
    },

    // Renderiza a navegação principal
    async renderMainNavigation(activePage) {
        const navContainer = document.getElementById('main-nav-container');
        if (!navContainer) return;

        const links = [
            { href: 'home.html', text: 'Painel Principal' },
            { href: 'dashboard.html', text: 'Gerenciar Planos' },
            { href: 'profile.html', text: 'Meu Perfil' },
            { href: 'metodologia.html', text: 'Nossa Metodologia' },
            { href: 'politica-privacidade.html', text: 'Privacidade' },
            { href: 'faq.html', text: 'FAQ' }
        ];

        let linksHtml = links.map(link => {
            const isActive = activePage === link.href;
            const linkClass = isActive ? 'nav-link-active' : 'nav-link-default';
            return `<a href="${link.href}" class="${linkClass} px-4 py-2 rounded-lg text-sm font-medium transition-colors">${link.text}</a>`;
        }).join('');
        
        // Carregar avatar do usuário
        const userAvatar = await this.loadUserAvatar();
        
        // Criar HTML do perfil com ou sem avatar
        let profileHtml;
        if (userAvatar) {
            // Sanitizar o caminho do avatar
            const sanitizedAvatarPath = app.sanitizeHtml(userAvatar);
            const avatarUrl = sanitizedAvatarPath.startsWith('./') ? sanitizedAvatarPath : './' + sanitizedAvatarPath;
            
            profileHtml = `
                <a href="profile.html" class="hidden sm:flex items-center space-x-2 text-sm font-medium text-editaliza-gray hover:text-editaliza-black transition-all duration-200 group">
                    <div class="relative">
                        <img id="nav-user-avatar" src="${avatarUrl}" 
                             class="w-8 h-8 rounded-full object-cover border-2 border-transparent group-hover:border-editaliza-blue transition-all duration-200 shadow-sm" 
                             alt="Avatar do usuário"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="w-8 h-8 bg-gradient-to-br from-editaliza-blue to-indigo-600 rounded-full hidden items-center justify-center text-white text-xs font-bold border-2 border-transparent group-hover:border-editaliza-blue transition-all duration-200 shadow-sm">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                    </div>
                    <span class="hidden md:inline group-hover:text-editaliza-blue transition-colors duration-200">Perfil</span>
                </a>`;
        } else {
            // Fallback para ícone padrão
            profileHtml = `
                <a href="profile.html" class="hidden sm:flex items-center space-x-2 text-sm font-medium text-editaliza-gray hover:text-editaliza-black transition-all duration-200 group">
                    <div class="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white group-hover:from-editaliza-blue group-hover:to-indigo-600 transition-all duration-200 shadow-sm">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                        </svg>
                    </div>
                    <span class="hidden md:inline group-hover:text-editaliza-blue transition-colors duration-200">Perfil</span>
                </a>`;
        }
        
        navContainer.innerHTML = `
            <header class="bg-white shadow-md sticky top-0 z-20">
                <div class="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex justify-between items-center h-16">
                        <div class="flex items-center space-x-3">
                            <a href="home.html" class="flex-shrink-0 flex items-center">
                                                                <svg id="logo-header" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 510.24 101.5" class="h-8 w-auto">
                                    <defs>
                                        <style>
                                          .cls-1 { fill: #0528f2; }
                                          .cls-2 { fill: #0d0d0d; }
                                          .cls-3 { fill: #1ad937; }
                                        </style>
                                    </defs>
                                    <g id="Camada_1-2" data-name="Camada 1">
                                        <g>
                                            <g>
                                                <path class="cls-2" d="M148.68,17.22l49.51-.04v9.32l-39.51.03v17.97l37.97-.03v9.22l-37.97.03v20.83l39.51-.03v9.22l-49.51.04V17.22Z"/>
                                                <path class="cls-2" d="M210.98,77.75c-4.49-4.5-6.73-10.65-6.73-18.44s2.13-13.7,6.39-18.26c4.26-4.57,10.17-6.85,17.74-6.86,7.5,0,13.55,2.59,18.17,7.78v-24.82h9.23s0,66.56,0,66.56h-9.23s0-5.79,0-5.79c-2.24,2.22-4.82,3.87-7.74,4.95-2.92,1.08-6.04,1.62-9.37,1.62-7.82,0-13.97-2.24-18.46-6.74ZM242.51,72.54c2.76-2.57,4.13-6.39,4.13-11.46v-3.61c0-4.56-1.52-8.19-4.57-10.89-3.04-2.69-7.16-4.04-12.35-4.03-4.74,0-8.57,1.4-11.49,4.19-2.92,2.79-4.37,7.01-4.37,12.65s1.44,9.89,4.33,12.74c2.88,2.85,6.95,4.27,12.21,4.27,5.32,0,9.36-1.29,12.11-3.86Z"/>
                                                <path class="cls-2" d="M264.04,17.13h9.42s0,11.21,0,11.21h-9.42s0-11.21,0-11.21ZM264.14,35.96h9.23s0,47.73,0,47.73h-9.23s0-47.73,0-47.73Z"/>
                                                <path class="cls-2" d="M293.7,80.3c-2.34-2.76-3.61-6.8-3.8-12.12v-23.77h-8.27s0-8.27,0-8.27h8.27v-17.69h9.32s0,17.68,0,17.68h15.86s0,8.26,0,8.26h-15.86v24.55c0,4.69,2.66,7.03,7.98,7.03,2.18,0,4.65-.32,7.4-.96l2.21,7.32c-2.31.76-4.31,1.3-6.01,1.62-1.7.32-3.48.48-5.34.48-5.51,0-9.44-1.37-11.78-4.13Z"/>
                                                <path class="cls-2" d="M326.96,80.36c-3.43-2.57-5.14-6.32-5.14-11.26,0-6.09,2.55-10.19,7.64-12.32,5.1-2.13,12.03-3.26,20.81-3.39l9.04-.2v-1.24c0-3.55-.95-6.05-2.84-7.51-1.89-1.46-5.14-2.18-9.76-2.18-4.1,0-7.21.67-9.32,2-2.12,1.33-3.24,3.58-3.36,6.75h-9.42c.13-5.89,2.05-10.17,5.77-12.84,3.72-2.67,9.16-4.03,16.34-4.1,7.69.06,13.25,1.57,16.68,4.55,3.43,2.98,5.14,7.51,5.14,13.6v31.38h-9.13s0-7.03,0-7.03c-4.55,5.08-10.64,7.62-18.27,7.62-6.02,0-10.75-1.28-14.18-3.84ZM354.7,73.64c3.08-1.97,4.61-4.6,4.61-7.9v-5.8l-8.84.29c-7.05.26-12.03,1.07-14.95,2.44-2.92,1.37-4.37,3.51-4.37,6.42,0,2.41.96,4.26,2.88,5.56,1.92,1.3,4.84,1.95,8.75,1.94,4.87,0,8.84-.99,11.92-2.96Z"/>
                                                <path class="cls-2" d="M377.19,17.04h9.23s0,66.56,0,66.56h-9.23s0-66.56,0-66.56Z"/>
                                                <path class="cls-2" d="M394.68,17.02h9.42s0,11.21,0,11.21h-9.42s0-11.21,0-11.21ZM394.78,35.85h9.23s0,47.73,0,47.73h-9.23s0-47.73,0-47.73Z"/>
                                                <path class="cls-2" d="M412.28,76.83l30.57-33.12-29.9.02v-7.7l42.4-.03v6.56l-30.38,32.93,30.09-.02v8.08l-42.78.03v-6.75Z"/>
                                                <path class="cls-2" d="M468.66,80.25c-3.43-2.57-5.14-6.32-5.14-11.26,0-6.09,2.55-10.19,7.64-12.32,5.1-2.13,12.03-3.26,20.81-3.39l9.04-.2v-1.24c0-3.55-.95-6.05-2.84-7.51-1.89-1.46-5.14-2.18-9.76-2.18-4.1,0-7.21.67-9.32,2-2.12,1.33-3.24,3.58-3.36,6.75h-9.42c.13-5.89,2.05-10.17,5.77-12.84,3.72-2.67,9.16-4.03,16.34-4.1,7.69.06,13.25,1.57,16.68,4.55,3.43,2.98,5.14,7.51,5.14,13.6v31.38h-9.13s0-7.03,0-7.03c-4.55,5.08-10.64,7.62-18.27,7.62-6.02,0-10.75-1.28-14.18-3.84ZM496.39,73.53c3.08-1.97,4.61-4.6,4.61-7.9v-5.8l-8.84.29c-7.05.26-12.03,1.07-14.95,2.44-2.92,1.37-4.37,3.51-4.37,6.42,0,2.41.96,4.26,2.88,5.56,1.92,1.3,4.84,1.95,8.75,1.94,4.87,0,8.84-.99,11.92-2.96Z"/>
                                            </g>
                                            <g>
                                                <path class="cls-1" d="M58.62,101.5s-12.21-26.73-43.18-21.61v-24.04s29.74,1.62,40.51,31.49c1.21,4.27,2.12,8.98,2.67,14.17Z"/>
                                                <path class="cls-3" d="M58.62,101.5c-6.75-32.15-28.77-42.36-43.18-45.57-3.53-.79-6.61-1.16-8.89-1.33-2.37-.18-4.2-2.14-4.2-4.52,0-2.73,2.38-4.84,5.09-4.5,11.47,1.44,39.07,8.39,48.52,41.75,1.21,4.27,2.12,8.98,2.67,14.17Z"/>
                                                <path class="cls-1" d="M69.48,101.5s12.21-27.94,43.18-22.83v-22.83s-29.74,1.62-40.51,31.49c-1.21,4.27-2.12,8.98-2.67,14.17Z"/>
                                                <path class="cls-3" d="M69.48,101.5c6.75-32.15,28.77-42.36,43.18-45.57,3.53-.79,6.61-1.16,8.89-1.33,2.37-.18,4.2-2.14,4.2-4.52,0-2.73-2.38-4.84-5.09-4.5-11.47,1.44-39.07,8.39-48.52,41.75-1.21,4.27-2.12,8.98-2.67,14.17Z"/>
                                                <path class="cls-1" d="M92.24,7.72C83.54,2.57,73.8,0,64.05,0c-9.75,0-19.49,2.57-28.19,7.72L1.79,27.87c-2.97,1.76-2.07,6.28,1.35,6.75,12,1.65,31.51,6.67,49.09,21.75,1.7,1.46,3.6,2.57,5.6,3.33,3.99,1.52,8.42,1.52,12.41,0,2-.76,3.9-1.87,5.6-3.33,17.59-15.08,37.1-20.1,49.09-21.75,3.42-.47,4.33-4.99,1.35-6.75L92.24,7.72ZM64.05,48.49c-6.16,0-11.16-5-11.16-11.16s5-11.16,11.16-11.16,11.16,5,11.16,11.16-5,11.16-11.16,11.16Z"/>
                                            </g>
                                        </g>
                                    </g>
                                </svg>

                            </a>
                        </div>
                        <nav class="hidden md:flex items-center space-x-4">
                            ${linksHtml}
                        </nav>
                        <div class="flex items-center space-x-4">
                            ${profileHtml}
                            <button id="logoutButton" class="text-sm font-medium text-editaliza-gray hover:text-editaliza-black transition-colors">Sair</button>
                        </div>
                    </div>
                </div>
            </header>
        `;
        
        document.getElementById('logoutButton').addEventListener('click', () => app.logout());
    },
    
    renderPlanHeader(planId, planName, activePage) {
        const headerContainer = document.getElementById('plan-header-container');
        if (!headerContainer) return;

        const safePlanName = app.sanitizeHtml(planName);

        const links = [
            { id: 'navPerformance', href: `plan.html?id=${planId}`, text: 'Meu Desempenho' },
            { id: 'navSchedule', href: `cronograma.html?id=${planId}`, text: 'Ver Cronograma' },
            { id: 'navSettings', href: `plan_settings.html?id=${planId}`, text: 'Configurar Plano' }
        ];

        let linksHtml = links.map(link => {
            const isActive = activePage === link.href.split('?')[0];
            const activeClass = 'bg-editaliza-blue text-white cursor-default';
            const defaultClass = 'bg-white hover:bg-gray-100 text-gray-700';
            return `<a id="${link.id}" href="${link.href}" class="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 shadow-sm transition-colors ${isActive ? activeClass : defaultClass}">${link.text}</a>`;
        }).join('');

        headerContainer.innerHTML = `
            <div class="content-card mb-8">
                <div class="flex flex-col sm:flex-row justify-between sm:items-center">
                    <div class="mb-4 sm:mb-0">
                        <h1 class="text-2xl font-bold text-editaliza-black">${safePlanName}</h1>
                        <p id="examDate" class="text-md text-editaliza-gray mt-1"></p>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${linksHtml}
                    </div>
                </div>
            </div>
        `;
    },

    renderOverdueAlert(count, containerId = 'overdue-alert-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (count > 0) {
            container.innerHTML = `
                <div id="overdueAlert" class="glass-card p-6 rounded-3xl mb-8 border-l-4 border-amber-400 animate-glow" role="alert">
                    <div class="flex items-start space-x-4">
                        <div class="flex-shrink-0">
                            <div class="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center animate-pulse shadow-lg">
                                <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-grow">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="text-xl font-bold text-gray-800">Atenção!</h3>
                                <span class="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full flex items-center space-x-1">
                                    <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                    <span>${count} atrasada${count > 1 ? 's' : ''}</span>
                                </span>
                            </div>
                            <p class="text-gray-700 font-medium mb-2">Você tem ${count} tarefa${count > 1 ? 's' : ''} atrasada${count > 1 ? 's' : ''}.</p>
                            <p class="text-gray-600 text-sm mb-6">Não se preocupe! Podemos reorganizar seu cronograma automaticamente para você voltar aos trilhos.</p>
                            
                            <!-- Action Section -->
                            <div class="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                                <button id="showReplanDetailsButton" class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2">
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span>Ver Detalhes</span>
                                </button>
                                
                                <button id="replanButton" class="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2">
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span>Replanejar</span>
                                    <span class="text-xl">🚀</span>
                                </button>
                                
                                <button onclick="document.getElementById('overdueAlert').style.display='none'" class="sm:w-auto px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors duration-300 flex items-center justify-center">
                                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                    </svg>
                                    Depois
                                </button>
                            </div>
                            
                            <!-- Seção de detalhes do replanejamento (inicialmente oculta) -->
                            <div id="replanDetails" class="hidden mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                <div class="flex items-center mb-3">
                                    <svg class="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    <h4 class="font-semibold text-blue-800">Estratégia de Replanejamento</h4>
                                </div>
                                <div id="replanDetailsContent" class="text-sm text-blue-700">
                                    <div class="animate-pulse">Carregando detalhes...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
        } else {
            container.innerHTML = '';
        }
    },

    
    createSessionCard(session) {
        const style = app.getSubjectStyle(session.subject_name);
        const isCompleted = session.status === 'Concluído';
        const cardBg = isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-white';
        const sessionTypeConfig = {
            'Novo Tópico': { bg: 'bg-gradient-to-r from-blue-100 to-blue-200', text: 'text-blue-800', icon: '', border: 'border-blue-300', showBadge: false },
            'Reforço Extra': { bg: 'bg-gradient-to-r from-orange-100 to-orange-200', text: 'text-orange-800', icon: '💪', border: 'border-orange-300', showBadge: false },
            'Revisão 7D': { bg: 'bg-gradient-to-r from-yellow-100 to-yellow-200', text: 'text-yellow-800', icon: '📚', border: 'border-yellow-300', showBadge: true, badgeText: '7D' },
            'Revisão 14D': { bg: 'bg-gradient-to-r from-purple-100 to-purple-200', text: 'text-purple-800', icon: '🔄', border: 'border-purple-300', showBadge: true, badgeText: '14D' },
            'Revisão 28D': { bg: 'bg-gradient-to-r from-pink-100 to-pink-200', text: 'text-pink-800', icon: '🎯', border: 'border-pink-300', showBadge: true, badgeText: '28D' },
            'Simulado Direcionado': { bg: 'bg-gradient-to-r from-purple-100 to-indigo-200', text: 'text-purple-800', icon: '🎯', border: 'border-purple-400', showBadge: false },
            'Simulado Completo': { bg: 'bg-gradient-to-r from-slate-100 to-gray-200', text: 'text-slate-800', icon: '🏆', border: 'border-slate-400', showBadge: false },
            'Redação': { bg: 'bg-gradient-to-r from-rose-100 to-rose-200', text: 'text-rose-800', icon: '✍️', border: 'border-rose-300', showBadge: false }
        };
        
        const typeConfig = sessionTypeConfig[session.session_type] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: '📖', showBadge: false };
        
        // CORREÇÃO: Badge de revisão agora usa posicionamento absoluto para constância.
        const badgeHtml = typeConfig.showBadge ?
            `<span class="absolute top-3 right-3 flex items-center bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                <span class="mr-1.5">${typeConfig.icon}</span>
                <span>${typeConfig.badgeText}</span>
            </span>` : '';

        // O ícone de tipo de sessão (secundário) agora só aparece se não for uma revisão.
        const secondaryText = !typeConfig.showBadge ? `<div class="flex items-center">
            <span class="${typeConfig.bg} ${typeConfig.text} ${typeConfig.border} border-2 px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-center shadow-sm">
                <span class="text-xl">${typeConfig.icon}</span>
            </span>
        </div>` : '';
        
        const safeSubjectName = app.sanitizeHtml(session.subject_name);
        const safeTopicDescription = app.sanitizeHtml(session.topic_description);
        
        const escapeAttr = (jsonStr) => jsonStr.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
        const sessionJsonString = escapeAttr(JSON.stringify(session));

        return `
            <div id="session-card-${session.id}" class="relative study-card flex flex-col h-full p-6 rounded-2xl shadow-lg border-l-4 ${style.color} ${cardBg} transform transition-all duration-300 hover:shadow-2xl group">
                ${badgeHtml}
                <div class="flex-grow">
                    <!-- Header com ícone e título -->
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-12 h-12 ${style.color.replace('border-', 'bg-').replace('-500', '-100')} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <span class="text-2xl">${style.icon}</span>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-bold text-lg ${isCompleted ? 'text-gray-600' : 'text-gray-800'} group-hover:text-gray-900 transition-colors">
                                        ${safeSubjectName}
                                    </h3>
                                </div>
                            </div>
                        </div>
                        ${secondaryText}
                    </div>
                    
                    <!-- Description -->
                    <p class="text-sm ${isCompleted ? 'text-gray-500' : 'text-gray-600'} leading-relaxed mb-4">
                        ${safeTopicDescription}
                    </p>
                    
                    <!-- Visual separator -->
                    <div class="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4"></div>
                </div>
                
                <!-- Action Section -->
                <div class="mt-auto">
                    ${isCompleted ? `
                        <div class="flex items-center justify-center text-green-600 font-semibold py-3 bg-green-50 rounded-xl">
                            <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <span>Tarefa Concluída!</span>
                            <span class="ml-2 text-xl animate-bounce">🎉</span>
                        </div>
                    ` : `
                        <button onclick='openStudySession(${session.id})' data-session='${sessionJsonString}' class="group/btn w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-3">
                            <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                                </svg>
                            </div>
                            <span class="text-lg">Iniciar Estudo</span>
                            <span class="text-xl group-hover/btn:animate-bounce">🚀</span>
                        </button>
                    `}
                </div>
            </div>`;
    },

    createSimuladCard(session) {
        const isCompleted = session.status === 'Concluído';
        const isDirected = session.session_type === 'Simulado Direcionado';

        // CORREÇÃO: Estilos mais diferenciados e atrativos para cada tipo de simulado
        const style = isDirected ? 
            { 
                color: 'border-purple-500', 
                bg: 'bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50', 
                icon: '🎯', 
                gradient: 'from-purple-600 via-indigo-600 to-blue-600',
                badge: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg',
                title: 'Simulado Direcionado - Teste Específico',
                subtitle: 'Questões focadas em tópicos já estudados'
            } : 
            { 
                color: 'border-slate-600', 
                bg: 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50', 
                icon: '🏆', 
                gradient: 'from-slate-600 via-gray-600 to-zinc-600',
                badge: 'bg-gradient-to-r from-slate-600 to-gray-600 text-white shadow-lg',
                title: 'Simulado Completo - Avaliação Geral',
                subtitle: 'Teste abrangente de todo o conhecimento'
            };
        
        const safeSubjectName = app.sanitizeHtml(session.subject_name);
        
        let descriptionHtml = '';
        if (isDirected) {
            const description = app.sanitizeHtml(session.topic_description);
            const parts = description.split('\n\n');
            const mainTitle = parts[0];
            
            if (parts.length > 1) {
                // Formatar descrição estruturada
                descriptionHtml += `<p class="mb-4 text-lg font-semibold text-gray-800">${mainTitle}</p>`;
                
                // Extrair lista de tópicos
                const topicsList = parts[1];
                if (topicsList && topicsList.includes('•')) {
                    const topics = topicsList.split('\n').filter(line => line.trim().startsWith('•'));
                    descriptionHtml += `
                        <div class="bg-white/60 p-5 rounded-xl border border-purple-100 mb-4">
                            <h4 class="font-bold text-gray-800 mb-3 flex items-center">
                                <span class="text-xl mr-2">🎯</span>
                                Tópicos Abordados:
                            </h4>
                            <ul class="space-y-2">
                                ${topics.map(topic => `<li class="text-sm text-gray-700 flex items-start"><span class="text-purple-500 mr-2 mt-1">•</span><span>${topic.replace('•', '').trim()}</span></li>`).join('')}</ul>
                        </div>
                    `;
                }
                
                // Adicionar texto final se existir
                if (parts[2]) {
                    descriptionHtml += `<p class="text-sm text-gray-600 italic">${parts[2]}</p>`;
                }
            } else {
                descriptionHtml = `<p class="text-lg text-gray-700">${description}</p>`;
            }
        } else {
            descriptionHtml = `<p class="text-lg text-gray-700">${app.sanitizeHtml(session.topic_description)}</p>`;
        }
        
        const escapeAttr = (jsonStr) => jsonStr.replace(/'/g, '&#39;').replace(/'/g, '&quot;');
        const sessionJsonString = escapeAttr(JSON.stringify(session));

        return `
            <div class="md:col-span-2 lg:col-span-3 xl:col-span-4 study-card flex flex-col justify-between h-full p-8 rounded-3xl shadow-xl border-l-4 ${style.color} ${style.bg} group">
                <!-- Header Section -->
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-4">
                            <div class="w-20 h-20 bg-gradient-to-br ${style.gradient} rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                                <span class="text-4xl">${style.icon}</span>
                            </div>
                            <div class="flex-grow">
                                <div class="flex items-center space-x-3 mb-2">
                                    <h3 class="font-bold text-2xl text-gray-800 group-hover:text-gray-900 transition-colors">${safeSubjectName}</h3>
                                    <span class="${style.badge} px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                        ${isDirected ? 'DIRECIONADO' : 'COMPLETO'}
                                    </span>
                                </div>
                                <p class="text-base font-semibold text-gray-600 mb-1">${style.title}</p>
                                <p class="text-sm text-gray-500">${style.subtitle}</p>
                            </div>
                        </div>
                        <div class="hidden md:flex items-center space-x-2">
                            <div class="w-3 h-3 bg-gradient-to-r ${style.gradient} rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-gradient-to-r ${style.gradient} rounded-full animate-pulse" style="animation-delay: 0.5s;"></div>
                            <div class="w-1 h-1 bg-gradient-to-r ${style.gradient} rounded-full animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                    </div>
                    
                    <!-- Content Section -->
                    <div class="prose prose-sm max-w-none">${descriptionHtml}</div>
                </div>
                
                <!-- Action Section -->
                <div class="mt-auto pt-6 border-t border-gray-200">
                     ${isCompleted ? `
                        <div class="flex items-center justify-center text-green-600 font-bold py-4 bg-green-50 rounded-2xl">
                           <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                               <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                   <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                               </svg>
                           </div>
                           <span class="text-lg">Simulado Concluído!</span>
                           <span class="ml-3 text-2xl animate-bounce">🎖️</span>
                        </div>
                    ` : `
                        <button onclick='openStudySession(${session.id})' data-session='${sessionJsonString}' class="group/btn w-full bg-gradient-to-r ${style.gradient} hover:shadow-2xl text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-4">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                                </svg>
                            </div>
                            <span class="text-xl">Iniciar Simulado</span>
                            <span class="text-2xl group-hover/btn:animate-bounce">${style.icon}</span>
                        </button>
                    `}
                </div>
            </div>`;
    },

    createEssayCard(session) {
        const style = app.getSubjectStyle(session.subject_name);
        const isCompleted = session.status === 'Concluído';
        const cardBg = 'bg-gradient-to-br from-rose-50 to-pink-50';

        const safeSubjectName = app.sanitizeHtml(session.subject_name);
        const safeTopicDescription = app.sanitizeHtml(session.topic_description);
        
        const escapeAttr = (jsonStr) => jsonStr.replace(/'/g, '&#39;').replace(/'/g, '&quot;');
        const sessionJsonString = escapeAttr(JSON.stringify(session));
        
        return `
            <div class="md:col-span-2 lg:col-span-3 xl:col-span-4 study-card flex flex-col justify-between h-full p-8 rounded-3xl shadow-xl border-l-4 ${style.color} ${cardBg} group">
                <!-- Header Section -->
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-4">
                            <div class="w-16 h-16 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                <span class="text-3xl">✍️</span>
                            </div>
                            <div>
                                <h3 class="font-bold text-2xl text-gray-800 group-hover:text-gray-900 transition-colors">${safeSubjectName}</h3>
                                <p class="text-sm font-medium text-gray-500 uppercase tracking-wider">Redação</p>
                            </div>
                        </div>
                        <div class="hidden md:flex items-center space-x-2">
                            <div class="w-3 h-3 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse" style="animation-delay: 0.5s;"></div>
                            <div class="w-1 h-1 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                    </div>
                    
                    <!-- Content Section -->
                    <div class="bg-white/60 p-6 rounded-2xl border border-rose-100">
                        <p class="text-lg text-gray-700 leading-relaxed">${safeTopicDescription}</p>
                        
                        <!-- Writing Tips -->
                        <div class="mt-4 flex items-center space-x-4 text-sm text-gray-600">
                            <div class="flex items-center space-x-1">
                                <span class="text-rose-500">📝</span>
                                <span>Estrutura</span>
                            </div>
                            <div class="flex items-center space-x-1">
                                <span class="text-rose-500">💡</span>
                                <span>Argumentação</span>
                            </div>
                            <div class="flex items-center space-x-1">
                                <span class="text-rose-500">✨</span>
                                <span>Criatividade</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Action Section -->
                <div class="mt-auto pt-6 border-t border-rose-200">
                    ${isCompleted ? `
                        <div class="flex items-center justify-center text-green-600 font-bold py-4 bg-green-50 rounded-2xl">
                            <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <span class="text-lg">Redação Concluída!</span>
                            <span class="ml-3 text-2xl animate-bounce">🏆</span>
                        </div>
                    ` : `
                         <button onclick='openStudySession(${session.id})' data-session='${sessionJsonString}' class="group/btn w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 hover:shadow-2xl text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-4">
                            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover/btn:bg-white/30 transition-colors">
                                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path>
                                </svg>
                            </div>
                            <span class="text-xl">Iniciar Redação</span>
                            <span class="text-2xl group-hover/btn:animate-bounce">✍️</span>
                        </button>
                    `}
                </div>
            </div>
        `;
    },

    createReviewCard(session) {
        const style = app.getSubjectStyle(session.subject_name);
        const isCompleted = session.status === 'Concluído';
        const cardBg = isCompleted ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-white';

        const description = app.sanitizeHtml(session.topic_description);
        const parts = description.split('\n\n');
        const mainTitle = parts.shift(); // "Revisão dos seguintes tópicos:"

        const topicsHtml = parts.map(part => {
            const lines = part.split('\n');
            const subjectName = lines.shift().replace(/\*\*/g, '');
            const topicList = lines.map(line => `<li>${line.replace(/• /g, '').trim()}</li>`).join('');
            return `<h4 class="font-bold text-gray-800 mt-4">${subjectName}</h4><ul class="list-disc list-inside space-y-1 text-sm text-gray-600">${topicList}</ul>`;
        }).join('');

        return `
            <div id="session-card-${session.id}" class="md:col-span-2 lg:col-span-3 xl:col-span-4 study-card flex flex-col h-full p-6 rounded-2xl shadow-lg border-l-4 ${style.color} ${cardBg} transform transition-all duration-300 hover:shadow-2xl group">
                <div class="flex-grow">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-12 h-12 ${style.color.replace('border-', 'bg-').replace('-400', '-100')} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <span class="text-2xl">${style.icon}</span>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-bold text-lg ${isCompleted ? 'text-gray-600' : 'text-gray-800'} group-hover:text-gray-900 transition-colors">
                                        ${app.sanitizeHtml(session.subject_name)}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 leading-relaxed mb-4">${mainTitle}</p>
                    <div class="prose prose-sm max-w-none">${topicsHtml}</div>
                </div>
                <div class="mt-auto pt-4">
                    ${isCompleted ? `
                        <div class="flex items-center justify-center text-green-600 font-semibold py-3 bg-green-50 rounded-xl">
                            <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                            </div>
                            <span>Revisão Concluída!</span>
                        </div>
                    ` : `
                        <button onclick='markReviewAsCompleted(${session.id})' class="group/btn w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center space-x-3">
                            <span class="text-lg">Marcar como Concluída</span>
                        </button>
                    `}
                </div>
            </div>
        `;
    },

    // VERSÃO CORRIGIDA: Dashboard de gamificação com métricas precisas
    // Método para atualizar avatar na navegação após mudança no perfil
    async updateNavigationAvatar() {
        this.clearUserAvatarCache();
        const navAvatar = document.getElementById('nav-user-avatar');
        if (navAvatar) {
            const newAvatar = await this.loadUserAvatar();
            if (newAvatar) {
                const sanitizedAvatarPath = app.sanitizeHtml(newAvatar);
                const avatarUrl = sanitizedAvatarPath.startsWith('./') ? sanitizedAvatarPath : './' + sanitizedAvatarPath;
                navAvatar.src = avatarUrl + '?t=' + new Date().getTime(); // Cache buster
                navAvatar.style.display = 'block';
                navAvatar.nextElementSibling.style.display = 'none';
            } else {
                navAvatar.style.display = 'none';
                navAvatar.nextElementSibling.style.display = 'flex';
            }
        }
    },

    renderGamificationDashboard(gamificationData, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !gamificationData) return;
        
        // CORREÇÃO: Usar dados reais do backend
        const safeData = {
            currentStreak: gamificationData.studyStreak || 0,
            totalXP: gamificationData.experiencePoints || 0,
            totalStudyDays: gamificationData.totalStudyDays || 0,
            levelName: gamificationData.concurseiroLevel || 'Aspirante a Servidor(a) 🌱',
            achievementsCount: gamificationData.achievements ? gamificationData.achievements.length : 0,
            achievements: gamificationData.achievements || [],
            completedTopicsCount: gamificationData.completedTopicsCount || 0,
            totalCompletedSessions: gamificationData.totalCompletedSessions || 0
        };
        
        // Cards únicos com informações não duplicadas e métricas corretas
        container.innerHTML = `
            <div class="mb-8">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-3xl font-bold text-gray-800 flex items-center">
                        <span class="text-4xl mr-3 animate-bounce">🏆</span>
                        Estatísticas de Desempenho
                    </h3>
                    <div class="text-sm text-gray-500 italic">
                        <span class="w-2 h-2 bg-green-500 rounded-full inline-block mr-2 animate-pulse"></span>
                        Atualizado em tempo real
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <!-- Sequência de Estudos Corrigida -->
                    <div class="bg-white border border-orange-200 p-6 rounded-2xl text-center hover:shadow-xl transform hover:scale-105 transition-all duration-300 shadow-sm">
                        <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 ${safeData.currentStreak > 0 ? 'animate-pulse' : ''}">
                            <span class="text-2xl">${safeData.currentStreak > 0 ? '🔥' : '💤'}</span>
                        </div>
                        <p class="text-xs font-semibold text-orange-800 uppercase tracking-wider mb-1">Sequência Atual</p>
                        <p class="text-3xl font-bold ${safeData.currentStreak > 0 ? 'text-orange-600' : 'text-gray-400'}">${safeData.currentStreak}</p>
                        <p class="text-xs text-gray-500 mt-1">${safeData.currentStreak === 1 ? 'dia consecutivo' : 'dias consecutivos'}</p>
                        ${safeData.currentStreak === 0 ? '<p class="text-xs text-red-500 mt-1 font-medium">Vamos retomar!</p>' : ''}
                    </div>
                    
                    <!-- Total de Dias de Estudo -->
                    <div class="bg-white border border-editaliza-blue/30 p-6 rounded-2xl text-center hover:shadow-xl transform hover:scale-105 transition-all duration-300 shadow-sm">
                        <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">📅</span>
                        </div>
                        <p class="text-xs font-semibold text-editaliza-blue uppercase tracking-wider mb-1">Total de Dias</p>
                        <p class="text-3xl font-bold text-editaliza-blue">${safeData.totalStudyDays}</p>
                        <p class="text-xs text-gray-500 mt-1">${safeData.totalStudyDays === 1 ? 'dia estudado' : 'dias estudados'}</p>
                    </div>
                    
                    <!-- Experiência Total -->
                    <div class="bg-white border border-purple-200 p-6 rounded-2xl text-center hover:shadow-xl transform hover:scale-105 transition-all duration-300 shadow-sm">
                        <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">✨</span>
                        </div>
                        <p class="text-xs font-semibold text-purple-800 uppercase tracking-wider mb-1">Experiência</p>
                        <p class="text-3xl font-bold text-purple-600">${safeData.totalXP.toLocaleString()}</p>
                        <p class="text-xs text-gray-500 mt-1">pontos XP totais</p>
                    </div>
                    
                    <!-- Conquistas -->
                    <div class="bg-white border border-green-200 p-6 rounded-2xl text-center hover:shadow-xl transform hover:scale-105 transition-all duration-300 shadow-sm">
                        <div class="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span class="text-2xl">🏅</span>
                        </div>
                        <p class="text-xs font-semibold text-green-800 uppercase tracking-wider mb-1">Conquistas</p>
                        <p class="text-3xl font-bold text-green-700">${safeData.achievementsCount}</p>
                        <p class="text-xs text-gray-500 mt-1">${safeData.achievementsCount === 1 ? 'medalha obtida' : 'medalhas obtidas'}</p>
                    </div>
                </div>
                
                <!-- Seção de Conquistas Desbloqueadas -->
                ${safeData.achievements.length > 0 ? `
                    <div class="mt-8 glass-card p-6 rounded-2xl bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border-2 border-dashed border-yellow-300">
                        <div class="text-center mb-4">
                            <div class="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <span class="text-3xl">🏆</span>
                            </div>
                            <h4 class="text-xl font-bold text-gray-800 mb-2">Conquistas Desbloqueadas</h4>
                        </div>
                        <div class="flex flex-wrap justify-center gap-2">
                            ${safeData.achievements.map(achievement => `
                                <span class="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                                    ${achievement}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="mt-8 glass-card p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
                        <div class="text-center">
                            <span class="text-3xl mb-2 block">📈</span>
                            <p class="text-lg font-semibold text-gray-700">Complete suas primeiras atividades para desbloquear conquistas!</p>
                        </div>
                    </div>
                `}
            </div>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    components.renderGlobalUI();
});
