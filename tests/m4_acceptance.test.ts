import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { apiRouter } from '../server/routes/api';
import { setPersistenceStore } from '../server/storage';
import { FileDurableStore } from '../server/storage/fileStore';
import { presenceManager } from '../server/presence';
import { realtimeBus } from '../server/realtime';

describe('Pruebas de Aceptación de M4: Proyecciones en Tiempo Real y Consistencia', () => {
  let testDir: string;
  let store: FileDurableStore;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    presenceManager.reset();
    realtimeBus.reset();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pitwall-m4-test-'));
    store = new FileDurableStore(testDir);
    await store.init();
    setPersistenceStore(store);

    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    presenceManager.reset();
    realtimeBus.reset();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('el endpoint SSE (/api/timing/stream) establece conexión y envía evento inicial con revision', async () => {
    // Crear evento y sesión
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo M4 SSE' })
    });

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga SSE',
        type: 'race',
        participatingTeamIds: []
      })
    });
    const { session } = await sessionRes.json();

    // Conectar vía HTTP GET para SSE
    const req = http.get(`${baseUrl}/api/timing/stream?sessionId=${session.id}`);

    const receivedChunks: string[] = await new Promise((resolve, reject) => {
      const chunks: string[] = [];
      req.on('response', (res) => {
        expect(res.headers['content-type']).toContain('text/event-stream');
        expect(res.headers['cache-control']).toContain('no-cache');

        res.on('data', (chunk) => {
          chunks.push(chunk.toString());
          if (chunks.join('').includes('event: connected')) {
            req.destroy();
            resolve(chunks);
          }
        });
      });
      req.on('error', (err) => {
        if (req.destroyed) return;
        reject(err);
      });
    });

    const fullOutput = receivedChunks.join('');
    expect(fullOutput).toContain('event: connected');
    expect(fullOutput).toContain('revision');
  });

  it('incrementa monotonicamente la revision y emite timing_update al registrar vueltas', async () => {
    // 1. Preparar evento, equipos y sesión
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gran Premio M4' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ferrari Jr', color: '#ff0000' })
    });
    const { team } = await teamRes.json();

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Monotonicidad',
        type: 'race',
        participatingTeamIds: [team.id]
      })
    });
    const { session } = await sessionRes.json();

    // Iniciar sesión
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // Capturar eventos del bus en tiempo real
    const eventsReceived: { event: string; revision: number; sessionId: string }[] = [];
    const unsubscribe = realtimeBus.subscribe((event, data) => {
      eventsReceived.push({
        event,
        revision: data.revision || 0,
        sessionId: data.sessionId || ''
      });
    });

    // Registrar vuelta 1
    const lap1Res = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${team.token}`
      },
      body: JSON.stringify({ teamId: team.id })
    });
    expect(lap1Res.status).toBe(201);

    // Esperar 3.6s para superar threshold anti-doble pulsación y registrar vuelta 2
    await new Promise((r) => setTimeout(r, 3600));

    const lap2Res = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${team.token}`
      },
      body: JSON.stringify({ teamId: team.id })
    });
    expect(lap2Res.status).toBe(201);

    unsubscribe();

    // Verificar que se emitieron eventos de timing_update con revisiones crecientes
    const timingUpdates = eventsReceived.filter((e) => e.event === 'timing_update');
    expect(timingUpdates.length).toBeGreaterThanOrEqual(2);
    expect(timingUpdates[1].revision).toBeGreaterThan(timingUpdates[0].revision);

    // Verificar que la consulta autoritativa devuelve la última revisión
    const timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
    const timingData = await timingRes.json();
    expect(timingData.ok).toBe(true);
    expect(timingData.timing.revision).toBeGreaterThanOrEqual(timingUpdates[1].revision);
    expect(timingData.timing.totalLapsRecorded).toBe(2);
  }, 10000);

  it('un cliente reconectado obtiene el estado actual autoritativo sin pérdidas ni inconsistencias', async () => {
    // 1. Preparar carrera con 2 equipos
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo Resincronización' })
    });

    const t1Res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alpha', color: '#00ff00' })
    });
    const { team: team1 } = await t1Res.json();

    const t2Res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Beta', color: '#0000ff' })
    });
    const { team: team2 } = await t2Res.json();

    const sRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Reconexión',
        type: 'race',
        participatingTeamIds: [team1.id, team2.id]
      })
    });
    const { session } = await sRes.json();
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // Cliente lee estado inicial
    const initRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
    const initTiming = (await initRes.json()).timing;
    const initialRevision = initTiming.revision;

    // Se produce actividad en pista mientras el cliente está "desconectado"
    await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${team1.token}` },
      body: JSON.stringify({ teamId: team1.id })
    });

    await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${team2.token}` },
      body: JSON.stringify({ teamId: team2.id })
    });

    // Cliente "se reconecta" y consulta el estado autoritativo
    const reconnectRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
    const reconnectedTiming = (await reconnectRes.json()).timing;

    // Debe obtener la versión actualizada más reciente
    expect(reconnectedTiming.revision).toBeGreaterThan(initialRevision);
    expect(reconnectedTiming.totalLapsRecorded).toBe(2);
    expect(reconnectedTiming.leaderboard.length).toBe(2);
    expect(reconnectedTiming.leaderboard.every((l: { lapCount: number }) => l.lapCount === 1)).toBe(true);
  });

  it('todos los clientes observan proyecciones y gaps idénticos', async () => {
    // Comprobar que computeTimingOverview genera proyecciones con orden matemático unívoco
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Carrera Proyecciones' })
    });

    const t1 = (await (await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Equipo 1', color: '#ff0000' })
    })).json()).team;

    const t2 = (await (await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Equipo 2', color: '#00ff00' })
    })).json()).team;

    const session = (await (await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Consistencia',
        type: 'race',
        participatingTeamIds: [t1.id, t2.id]
      })
    })).json()).session;

    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // Vuelta para Equipo 1
    await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t1.token}` },
      body: JSON.stringify({ teamId: t1.id })
    });

    // Consultar desde 3 clientes simulados en paralelo
    const [c1, c2, c3] = await Promise.all([
      fetch(`${baseUrl}/api/sessions/${session.id}/timing`).then((r) => r.json()),
      fetch(`${baseUrl}/api/sessions/${session.id}/timing`).then((r) => r.json()),
      fetch(`${baseUrl}/api/sessions/${session.id}/timing`).then((r) => r.json())
    ]);

    expect(c1.timing.revision).toBe(c2.timing.revision);
    expect(c2.timing.revision).toBe(c3.timing.revision);
    expect(c1.timing.leaderboard[0].teamId).toBe(t1.id);
    expect(c2.timing.leaderboard[0].teamId).toBe(t1.id);
    expect(c3.timing.leaderboard[0].teamId).toBe(t1.id);
  });
});
