/**
 * @file js/checklist.js
 * @description Sistema de checklist e gerenciamento da sessão de estudo em modal.
 */

const StudyChecklist = {
    session: null, // Armazena o objeto completo da sessão

    items: [
        { id: 'hydration', icon: '💧', text: 'Água por perto?', tip: 'Mantenha-se hidratado!' },
        { id: 'bathroom', icon: '🚻', text: 'Banheiro OK?', tip: 'Evite interrupções' },
        { id: 'phone', icon: '📱', text: 'Celular no silencioso?', tip: 'Foco total!' },
        { id: 'materials', icon: '📚', text: 'Material em mãos?', tip: 'Livros, caderno, caneta...' },
        { id: 'snacks', icon: '🍎', text: 'Café ultra forte e lanche preparados?', tip: 'Energia para o cérebro' },
        { id: 'comfort', icon: '🪑', text: 'Postura confortável?', tip: 'Cuide da sua coluna' },
        { id: 'mindset', icon: '💪', text: 'Vontade de vencer ativada?', tip: 'Você consegue!' }
    ],

    motivationalQuotes: [
        "A aprovação está mais perto do que você imagina! 🎯",
        "Cada minuto de estudo é um passo em direção ao seu sonho! ✨",
        "Hoje você está construindo o seu futuro! 🚀",
        "Disciplina é a ponte entre objetivos e conquistas! 🌉",
        "O sucesso é a soma de pequenos esforços repetidos dia após dia! 💫",
        "Você não chegou até aqui para desistir agora! 🔥",
        "Foco no processo, o resultado é consequência! 📈",
        "Grandes jornadas começam com pequenos passos! 👣"
    ],

    show(sessionObject) {
        this.session = sessionObject;
        const modal = document.getElementById('studySessionModal');
        const modalContainer = document.getElementById('studySessionModalContainer');
        
        modalContainer.innerHTML = this.getChecklistHtml();
        modal.classList.remove('hidden');
        
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modalContainer.classList.remove('scale-95');
        }, 10);
        
        this.addAnimations();
        this.addChecklistListeners();
    },

    startStudySession() {
        const modalContainer = document.getElementById('studySessionModalContainer');
        modalContainer.innerHTML = this.getTimerHtml();
        this.addTimerSessionListeners();
        
        TimerSystem.start(this.session.id);
    },

    close() {
        if (this.session) {
            TimerSystem.stop(this.session.id);
        }
        const modal = document.getElementById('studySessionModal');
        const modalContainer = document.getElementById('studySessionModalContainer');
        
        modal.classList.add('opacity-0');
        modalContainer.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modalContainer.innerHTML = '';
            this.session = null;
        }, 300);
    },
    
    getChecklistHtml() {
        return `
            <div class="text-center mb-6">
                <h2 class="text-2xl font-bold text-editaliza-black mb-2">Preparado para Estudar? 🎯</h2>
                <p class="text-gray-600 text-sm">${this.getRandomQuote()}</p>
            </div>
            
            <div class="space-y-3 mb-6">
                ${this.items.map(item => `
                    <label class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group">
                        <input type="checkbox" id="checklist-${item.id}" class="w-5 h-5 text-editaliza-blue rounded focus:ring-editaliza-blue checklist-item">
                        <span class="text-2xl">${item.icon}</span>
                        <div class="flex-1">
                            <span class="text-gray-700 font-medium">${item.text}</span>
                            <p class="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">${item.tip}</p>
                        </div>
                    </label>
                `).join('')}
            </div>
            
            <div class="space-y-3">
                <button id="start-study-btn" class="w-full btn-primary py-3 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                    Vamos lá! 🚀
                </button>
                <button id="skip-checklist-btn" class="w-full text-sm text-gray-500 hover:text-gray-700 font-medium">
                    Pular desta vez
                </button>
            </div>
        `;
    },

    getTimerHtml() {
        // Sanitize data before rendering
        const safeSubjectName = app.sanitizeHtml(this.session.subject_name);
        const safeTopicDescription = app.sanitizeHtml(this.session.topic_description);
        const safeNotes = app.sanitizeHtml(this.session.notes || '');
        const safeQuestionsSolved = app.sanitizeHtml(this.session.questions_solved || '');

        const style = app.getSubjectStyle(this.session.subject_name);
        return `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-800 flex items-center"><span class="text-3xl mr-3">${style.icon}</span>${safeSubjectName}</h2>
                <button onclick="StudyChecklist.close()" class="text-gray-400 hover:text-gray-600 text-3xl font-light">×</button>
            </div>
            <p class="mb-6 text-gray-600">${safeTopicDescription}</p>
            
            ${TimerSystem.createTimerUI(this.session.id)}

            <div class="mt-6 space-y-4">
                 <div>
                    <label for="modal-questions-solved" class="text-sm font-medium text-gray-700">Questões Resolvidas</label>
                    <input type="number" id="modal-questions-solved" value="${safeQuestionsSolved}" class="form-input py-2" placeholder="0">
                </div>
                <div>
                    <label for="modal-notes" class="text-sm font-medium text-gray-700">Anotações</label>
                    <textarea id="modal-notes" class="form-input py-2" rows="4" placeholder="Suas anotações...">${safeNotes}</textarea>
                </div>
            </div>

            <div class="mt-6 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div class="flex items-center">
                    <input type="checkbox" id="modal-status" ${this.session.status === 'Concluído' ? 'checked' : ''} class="h-5 w-5 rounded border-gray-300 text-editaliza-blue focus:ring-editaliza-blue">
                    <label for="modal-status" class="ml-3 font-medium text-gray-700">Marcar como Concluído</label>
                </div>
                <button onclick="StudyChecklist.close()" class="btn-secondary py-2 px-6">Fechar Sessão</button>
            </div>
        `;
    },

    addChecklistListeners() {
        const startBtn = document.getElementById('start-study-btn');
        const skipBtn = document.getElementById('skip-checklist-btn');
        
        document.querySelectorAll('.checklist-item').forEach(cb => cb.addEventListener('change', () => {
            this.playCheckSound();
            const allChecked = this.items.every(item => document.getElementById(`checklist-${item.id}`).checked);
            startBtn.disabled = !allChecked;
        }));
        
        startBtn.addEventListener('click', () => this.startStudySession());
        skipBtn.addEventListener('click', () => this.startStudySession());
    },

    addTimerSessionListeners() {
        const updateSessionData = app.debounce(async (field, value) => {
            try {
                await app.apiFetch(`/sessions/${this.session.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ [field]: value })
                });
                this.session[field] = value;
            } catch (error) {
                app.showToast('Erro ao salvar dados da sessão.', 'error');
            }
        }, 1000);

        document.getElementById('modal-questions-solved').addEventListener('input', (e) => updateSessionData('questions_solved', e.target.value));
        document.getElementById('modal-notes').addEventListener('input', (e) => updateSessionData('notes', e.target.value));
        document.getElementById('modal-status').addEventListener('change', async (e) => {
            const newStatus = e.target.checked ? 'Concluído' : 'Pendente';
            await app.apiFetch(`/sessions/${this.session.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ 'status': newStatus })
            });

            // ***** CORREÇÃO APLICADA AQUI *****
            // Invalida o cache do plano para que a tela de Desempenho busque os novos dados.
            app.invalidatePlanCache(this.session.study_plan_id);

            app.showToast('Status da tarefa atualizado!', 'success');
            
            // Atualizar painéis na tela plan.html se estivermos nela
            if (window.location.pathname.includes('plan.html')) {
                try {
                    app.showToast('Atualizando gráficos de progresso...', 'success');
                    // Recarregar os painéis de progresso
                    if (typeof loadDetailedProgress === 'function') {
                        await loadDetailedProgress();
                    }
                    if (typeof loadPerformanceCheck === 'function') {
                        await loadPerformanceCheck();
                    }
                    if (typeof loadGoalProgress === 'function') {
                        await loadGoalProgress();
                    }
                    app.showToast('Gráficos de progresso atualizados!', 'success');
                } catch (error) {
                    console.error('Erro ao atualizar painéis:', error);
                    app.showToast('Erro ao atualizar gráficos de progresso', 'error');
                }
            }
            
            if (e.target.checked) {
                this.close();
                // Não precisa mais recarregar a página inteira, já atualizamos os painéis
                if (!window.location.pathname.includes('plan.html')) {
                    location.reload(); 
                }
            }
        });
    },

    addAnimations() {
        if (document.getElementById('checklist-animations')) return;
        const style = document.createElement('style');
        style.id = 'checklist-animations';
        style.textContent = `
            .checklist-item:checked + span + div span { text-decoration: line-through; color: #10b981; }
            .checklist-item:checked + span { animation: bounce 0.5s ease-out; }
            @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        `;
        document.head.appendChild(style);
    },

    playCheckSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.05);
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) { console.error("Web Audio API not supported", e); }
    },
    
    getRandomQuote() {
        return this.motivationalQuotes[Math.floor(Math.random() * this.motivationalQuotes.length)];
    }
};