/**
 * @file js/timer.js
 * @description Sistema de cronômetro para sessões de estudo (O Motor).
 */

const TimerSystem = {
    timers: {}, // { sessionId: { startTime, elapsed, isRunning, pomodoros } }
    
    // O `createTimerUI` foi movido para checklist.js para um controle centralizado do modal
    createTimerUI(sessionId) {
        const sessionDuration = 50; // Duração padrão, pode ser aprimorado para buscar do plano
        // Este HTML é gerado dentro do modal pela `checklist.js` agora.
        return `
            <div class="timer-container mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="timer-display text-3xl font-mono font-bold text-editaliza-blue" data-session="${sessionId}">00:00:00</div>
                    </div>
                    <div class="timer-controls flex items-center space-x-2">
                        <button onclick="TimerSystem.toggle(${sessionId})" class="btn-timer-toggle px-4 py-2 bg-editaliza-blue text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md flex items-center space-x-2" data-session="${sessionId}">
                           <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg><span>Iniciar</span>
                        </button>
                    </div>
                </div>
                 <div class="mt-3">
                    <div class="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progresso da Sessão</span><span class="pomodoro-status" data-session="${sessionId}" data-duration="${sessionDuration}">0 / ${sessionDuration} min</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2"><div class="pomodoro-progress bg-editaliza-green h-2 rounded-full transition-all" data-session="${sessionId}" style="width: 0%"></div></div>
                </div>
                 <div class="mt-2 flex items-center space-x-1"><span class="text-xs text-gray-600">Pomodoros:</span><div class="pomodoro-dots flex space-x-1" data-session="${sessionId}"></div></div>
            </div>`;
    },

    start(sessionId) {
        if (!this.timers[sessionId]) {
            this.timers[sessionId] = { startTime: Date.now(), elapsed: 0, isRunning: true, pomodoros: 0 };
        } else {
            this.timers[sessionId].startTime = Date.now() - this.timers[sessionId].elapsed;
            this.timers[sessionId].isRunning = true;
        }
        this.timers[sessionId].interval = setInterval(() => this.update(sessionId), 100);
        this.updateButton(sessionId, true);
    },

    stop(sessionId) {
        if (this.timers[sessionId] && this.timers[sessionId].isRunning) {
            this.timers[sessionId].isRunning = false;
            clearInterval(this.timers[sessionId].interval);
            this.updateButton(sessionId, false);
            this.saveTimeToDatabase(sessionId, Math.floor(this.timers[sessionId].elapsed / 1000));
        }
    },

    toggle(sessionId) {
        if (!this.timers[sessionId] || !this.timers[sessionId].isRunning) this.start(sessionId);
        else this.stop(sessionId);
    },

    update(sessionId) {
        if (!this.timers[sessionId] || !this.timers[sessionId].isRunning) return;
        this.timers[sessionId].elapsed = Date.now() - this.timers[sessionId].startTime;
        this.updateDisplay(sessionId);
        const completedPomodoros = Math.floor((this.timers[sessionId].elapsed / 60000) / 25);
        if (completedPomodoros > this.timers[sessionId].pomodoros) {
            this.timers[sessionId].pomodoros = completedPomodoros;
            this.notifyPomodoroComplete();
        }
    },

    updateDisplay(sessionId) {
        const timerData = this.timers[sessionId];
        if (!timerData) return;

        const display = document.querySelector(`#studySessionModal .timer-display[data-session="${sessionId}"]`);
        const progressBar = document.querySelector(`#studySessionModal .pomodoro-progress[data-session="${sessionId}"]`);
        const statusText = document.querySelector(`#studySessionModal .pomodoro-status[data-session="${sessionId}"]`);
        const dotsContainer = document.querySelector(`#studySessionModal .pomodoro-dots[data-session="${sessionId}"]`);
        
        if (!display) return; // Se o modal não estiver visível, não faz nada
        
        const h = Math.floor(timerData.elapsed / 3600000).toString().padStart(2, '0');
        const m = Math.floor((timerData.elapsed % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((timerData.elapsed % 60000) / 1000).toString().padStart(2, '0');
        display.textContent = `${h}:${m}:${s}`;
        
        if (progressBar && statusText) {
            const minutes = Math.floor(timerData.elapsed / 60000);
            const sessionDuration = parseInt(statusText.dataset.duration) || 50;
            const progress = Math.min((minutes / sessionDuration) * 100, 100);
            progressBar.style.width = `${progress}%`;
            statusText.textContent = `${minutes} / ${sessionDuration} min`;
        }

        if (dotsContainer) {
            dotsContainer.innerHTML = Array(timerData.pomodoros).fill('<div class="w-2 h-2 bg-editaliza-green rounded-full"></div>').join('');
        }
    },
    
    updateButton(sessionId, isRunning) {
        const button = document.querySelector(`#studySessionModal .btn-timer-toggle[data-session="${sessionId}"]`);
        if (!button) return;

        button.classList.remove('bg-editaliza-blue', 'hover:bg-blue-700', 'bg-orange-500', 'hover:bg-orange-600');
        
        if (isRunning) {
            button.classList.add('bg-orange-500', 'hover:bg-orange-600');
            button.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg><span>Pausar</span>`;
        } else {
            button.classList.add('bg-editaliza-blue', 'hover:bg-blue-700');
            const buttonText = (this.timers[sessionId]?.elapsed > 100) ? 'Continuar' : 'Iniciar';
            button.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg><span>${buttonText}</span>`;
        }
    },
    
    notifyPomodoroComplete() {
        app.showToast('🍅 Pomodoro completo! Hora de uma pausa de 5 minutos.', 'success');
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    },

    async saveTimeToDatabase(sessionId, seconds) {
        if(seconds < 10) return; // Não salvar tempos muito curtos
        try {
            await app.apiFetch(`/sessions/${sessionId}/time`, {
                method: 'POST',
                body: JSON.stringify({ seconds })
            });
        } catch (error) { console.error('Erro ao salvar tempo:', error); }
    }
};