import * as vscode from 'vscode';

/**
 * Статистика рабочего пространства
 * @interface WorkspaceStats
 * @property {number} totalTime - Общее время работы в workspace (в секундах)
 * @property {number} lastSaveTime - Время последнего сохранения (timestamp)
 */
interface WorkspaceStats {
	totalTime: number;
	lastSaveTime: number;
}

/**
 * Основной класс для отслеживания времени работы в vscode
 * @class TimeTracker
 */
export class TimeTracker {
	private statusBarItem: vscode.StatusBarItem;
	private isTracking: boolean = false;
    
    // момент начала текущей "сессии печати" в текущей сессии окна
	private startTime: number = 0;

	// общее время текущей сессии не учитывая текущую "сессию печати"
    private currentSessionTime: number = 0;
    // таймер неактивности (до inactivityTimeout)
	private inactivityTimer: NodeJS.Timeout | undefined;
	private readonly inactivityTimeout: number = 20 * 1000; // 20 секунд
    // таймер для обновления статус бара
	private updateInterval: NodeJS.Timeout | undefined;
    // Время последнего сохранения в текущей сессии
	private lastSaveTime: number = 0; 

	/**
	 * Создает экземпляр TimeTracker
	 * @constructor
	 * @param {vscode.ExtensionContext} context - Контекст расширения vscode
	 */
	constructor(private context: vscode.ExtensionContext) {
		this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
		this.statusBarItem.show();
		this.updateStatusBar();
		this.startTracking();
	}

    /**
	 * Запускает отслеживание времени
	 * @public
	 * @returns {void}
	 */
	public startTracking(): void {
		if (this.isTracking) { return; }

		this.isTracking = true;
		this.startTime = Date.now();
		this.setupEventListeners();
		this.updateStatusBar();
		
		this.updateInterval = setInterval(() => {
			this.updateStatusBar();
		}, 1000);
	}

    /**
	 * Останавливает отслеживание времени
	 * @public
	 * @returns {void}
	 */
	public stopTracking(): void {
		if (!this.isTracking) { return; }

		this.isTracking = false;
		
		// Сохраняем накопленное время сессии (без добавления к общему времени)
		this.currentSessionTime += (Date.now() - this.startTime) / 1000;
		
		this.clearInactivityTimer();
		this.clearUpdateInterval();
		this.updateStatusBar();
	}

