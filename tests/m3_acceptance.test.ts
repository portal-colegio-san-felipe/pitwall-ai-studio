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

describe('Pruebas de Aceptación de M3: Motor de Cronometraje Autoritativo', () => {
  let testDir: string;
  let store: FileDurableStore;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    presenceManager.reset();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pitwall-m3-test-'));
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('debe iniciar la sesión con sello de tiempo del servidor autoritativo', async () => {
    // 1. Crear evento
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo M3' })
    });

    // 2. Crear equipo y sesión
    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alpha Kart', color: '#ff0000' })
    });
    const { team } = await teamRes.json();

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga 1',
        type: 'race',
        targetLaps: 10,
        participatingTeamIds: [team.id]
      })
    });
    const { session } = await sessionRes.json();
    expect(session.status).toBe('SCHEDULED');

    // 3. Iniciar sesión autoritativa
    const startRes = await fetch(`${baseUrl}/api/sessions/${session.id}/start`, {
      method: 'POST'
    });
    const startData = await startRes.json();
    expect(startData.ok).toBe(true);
    expect(startData.session.status).toBe('RUNNING');
    expect(startData.session.startedAt).toBeGreaterThan(0);
  });

  it('debe registrar intenciones de vuelta con estampas temporales generadas por el servidor', async () => {
    // 1. Setup evento, equipo y sesión
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo M3' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Beta Kart', color: '#00ff00' })
    });
    const { team } = await teamRes.json();

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Clasificatoria',
        type: 'qualifying',
        participatingTeamIds: [team.id]
      })
    });
    const { session } = await sessionRes.json();

    // Iniciar sesión
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // 2. Registrar primera vuelta
    const lapRes = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${team.token}`
      },
      body: JSON.stringify({
        teamId: team.id
      })
    });

    expect(lapRes.status).toBe(201);
    const lapData = await lapRes.json();
    expect(lapData.ok).toBe(true);
    expect(lapData.lap.lapNumber).toBe(1);
    expect(lapData.lap.serverTimestamp).toBeGreaterThan(0);
    expect(lapData.lap.lapTimeMs).toBeGreaterThan(0);
    expect(lapData.stats.lapCount).toBe(1);
  });

  it('debe proteger contra pulsaciones dobles accidentales (Escenario D: Double Tap)', async () => {
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo M3' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Delta Kart', color: '#0000ff' })
    });
    const { team } = await teamRes.json();

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Final',
        type: 'race',
        participatingTeamIds: [team.id]
      })
    });
    const { session } = await sessionRes.json();
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // Primera pulsación válida
    const lap1Res = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${team.token}`
      },
      body: JSON.stringify({ teamId: team.id })
    });
    expect(lap1Res.status).toBe(201);

    // Segunda pulsación casi simultánea (doble pulsación inmediata)
    const lap2Res = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${team.token}`
      },
      body: JSON.stringify({ teamId: team.id })
    });

    expect(lap2Res.status).toBe(429);
    const lap2Data = await lap2Res.json();
    expect(lap2Data.ok).toBe(false);
    expect(lap2Data.error.code).toBe('DUPLICATE_LAP_INTENT');
    expect(lap2Data.error.message).toContain('anti-doble pulsación');

    // Verificar que solo 1 vuelta quedó registrada
    const timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
    const timingData = await timingRes.json();
    const teamStats = timingData.timing.leaderboard.find((l: { teamId: string }) => l.teamId === team.id);
    expect(teamStats.lapCount).toBe(1);
  });

  it('debe hacer cumplir el límite de permisos por token (Escenario C: Permission Boundary)', async () => {
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo M3' })
    });

    const teamARes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team A', color: '#ff0000' })
    });
    const { team: teamA } = await teamARes.json();

    const teamBRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team B', color: '#0000ff' })
    });
    const { team: teamB } = await teamBRes.json();

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Dual',
        type: 'race',
        participatingTeamIds: [teamA.id, teamB.id]
      })
    });
    const { session } = await sessionRes.json();
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // Intento malicioso: Team A intenta registrar una vuelta para Team B usando su propio token de Team A
    const maliciousRes = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teamA.token}`
      },
      body: JSON.stringify({ teamId: teamB.id })
    });

    expect(maliciousRes.status).toBe(403);
    const maliciousData = await maliciousRes.json();
    expect(maliciousData.ok).toBe(false);
    expect(maliciousData.error.code).toBe('FORBIDDEN_TEAM_ACTION');

    // Verificar que Team B no tiene ninguna vuelta registrada
    const timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
    const timingData = await timingRes.json();
    const teamBStats = timingData.timing.leaderboard.find((l: { teamId: string }) => l.teamId === teamB.id);
    expect(teamBStats.lapCount).toBe(0);
  });

  it('debe rechazar registro de vueltas si la manga está SCHEDULED o TIMING_CLOSED', async () => {
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo M3' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Karting Club', color: '#ff00ff' })
    });
    const { team } = await teamRes.json();

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga No Iniciada',
        type: 'race',
        participatingTeamIds: [team.id]
      })
    });
    const { session } = await sessionRes.json();

    // 1. Intento cuando está en SCHEDULED
    const earlyLapRes = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${team.token}`
      },
      body: JSON.stringify({ teamId: team.id })
    });
    expect(earlyLapRes.status).toBe(400);

    // 2. Iniciar y luego cerrar cronometraje
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });
    await fetch(`${baseUrl}/api/sessions/${session.id}/close`, { method: 'POST' });

    // 3. Intento cuando está en TIMING_CLOSED
    const lateLapRes = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${team.token}`
      },
      body: JSON.stringify({ teamId: team.id })
    });
    expect(lateLapRes.status).toBe(400);
    const lateData = await lateLapRes.json();
    expect(lateData.error.code).toBe('SESSION_NOT_RUNNING');
  });

  it('debe persistir el historial de vueltas y sobrevivir recargas', async () => {
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo Persistencia' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Kart Persistente', color: '#123456' })
    });
    const { team } = await teamRes.json();

    const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Duradera',
        type: 'race',
        participatingTeamIds: [team.id]
      })
    });
    const { session } = await sessionRes.json();
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // Registrar vuelta
    await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${team.token}`
      },
      body: JSON.stringify({ teamId: team.id })
    });

    // Crear nueva instancia de FileDurableStore apuntando al mismo disco
    const freshStore = new FileDurableStore(testDir);
    await freshStore.init();
    const lapsOnDisk = await freshStore.getLaps(session.id);

    expect(lapsOnDisk.length).toBe(1);
    expect(lapsOnDisk[0].teamId).toBe(team.id);
    expect(lapsOnDisk[0].lapNumber).toBe(1);
  });
});
