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

describe('Pruebas de Aceptación de M5: Correcciones, Auditoría y Recálculo de Tiempos', () => {
  let testDir: string;
  let store: FileDurableStore;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    presenceManager.reset();
    realtimeBus.reset();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pitwall-m5-test-'));
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

  it('Escenario F: Invalidar una MEJOR vuelta recomputa las estadísticas derivadas y preserva la auditoría', async () => {
    // 1. Configurar evento
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo Escolar M5' })
    });

    // 2. Crear dos escuderías
    const teamARes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Escudería Rayo', color: '#ef4444' })
    });
    const teamA = (await teamARes.json()).team;

    const teamBRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Escudería Trueno', color: '#3b82f6' })
    });
    const teamB = (await teamBRes.json()).team;

    // 3. Crear y arrancar sesión
    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Clasificatoria M5',
        type: 'qualifying',
        participatingTeamIds: [teamA.id, teamB.id]
      })
    });
    const session = (await sessionRes.json()).session;

    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // 4. Inyectar vueltas controladas directamente en el almacén persistente
    // Vuelta 1 Team A: 60.000s
    // Vuelta 2 Team A: 45.000s (MEJOR VUELTA Y VUELTA RÁPIDA GLOBAL)
    // Vuelta 3 Team A: 50.000s
    // Vuelta 1 Team B: 52.000s
    const now = Date.now();
    await store.saveLap({
      id: 'lap-a1',
      sessionId: session.id,
      teamId: teamA.id,
      lapNumber: 1,
      serverTimestamp: now - 30000,
      lapTimeMs: 60000,
      isValid: true,
      recordedBy: 'test'
    });

    await store.saveLap({
      id: 'lap-a2',
      sessionId: session.id,
      teamId: teamA.id,
      lapNumber: 2,
      serverTimestamp: now - 20000,
      lapTimeMs: 45000, // MEJOR
      isValid: true,
      recordedBy: 'test'
    });

    await store.saveLap({
      id: 'lap-a3',
      sessionId: session.id,
      teamId: teamA.id,
      lapNumber: 3,
      serverTimestamp: now - 10000,
      lapTimeMs: 50000,
      isValid: true,
      recordedBy: 'test'
    });

    await store.saveLap({
      id: 'lap-b1',
      sessionId: session.id,
      teamId: teamB.id,
      lapNumber: 1,
      serverTimestamp: now - 15000,
      lapTimeMs: 52000,
      isValid: true,
      recordedBy: 'test'
    });

    // 5. Verificar proyección inicial antes de la invalidación
    const initialTimingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
    const initialTiming = (await initialTimingRes.json()).timing;

    expect(initialTiming.fastestLapMs).toBe(45000);
    expect(initialTiming.fastestLapTeamId).toBe(teamA.id);

    const leaderInitial = initialTiming.leaderboard.find((l: { teamId: string }) => l.teamId === teamA.id);
    expect(leaderInitial.lapCount).toBe(3);
    expect(leaderInitial.bestLapMs).toBe(45000);
    expect(leaderInitial.lastLapMs).toBe(50000);
    expect(leaderInitial.isFastestLap).toBe(true);

    // 6. Realizar INVALIDACIÓN de la mejor vuelta (lap-a2) por Dirección de Carrera
    const invalidateRes = await fetch(`${baseUrl}/api/sessions/${session.id}/laps/lap-a2/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Atajo no reglamentario en curva 3',
        actor: 'Director de Carrera'
      })
    });

    expect(invalidateRes.status).toBe(200);
    const invalidateData = await invalidateRes.json();
    expect(invalidateData.ok).toBe(true);
    expect(invalidateData.lap.isValid).toBe(false);
    expect(invalidateData.lap.invalidationReason).toBe('Atajo no reglamentario en curva 3');
    expect(invalidateData.lap.invalidatedBy).toBe('Director de Carrera');

    // 7. Verificar que las proyecciones se recalcularon correctamente:
    // Team A ahora tiene 2 vueltas válidas (60s y 50s).
    // Su mejor vuelta pasa a ser 50.000s.
    // La vuelta rápida global ahora le pertenece a Team A (50s) frente a Team B (52s).
    const updatedTiming = invalidateData.timing;
    expect(updatedTiming.totalLapsRecorded).toBe(3); // 2 de A + 1 de B
    expect(updatedTiming.fastestLapMs).toBe(50000);

    const leaderUpdated = updatedTiming.leaderboard.find((l: { teamId: string }) => l.teamId === teamA.id);
    expect(leaderUpdated.lapCount).toBe(2);
    expect(leaderUpdated.bestLapMs).toBe(50000);

    // 8. Verificar preservación no destructiva en el historial de vueltas
    const lapsRes = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`);
    const lapsData = await lapsRes.json();
    expect(lapsData.laps.length).toBe(4); // Todas las 4 vueltas siguen en el almacén
    const lapA2Record = lapsData.laps.find((l: { id: string }) => l.id === 'lap-a2');
    expect(lapA2Record.isValid).toBe(false);
    expect(lapA2Record.invalidationReason).toBe('Atajo no reglamentario en curva 3');

    // 9. Verificar registro de auditoría inmutable
    const auditRes = await fetch(`${baseUrl}/api/sessions/${session.id}/audit`);
    const auditData = await auditRes.json();
    const invalidationEvent = auditData.events.find((e: { type: string }) => e.type === 'LAP_INVALIDATED');
    expect(invalidationEvent).toBeDefined();
    expect(invalidationEvent.actor).toBe('Director de Carrera');
    expect(invalidationEvent.payload.reason).toBe('Atajo no reglamentario en curva 3');
    expect(invalidationEvent.payload.lapId).toBe('lap-a2');
  });

  it('Restaurar una vuelta previamente invalidada recupera sus estadísticas y emite auditoría LAP_RESTORED', async () => {
    // Configurar evento y sesión
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo Restauración M5' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Escudería Delta', color: '#10b981' })
    });
    const team = (await teamRes.json()).team;

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Carrera',
        type: 'race',
        participatingTeamIds: [team.id]
      })
    });
    const session = (await sessionRes.json()).session;
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // Guardar vuelta
    await store.saveLap({
      id: 'lap-d1',
      sessionId: session.id,
      teamId: team.id,
      lapNumber: 1,
      serverTimestamp: Date.now(),
      lapTimeMs: 44000,
      isValid: true,
      recordedBy: 'test'
    });

    // Invalidar
    await fetch(`${baseUrl}/api/sessions/${session.id}/laps/lap-d1/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Duda de comisario', actor: 'Comisario #2' })
    });

    // Restaurar
    const restoreRes = await fetch(`${baseUrl}/api/sessions/${session.id}/laps/lap-d1/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Verificación de telemetría: vuelta reglamentaria confirmada',
        actor: 'Director de Carrera'
      })
    });

    expect(restoreRes.status).toBe(200);
    const restoreData = await restoreRes.json();
    expect(restoreData.ok).toBe(true);
    expect(restoreData.lap.isValid).toBe(true);
    expect(restoreData.timing.totalLapsRecorded).toBe(1);
    expect(restoreData.timing.leaderboard[0].lapCount).toBe(1);

    // Verificar evento en auditoría
    const auditRes = await fetch(`${baseUrl}/api/sessions/${session.id}/audit`);
    const auditData = await auditRes.json();
    const restoreEvent = auditData.events.find((e: { type: string }) => e.type === 'LAP_RESTORED');
    expect(restoreEvent).toBeDefined();
    expect(restoreEvent.payload.reason).toBe('Verificación de telemetría: vuelta reglamentaria confirmada');
  });

  it('Rechaza invalidar sin motivo o con datos incompletos (400 REASON_REQUIRED)', async () => {
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo Validación M5' })
    });

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Test',
        type: 'race',
        participatingTeamIds: []
      })
    });
    const session = (await sessionRes.json()).session;

    const res = await fetch(`${baseUrl}/api/sessions/${session.id}/laps/no-lap/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: '   ' }) // Motivo vacío
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('REASON_REQUIRED');
  });

  it('Emite evento SSE timing_update en tiempo real al invalidar una vuelta', async () => {
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo SSE M5' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Escudería Alpha', color: '#6366f1' })
    });
    const team = (await teamRes.json()).team;

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga SSE Realtime',
        type: 'race',
        participatingTeamIds: [team.id]
      })
    });
    const session = (await sessionRes.json()).session;
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    await store.saveLap({
      id: 'lap-alpha',
      sessionId: session.id,
      teamId: team.id,
      lapNumber: 1,
      serverTimestamp: Date.now(),
      lapTimeMs: 48000,
      isValid: true,
      recordedBy: 'test'
    });

    let receivedTimingEvent = false;
    let receivedRevision = -1;

    const unsubscribe = realtimeBus.subscribe((eventType, event) => {
      if (eventType === 'timing_update') {
        receivedTimingEvent = true;
        receivedRevision = event.revision;
      }
    });

    try {
      const initialRev = realtimeBus.getRevision();

      await fetch(`${baseUrl}/api/sessions/${session.id}/laps/lap-alpha/invalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Sanción técnica', actor: 'Director' })
      });

      expect(receivedTimingEvent).toBe(true);
      expect(receivedRevision).toBeGreaterThan(initialRev);
    } finally {
      unsubscribe();
    }
  });
});
