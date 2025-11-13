# Отчет
## архитектура ide
vscode предоставляет vscode extension API, которое предоставляет ограниченный доступ к IDE

## технологический стек
* typescript/javascript
* vscode extension api

## жизненный цикл плагина
1. активация - при запуске IDE или по событию
2. инициализация - регистрация команд и обработчиков
3. выполнение - реакция на события/команды
4. деактивация - очистка ресурсов при закрытии

## ключевые компоненты API (использованные в моем плагине)
### Activation Events
задаются в package.json
```
 "activationEvents": [
    "onStartupFinished"
  ]
```
### Contribution Points
package.json:
```
"contributes": {
    "commands": [
      {
        "command": "time-tracker.showStatistics",
        "title": "Time Tracker: Show Statistics"
      },
      {
        "command": "time-tracker.resetStatistics",
        "title": "Time Tracker: Reset Statistics"
      }
    ]
  }
```
### архитектура плагина
TimeTracker (основной класс):
* StatusBarManager (отображение времени)
* EventListeners (отслеживание активности)
* StorageManager (сохранение статистики)
* TimerManager (управление таймерами)