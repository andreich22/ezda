import { describe, expect, it } from 'vitest';
import { selectNextTask } from '../scripts/task-next.mjs';

describe('task queue', () => {
  it('selects the highest-priority ready task with terminal dependencies', () => {
    const result = selectNextTask({
      tasks: [
        { id: '1111', title: 'P2 ready', status: 'ready', priority: 'P2', dependencies: [] },
        { id: '2222', title: 'P0 blocked', status: 'ready', priority: 'P0', dependencies: ['3333'] },
        { id: '3333', title: 'dependency', status: 'in_progress', priority: 'P1', dependencies: [] },
        { id: '4444', title: 'P1 ready', status: 'ready', priority: 'P1', dependencies: [] },
        { id: '5555', title: 'cancelled dependency', status: 'cancelled', priority: 'P1', dependencies: [] },
        { id: '6666', title: 'P0 with cancelled dependency', status: 'ready', priority: 'P0', dependencies: ['5555'] }
      ]
    });
    expect(result?.id).toBe('6666');
  });

  it('returns null when every ready task is blocked', () => {
    expect(selectNextTask({
      tasks: [
        { id: '1111', title: 'blocked', status: 'ready', priority: 'P0', dependencies: ['2222'] },
        { id: '2222', title: 'working', status: 'in_progress', priority: 'P0', dependencies: [] }
      ]
    })).toBeNull();
  });
});
