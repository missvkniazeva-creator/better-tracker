import type { BoardSnapshot, Settings } from '@shared/types.ts';

/**
 * Thin fetch wrapper. Every mutating endpoint returns the whole board, so the
 * client's update path is always "replace the snapshot" -- no local merge logic
 * that could disagree with the server after a cascading change.
 */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return (await res.json()) as T;
}

const send = <T>(method: string, path: string, body?: unknown) =>
  call<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Unwraps `{ board }` envelopes from the create endpoints. */
const board = async (p: Promise<BoardSnapshot | { board: BoardSnapshot }>) => {
  const out = await p;
  return 'board' in out ? out.board : out;
};

export const api = {
  getBoard: () => call<BoardSnapshot>('/api/board'),

  createLane: (body: { name: string; hint?: string; color?: string }) =>
    send<BoardSnapshot>('POST', '/api/lanes', body),
  updateLane: (id: string, body: { name?: string; hint?: string; color?: string }) =>
    send<BoardSnapshot>('PATCH', `/api/lanes/${id}`, body),
  deleteLane: (id: string, target: string) =>
    send<BoardSnapshot>('DELETE', `/api/lanes/${id}?target=${encodeURIComponent(target)}`),
  reorderLanes: (orderedIds: string[]) =>
    send<BoardSnapshot>('POST', '/api/lanes/reorder', { orderedIds }),

  createColumn: (laneId: string, name: string) =>
    send<BoardSnapshot>('POST', `/api/lanes/${laneId}/columns`, { name }),
  renameColumn: (id: string, name: string) =>
    send<BoardSnapshot>('PATCH', `/api/columns/${id}`, { name }),
  deleteColumn: (id: string) => send<BoardSnapshot>('DELETE', `/api/columns/${id}`),
  reorderColumns: (laneId: string, orderedIds: string[]) =>
    send<BoardSnapshot>('POST', `/api/lanes/${laneId}/columns/reorder`, { orderedIds }),

  createTask: (body: Record<string, unknown>) =>
    board(send<{ board: BoardSnapshot }>('POST', '/api/tasks', body)),
  updateTask: (id: string, body: Record<string, unknown>) =>
    send<BoardSnapshot>('PATCH', `/api/tasks/${id}`, body),
  moveTask: (
    id: string,
    to: { laneId: string | null; columnId: string | null; x?: number; y?: number; index?: number },
  ) => send<BoardSnapshot>('POST', `/api/tasks/${id}/move`, to),
  copyTask: (id: string) => board(send<{ board: BoardSnapshot }>('POST', `/api/tasks/${id}/copy`)),
  deleteTask: (id: string) => send<BoardSnapshot>('DELETE', `/api/tasks/${id}`),

  addImage: (taskId: string, body: { name: string; mime: string; dataBase64: string }) =>
    board(send<{ board: BoardSnapshot }>('POST', `/api/tasks/${taskId}/images`, body)),
  deleteImage: (id: string) => send<BoardSnapshot>('DELETE', `/api/images/${id}`),

  addLogEntry: (taskId: string, body: Record<string, unknown>) =>
    board(send<{ board: BoardSnapshot }>('POST', `/api/tasks/${taskId}/log`, body)),
  updateLogEntry: (id: string, body: Record<string, unknown>) =>
    send<BoardSnapshot>('PATCH', `/api/log/${id}`, body),
  deleteLogEntry: (id: string) => send<BoardSnapshot>('DELETE', `/api/log/${id}`),

  createObjective: (body: Record<string, unknown>) =>
    board(send<{ board: BoardSnapshot }>('POST', '/api/objectives', body)),
  updateObjective: (id: string, body: Record<string, unknown>) =>
    send<BoardSnapshot>('PATCH', `/api/objectives/${id}`, body),
  archiveObjective: (id: string) => send<BoardSnapshot>('POST', `/api/objectives/${id}/archive`),
  deleteObjective: (id: string) => send<BoardSnapshot>('DELETE', `/api/objectives/${id}`),

  createOutcome: (body: Record<string, unknown>) =>
    board(send<{ board: BoardSnapshot }>('POST', '/api/outcomes', body)),
  updateOutcome: (id: string, body: Record<string, unknown>) =>
    send<BoardSnapshot>('PATCH', `/api/outcomes/${id}`, body),
  deleteOutcome: (id: string) => send<BoardSnapshot>('DELETE', `/api/outcomes/${id}`),

  createLabel: (name: string) =>
    board(send<{ board: BoardSnapshot }>('POST', '/api/labels', { name })),
  updateLabel: (id: string, body: { name?: string; hue?: number | null }) =>
    send<BoardSnapshot>('PATCH', `/api/labels/${id}`, body),
  deleteLabel: (id: string) => send<BoardSnapshot>('DELETE', `/api/labels/${id}`),

  updateSettings: (body: Partial<Settings>) => send<Settings>('PATCH', '/api/settings', body),
};
