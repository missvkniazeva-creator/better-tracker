import type { FastifyError, FastifyInstance } from 'fastify';
import { getDb } from '../db/index.ts';
import { readBoard } from '../repo/board.ts';
import * as lanes from '../repo/lanes.ts';
import * as tasks from '../repo/tasks.ts';
import * as objectives from '../repo/objectives.ts';
import * as outcomes from '../repo/outcomes.ts';
import * as labels from '../repo/labels.ts';
import * as log from '../repo/log.ts';
import { readSettings, writeSettings } from '../repo/settings.ts';
import type { Settings } from '../../../../shared/types.ts';

type Params<K extends string> = { Params: Record<K, string> };

/**
 * Every mutation answers with the full board snapshot.
 *
 * The dataset is one user's, so a snapshot costs a few milliseconds, and it makes
 * the client's job trivial: no reconciling a partial response against local state,
 * and no chance of the two drifting after a cascade (deleting a lane moves cards,
 * archiving an objective reparents children).
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  const d = getDb();
  const snapshot = () => readBoard(d);

  app.get('/api/health', async () => ({ ok: true, version: 1 }));
  app.get('/api/board', async () => snapshot());

  // ------------------------------------------------------------------ lanes
  app.post('/api/lanes', async (req) => {
    lanes.createLane(d, req.body as Parameters<typeof lanes.createLane>[1]);
    return snapshot();
  });
  app.patch<Params<'id'>>('/api/lanes/:id', async (req) => {
    lanes.updateLane(d, req.params.id, req.body as never);
    return snapshot();
  });
  app.delete<Params<'id'>>('/api/lanes/:id', async (req) => {
    const target = (req.query as { target?: string }).target ?? 'intake';
    lanes.deleteLane(d, req.params.id, target);
    return snapshot();
  });
  app.post('/api/lanes/reorder', async (req) => {
    lanes.reorderLanes(d, (req.body as { orderedIds: string[] }).orderedIds);
    return snapshot();
  });

  // ---------------------------------------------------------------- columns
  app.post<Params<'laneId'>>('/api/lanes/:laneId/columns', async (req) => {
    lanes.createColumn(d, req.params.laneId, (req.body as { name: string }).name);
    return snapshot();
  });
  app.post<Params<'laneId'>>('/api/lanes/:laneId/columns/reorder', async (req) => {
    lanes.reorderColumns(d, req.params.laneId, (req.body as { orderedIds: string[] }).orderedIds);
    return snapshot();
  });
  app.patch<Params<'id'>>('/api/columns/:id', async (req) => {
    lanes.renameColumn(d, req.params.id, (req.body as { name: string }).name);
    return snapshot();
  });
  app.delete<Params<'id'>>('/api/columns/:id', async (req) => {
    lanes.deleteColumn(d, req.params.id);
    return snapshot();
  });

  // ------------------------------------------------------------------ tasks
  app.post('/api/tasks', async (req, reply) => {
    const task = tasks.createTask(d, req.body as tasks.TaskInput);
    reply.code(201);
    return { task, board: snapshot() };
  });
  app.patch<Params<'id'>>('/api/tasks/:id', async (req) => {
    tasks.updateTask(d, req.params.id, req.body as tasks.TaskInput);
    return snapshot();
  });
  app.post<Params<'id'>>('/api/tasks/:id/move', async (req) => {
    tasks.moveTask(d, req.params.id, req.body as never);
    return snapshot();
  });
  app.post<Params<'id'>>('/api/tasks/:id/copy', async (req, reply) => {
    const task = tasks.copyTask(d, req.params.id);
    if (!task) return reply.code(404).send({ error: 'not found' });
    reply.code(201);
    return { task, board: snapshot() };
  });
  app.delete<Params<'id'>>('/api/tasks/:id', async (req) => {
    tasks.deleteTask(d, req.params.id);
    return snapshot();
  });

  // ----------------------------------------------------------------- images
  app.post<Params<'id'>>('/api/tasks/:id/images', async (req, reply) => {
    const body = req.body as { name: string; mime: string; dataBase64: string };
    const bytes = Buffer.from(body.dataBase64, 'base64');
    const image = tasks.addImage(d, req.params.id, {
      name: body.name,
      mime: body.mime,
      bytes,
    });
    reply.code(201);
    return { image, board: snapshot() };
  });
  app.get<Params<'id'>>('/api/images/:id', async (req, reply) => {
    const image = tasks.readImage(d, req.params.id);
    if (!image) return reply.code(404).send({ error: 'not found' });
    // Image bytes never change under a given id, so they cache indefinitely.
    return reply
      .header('content-type', image.mime)
      .header('cache-control', 'private, max-age=31536000, immutable')
      .send(Buffer.from(image.bytes));
  });
  app.delete<Params<'id'>>('/api/images/:id', async (req) => {
    tasks.deleteImage(d, req.params.id);
    return snapshot();
  });

  // -------------------------------------------------------------------- log
  app.post<Params<'id'>>('/api/tasks/:id/log', async (req, reply) => {
    const id = log.createLogEntry(d, req.params.id, req.body as log.LogInput);
    reply.code(201);
    return { id, board: snapshot() };
  });
  app.patch<Params<'id'>>('/api/log/:id', async (req) => {
    log.updateLogEntry(d, req.params.id, req.body as log.LogInput);
    return snapshot();
  });
  app.delete<Params<'id'>>('/api/log/:id', async (req) => {
    log.deleteLogEntry(d, req.params.id);
    return snapshot();
  });

  // ------------------------------------------------------------- objectives
  app.post('/api/objectives', async (req, reply) => {
    const objective = objectives.createObjective(d, req.body as objectives.ObjectiveInput);
    reply.code(201);
    return { objective, board: snapshot() };
  });
  app.patch<Params<'id'>>('/api/objectives/:id', async (req) => {
    objectives.updateObjective(d, req.params.id, req.body as objectives.ObjectiveInput);
    return snapshot();
  });
  app.post<Params<'id'>>('/api/objectives/:id/archive', async (req) => {
    objectives.archiveObjective(d, req.params.id);
    return snapshot();
  });
  app.post<Params<'id'>>('/api/objectives/:id/unarchive', async (req) => {
    objectives.unarchiveObjective(d, req.params.id);
    return snapshot();
  });
  app.delete<Params<'id'>>('/api/objectives/:id', async (req) => {
    objectives.deleteObjective(d, req.params.id);
    return snapshot();
  });

  // ---------------------------------------------------------------- outcomes
  app.post('/api/outcomes', async (req, reply) => {
    const outcome = outcomes.createOutcome(d, req.body as outcomes.OutcomeInput);
    reply.code(201);
    return { outcome, board: snapshot() };
  });
  app.patch<Params<'id'>>('/api/outcomes/:id', async (req) => {
    outcomes.updateOutcome(d, req.params.id, req.body as outcomes.OutcomeInput);
    return snapshot();
  });
  app.delete<Params<'id'>>('/api/outcomes/:id', async (req) => {
    outcomes.deleteOutcome(d, req.params.id);
    return snapshot();
  });

  // ------------------------------------------------------------------ labels
  app.post('/api/labels', async (req, reply) => {
    const body = req.body as { name: string; hue?: number | null };
    const label = labels.createLabel(d, body.name, body.hue);
    reply.code(201);
    return { label, board: snapshot() };
  });
  app.patch<Params<'id'>>('/api/labels/:id', async (req) => {
    labels.updateLabel(d, req.params.id, req.body as { name?: string; hue?: number | null });
    return snapshot();
  });
  app.delete<Params<'id'>>('/api/labels/:id', async (req) => {
    labels.deleteLabel(d, req.params.id);
    return snapshot();
  });

  // ---------------------------------------------------------------- settings
  app.get('/api/settings', async () => readSettings(d));
  app.patch('/api/settings', async (req) => writeSettings(d, req.body as Partial<Settings>));

  // ------------------------------------------------------------------ export
  // A local-only tracker needs a way out that is not the .db file itself.
  app.get('/api/export', async (_req, reply) =>
    reply
      .header('content-disposition', `attachment; filename="better-tracker-${stamp()}.json"`)
      .send(snapshot()),
  );

  app.setErrorHandler((err: FastifyError, _req, reply) => {
    app.log.error(err);
    reply.code(err.statusCode ?? 500).send({ error: err.message });
  });
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}
