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

describe('Pruebas de Verificación: Registro de Pilotos, Adelantamientos / Posiciones y Limpieza', () => {
  let testDir: string;
  let store: FileDurableStore;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    presenceManager.reset();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pitwall-verification-test-'));
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

  it('1. Debe permitir registrar pilotos (nombres) al crear o actualizar una escudería y persistirlos', async () => {
    // Crear evento
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo Escolar 2026' })
    });

    // Registrar equipo con lista de pilotos previa a la sesión
    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Escudería Halcones',
        color: '#ff0000',
        kartName: 'Kart 01',
        pilots: ['Lucas M.', 'Sofía R.', 'Mateo V.']
      })
    });

    expect(teamRes.status).toBe(201);
    const teamData = await teamRes.json();
    expect(teamData.ok).toBe(true);
    expect(teamData.team.pilots).toEqual(['Lucas M.', 'Sofía R.', 'Mateo V.']);

    // Actualizar pilotos mediante endpoint específico PUT /api/teams/:id/pilots
    const updatePilotsRes = await fetch(`${baseUrl}/api/teams/${teamData.team.id}/pilots`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pilots: ['Lucas M.', 'Sofía R.', 'Mateo V.', 'Valentina C.']
      })
    });

    expect(updatePilotsRes.status).toBe(200);
    const updatedData = await updatePilotsRes.json();
    expect(updatedData.team.pilots).toContain('Valentina C.');
    expect(updatedData.team.pilots.length).toBe(4);

    // Verificar persistencia duradera en disco tras reinicializar el store
    const newStore = new FileDurableStore(testDir);
    await newStore.init();
    const persistedTeams = await newStore.getTeams(teamData.team.eventId);
    const persistedTeam = persistedTeams.find((t) => t.id === teamData.team.id);
    expect(persistedTeam?.pilots).toEqual(['Lucas M.', 'Sofía R.', 'Mateo V.', 'Valentina C.']);
  });

  it('2. Debe verificar el comportamiento de posiciones y adelantamientos (surpassing) en la carrera', async () => {
    // Crear evento
    const evRes = await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Carrera Adelantamientos' })
    });
    await evRes.json();

    // Crear dos equipos: Team A y Team B
    const teamARes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team Alpha', color: '#ff0000' })
    });
    const { team: teamA } = await teamARes.json();

    const teamBRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Team Beta', color: '#0000ff' })
    });
    const { team: teamB } = await teamBRes.json();

    // Crear y arrancar manga tipo carrera
    const sessRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Carrera',
        type: 'race',
        participatingTeamIds: [teamA.id, teamB.id]
      })
    });
    const { session } = await sessRes.json();
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // Vuelta 1: Team A cruza primero la meta
    await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teamA.token}`
      },
      body: JSON.stringify({ teamId: teamA.id })
    });

    let timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
    let timingData = await timingRes.json();
    let board = timingData.timing.leaderboard;
    expect(board[0].teamId).toBe(teamA.id);
    expect(board[0].position).toBe(1);
    expect(board[1].teamId).toBe(teamB.id);
    expect(board[1].position).toBe(2);

    // Esperar un instante y Team B completa la Vuelta 1
    await new Promise((r) => setTimeout(r, 50));
    await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teamB.token}`
      },
      body: JSON.stringify({ teamId: teamB.id })
    });

    timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
    timingData = await timingRes.json();
    board = timingData.timing.leaderboard;
    // Team A sigue P1 porque completó la Vuelta 1 antes que Team B
    expect(board[0].teamId).toBe(teamA.id);
    expect(board[0].position).toBe(1);
    expect(board[1].teamId).toBe(teamB.id);
    expect(board[1].position).toBe(2);
    expect(board[1].gapMs).toBeGreaterThan(0);

    // Vuelta 2: ADELANTAMIENTO (SURPASSING)
    // Team B rebasa a Team A en pista y completa la Vuelta 2 ANTES que Team A!
    await new Promise((r) => setTimeout(r, 3600)); // Superar umbral anti-doble pulsación (3.5s)
    await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teamB.token}`
      },
      body: JSON.stringify({ teamId: teamB.id })
    });

    timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
    timingData = await timingRes.json();
    board = timingData.timing.leaderboard;

    // Team B ahora tiene 2 vueltas frente a 1 vuelta de Team A -> Team B es P1!
    expect(board[0].teamId).toBe(teamB.id);
    expect(board[0].position).toBe(1);
    expect(board[0].lapCount).toBe(2);
    expect(board[1].teamId).toBe(teamA.id);
    expect(board[1].position).toBe(2);
    expect(board[1].lapCount).toBe(1);
    expect(board[1].lapsBehind).toBe(1);

    // Team A completa después la Vuelta 2
    await new Promise((r) => setTimeout(r, 50));
    await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teamA.token}`
      },
      body: JSON.stringify({ teamId: teamA.id })
    });

    timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
    timingData = await timingRes.json();
    board = timingData.timing.leaderboard;

    // Ambos tienen 2 vueltas, pero Team B cruzó antes la Vuelta 2, por lo que Team B conserva P1
    expect(board[0].teamId).toBe(teamB.id);
    expect(board[0].position).toBe(1);
    expect(board[1].teamId).toBe(teamA.id);
    expect(board[1].position).toBe(2);
    expect(board[1].gapMs).toBeGreaterThan(0);
  });

  it('3. Debe eliminar el evento y reiniciar la plataforma a limpio mediante DELETE /api/event', async () => {
    // 1. Crear evento y datos
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Evento a Eliminar' })
    });

    await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Equipo Temporal' })
    });

    // Verificar que existe
    let evRes = await fetch(`${baseUrl}/api/event`);
    let evData = await evRes.json();
    expect(evData.configured).toBe(true);
    expect(evData.teams.length).toBe(1);

    // 2. Ejecutar DELETE /api/event
    const deleteRes = await fetch(`${baseUrl}/api/event`, {
      method: 'DELETE'
    });
    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(deleteData.ok).toBe(true);

    // 3. Verificar estado completamente limpio (sin residuos de prueba)
    evRes = await fetch(`${baseUrl}/api/event`);
    evData = await evRes.json();
    expect(evData.configured).toBe(false);
    expect(evData.event).toBeNull();
    expect(evData.teams).toEqual([]);
    expect(evData.sessions).toEqual([]);
  });

  it('4. Debe detectar sesiones RUNNING abandonadas (>6 horas) y cerrarlas automáticamente', async () => {
    // Crear evento y sesión
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Evento Abandonado' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Equipo Solitario' })
    });
    const { team } = await teamRes.json();

    const sessRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga de Prueba Abandonada',
        type: 'race',
        participatingTeamIds: [team.id]
      })
    });
    const { session } = await sessRes.json();

    // Iniciar sesión y simular que empezó hace 8 horas
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // Modificar timestamp en storage directamente simulando 8 horas de inactividad
    const eightHoursAgo = Date.now() - (8 * 3600 * 1000);
    const rawSessions = await store.getSessions(session.eventId);
    const targetSession = rawSessions.find((s) => s.id === session.id)!;
    targetSession.startedAt = eightHoursAgo;
    targetSession.updatedAt = new Date(eightHoursAgo).toISOString();
    await store.saveSession(targetSession);

    // Al consultar GET /api/event sin dispositivos conectados, el backend debe cerrar la sesión abandonada automáticamente
    const checkRes = await fetch(`${baseUrl}/api/event`);
    const checkData = await checkRes.json();
    const checkedSession = checkData.sessions.find((s: { id: string }) => s.id === session.id);
    expect(checkedSession.status).toBe('TIMING_CLOSED');
  });

  it('5. No debe cerrar sesiones si existen dispositivos con latidos (heartbeats) activos', async () => {
    // Crear evento y sesión
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Evento Activo Con Heartbeats' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Equipo Operando' })
    });
    const { team } = await teamRes.json();

    const sessRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Manga Larga de Resistencia',
        type: 'race',
        participatingTeamIds: [team.id]
      })
    });
    const { session } = await sessRes.json();
    await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

    // Simular que empezó hace 8 horas
    const eightHoursAgo = Date.now() - (8 * 3600 * 1000);
    const rawSessions = await store.getSessions(session.eventId);
    const targetSession = rawSessions.find((s) => s.id === session.id)!;
    targetSession.startedAt = eightHoursAgo;
    targetSession.updatedAt = new Date(eightHoursAgo).toISOString();
    await store.saveSession(targetSession);

    // REGISTRAR UN LATIDO (HEARTBEAT) ACTIVO de un operador de Pit Wall
    presenceManager.registerHeartbeat(
      'operator-session-active-1',
      'team-operator',
      'iPad Pro Box 1',
      '127.0.0.1',
      team.id,
      team.name
    );

    expect(presenceManager.getActiveOnlineCount()).toBeGreaterThan(0);

    // Al consultar GET /api/event, la sesión DEBE PERMANECER EN 'RUNNING' gracias al latido activo
    const checkRes = await fetch(`${baseUrl}/api/event`);
    const checkData = await checkRes.json();
    const checkedSession = checkData.sessions.find((s: { id: string }) => s.id === session.id);
    expect(checkedSession.status).toBe('RUNNING');
    expect(checkData.isStale).toBe(false);
  });
});
