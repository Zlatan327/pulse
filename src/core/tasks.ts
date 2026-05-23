import type { TaskItem } from './types.js';

/** Format tasks as a checklist string for chat display */
export function formatTaskChecklist(tasks: TaskItem[]): string {
  if (tasks.length === 0) return '';

  const header = '📋 Action Items';
  const divider = '─'.repeat(20);

  const items = tasks.map(task => {
    const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
    let line = `${priority} ▢ ${task.assignee}: ${task.description}`;
    if (task.deadline) {
      line += `\n     ⏱️ Deadline: ${task.deadline}`;
    }
    return line;
  });

  return `${header}\n${divider}\n${items.join('\n')}`;
}

/** Format tasks as a compact inline string (for short responses) */
export function formatTasksCompact(tasks: TaskItem[]): string {
  if (tasks.length === 0) return '';
  return tasks.map(t => `• ${t.assignee}: ${t.description}`).join('\n');
}