    /**
	 * Настраивает обработчики событий для отслеживания активности пользователя
	 * @private
	 * @returns {void}
	 */
	private setupEventListeners(): void {
		const textChange = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.contentChanges.length > 0) {
				this.onActivity();
				
				if (!this.isTracking) {
					this.startTracking();
				}
			}
		});

		const selectionChange = vscode.window.onDidChangeTextEditorSelection(
            () => {
			this.onActivity();
			
			if (!this.isTracking) {
				this.startTracking();
			}
		});

        // подписываемся на эти события
		this.context.subscriptions.push(textChange, selectionChange);
	}

    /**
	 * Обрабатывает активность пользователя (сброс таймера неактивности)
	 * @private
	 * @returns {void}
	 */
	private onActivity(): void {
		this.resetInactivityTimer();
		this.updateStatusBar();
	}

    /**
	 * Сбрасывает таймер неактивности
	 * @private
	 * @returns {void}
	 */
	private resetInactivityTimer(): void {
		this.clearInactivityTimer();
		this.inactivityTimer = setTimeout(() => {
			    this.stopTracking();
		    }, 
            this.inactivityTimeout
        );
	}

    /**
	 * Очищает таймер неактивности
	 * @private
	 * @returns {void}
	 */
	private clearInactivityTimer(): void {
		if (this.inactivityTimer) {
			clearTimeout(this.inactivityTimer);
			this.inactivityTimer = undefined;
		}
	}
	
    /**
	 * Очищает интервал обновления статус-бара
	 * @private
	 * @returns {void}
	 */
	private clearUpdateInterval(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = undefined;
		}
	}

    /**
	 * Сохраняет статистику в глобальное состояние vscode
	 * @private
	 * @returns {void}
	 */
	private saveStats(): void {
		const workspaceKey = this.getWorkspaceKey();
		const existingStats = this.getStats();

		// Рассчитываем текущее общее время сессии
		const currentTotalSessionTime = this.isTracking ? 
			(this.currentSessionTime + (Date.now() - this.startTime) / 1000) : 
			this.currentSessionTime;

		// Вычисляем разницу с последним сохранением
		const timeSinceLastSave = currentTotalSessionTime - this.lastSaveTime;

		// Обновляем общее время
		existingStats.totalTime += timeSinceLastSave;
		
		// Обновляем время последнего сохранения
		existingStats.lastSaveTime = Date.now();
		this.lastSaveTime = currentTotalSessionTime;

		this.context.globalState.update(workspaceKey, existingStats);
	}

    /**
	 * Получает статистику текущего рабочего пространства
	 * @public
	 * @returns {WorkspaceStats} Объект со статистикой времени
	 */
	public getStats(): WorkspaceStats {
		const workspaceKey = this.getWorkspaceKey();
		const stats = this.context.globalState.get<WorkspaceStats>(workspaceKey) 
        || {
			totalTime: 0,
			lastSaveTime: 0
		};
		
		if (this.lastSaveTime === 0) {
			this.lastSaveTime = this.isTracking ? 
				(this.currentSessionTime + 
                    (Date.now() - this.startTime) / 1000) : 
				this.currentSessionTime;
		}
		
		return stats;
	}

    /**
	 * Сбрасывает статистику текущего рабочего пространства
	 * @public
	 * @returns {void}
	 */
	public resetStats(): void {
		const workspaceKey = this.getWorkspaceKey();
		this.context.globalState.update(workspaceKey, {
			totalTime: 0,
			lastSaveTime: Date.now()
		});
		
		// Сбрасываем текущую сессию
		this.currentSessionTime = 0;
		this.lastSaveTime = 0;
		this.startTime = Date.now();
		
		this.updateStatusBar();
	}

    /**
	 * Генерирует уникальный ключ для текущего рабочего пространства
	 * @private
	 * @returns {string} Ключ для хранения статистики
	 */
	private getWorkspaceKey(): string {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		return `stats_${workspaceFolder?.uri.toString() || 'global'}`;
	}

    /**
	 * Обновляет текст в статус-баре vscode
	 * @private
	 * @returns {void}
	 */
	private updateStatusBar(): void {
		let text = '⏱️ ';

		if (this.isTracking) {
			// Текущее время = накопленное время + активное время 
            // с последнего старта
			const currentTime = this.currentSessionTime 
            + (Date.now() - this.startTime) / 1000;
			text += this.formatTime(currentTime);
		} else {
			// Когда остановлено, показываем накопленное время сессии
			text += this.formatTime(this.currentSessionTime);
		}

		this.statusBarItem.text = text;
	}

    /**
	 * Форматирует время в секундах в строку ЧЧ:ММ:СС
	 * @private
	 * @param {number} seconds - Время в секундах
	 * @returns {string} Отформатированное время
	 */
	private formatTime(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);
		
		return `${hours.toString().padStart(2, '0')}:${minutes.toString()
            .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

    /**
	 * Показывает статистику во всплывающем окне
	 * @public
	 * @returns {void}
	 */
	public showStatistics(): void {
		this.saveStats(); // обновление статистики
		
		const stats = this.getStats();

		const message = [
			`Workspace Time Tracking Statistics`,
			`---`,
			`Total Time: ${this.formatTime(stats.totalTime)}`,
			`Current Session: ${this.formatTime(this.isTracking ? 
				(this.currentSessionTime + 
                    (Date.now() - this.startTime) / 1000) : 
				this.currentSessionTime)}`,
			`Status: ${this.isTracking ? 'Tracking' : 'Paused'}`,
			`---`,
			`*Statistics updated in real-time*`
		].join('\n');

		vscode.window.showInformationMessage(message, { modal: false });
	}

    /**
	 * Освобождает ресурсы и сохраняет данные при деактивации
	 * @public
	 * @returns {void}
	 */
	public dispose(): void {
		this.saveStats();
		this.stopTracking();
		this.statusBarItem.dispose();
		this.clearInactivityTimer();
		this.clearUpdateInterval();
	}
}

/**
 * Активирует расширение при запуске vscode
 * @param {vscode.ExtensionContext} context - Контекст расширения
 * @returns {void}
 */
export function activate(context: vscode.ExtensionContext): void {
	const tracker = new TimeTracker(context);

	const showStatsCommand = vscode.commands.registerCommand(
        'time-tracker.showStatistics', () => {
		tracker.showStatistics();
	});

	const resetStatsCommand = vscode.commands.registerCommand(
        'time-tracker.resetStatistics', () => {
		vscode.window.showWarningMessage(
			'Are you sure you want to reset all statistics for this workspace?',
			{ modal: true },
			'Reset'
		).then(selection => {
			if (selection === 'Reset') {
				tracker.resetStats();
				vscode.window.showInformationMessage(
                    'Statistics reset successfully'
                );
			}
		});
	});

	context.subscriptions.push(showStatsCommand, resetStatsCommand, tracker);
}

/**
 * Деактивирует расширение
 * @returns {void}
 */
export function deactivate(): void {
	console.log('Time Tracker extension deactivated');
}