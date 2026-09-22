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

describe('Pruebas de Aceptación de M2: Acceso por Token, Presencia, Multi-Dispositivo y Kick', () => {
  let testDir: string;
  let store: FileDurableStore;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    presenceManager.reset();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pitwall-m2-test-'));
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

  it('debe validar tokens únicos de escudería y rechazar tokens incorrectos (Criterio M2)', async () => {
    // 1. Crear evento y equipo
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo M2' })
    });

    const createTeamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rayo Escolar', shortName: 'RAY', color: '#ffcc00' })
    });
    const teamData = await createTeamRes.json();
    const token = teamData.team.token;
    expect(token).toBeDefined();

    // 2. Acceso con token válido
    const authRes = await fetch(`${baseUrl}/api/teams/access/${encodeURIComponent(token)}`);
    expect(authRes.status).toBe(200);
    const authBody = await authRes.json();
    expect(authBody.ok).toBe(true);
    expect(authBody.team.name).toBe('Rayo Escolar');
    expect(authBody.event.name).toBe('Trofeo M2');

    // 3. Acceso con token inválido
    const invalidRes = await fetch(`${baseUrl}/api/teams/access/token-falso-12345`);
    expect(invalidRes.status).toBe(404);
    const invalidBody = await invalidRes.json();
    expect(invalidBody.ok).toBe(false);
    expect(invalidBody.error.message).toContain('Token de escudería inválido');
  });

  it('debe permitir regenerar el token revocando el anterior (Criterio M2)', async () => {
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'GP Token' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Centella', color: '#00ff00' })
    });
    const team = (await teamRes.json()).team;
    const oldToken = team.token;

    // Regenerar token
    const regenRes = await fetch(`${baseUrl}/api/teams/${team.id}/regenerate-token`, {
      method: 'POST'
    });
    expect(regenRes.status).toBe(200);
    const regenBody = await regenRes.json();
    const newToken = regenBody.team.token;
    expect(newToken).not.toBe(oldToken);

    // El token anterior ahora debe fallar
    const checkOld = await fetch(`${baseUrl}/api/teams/access/${encodeURIComponent(oldToken)}`);
    expect(checkOld.status).toBe(404);

    // El nuevo token debe autorizar
    const checkNew = await fetch(`${baseUrl}/api/teams/access/${encodeURIComponent(newToken)}`);
    expect(checkNew.status).toBe(200);
    expect((await checkNew.json()).team.name).toBe('Centella');
  });

  it('debe soportar múltiples dispositivos/pestañas simultáneos por escudería y rastrear presencia (Criterio M2)', async () => {
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'GP Presencia' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Halcones' })
    });
    const team = (await teamRes.json()).team;

    // Dispositivo 1 de Halcones (Cronometrador en móvil)
    await fetch(`${baseUrl}/api/presence/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'dev-halcones-1',
        role: 'team-operator',
        teamId: team.id,
        teamName: team.name,
        deviceInfo: 'Móvil (iOS)'
      })
    });

    // Dispositivo 2 de Halcones (Estratega en tableta)
    await fetch(`${baseUrl}/api/presence/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'dev-halcones-2',
        role: 'team-operator',
        teamId: team.id,
        teamName: team.name,
        deviceInfo: 'Tablet (Android)'
      })
    });

    // Dispositivo de Pantalla 16:9
    await fetch(`${baseUrl}/api/presence/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'dev-display-main',
        role: 'display',
        deviceInfo: 'Proyector (Linux)'
      })
    });

    // Consultar presencia desde Race Control
    const presenceRes = await fetch(`${baseUrl}/api/presence`);
    expect(presenceRes.status).toBe(200);
    const presenceData = await presenceRes.json();
    const overview = presenceData.overview;

    expect(overview.totalConnected).toBe(3);
    expect(overview.teamsConnectivity[team.id].connectedCount).toBe(2);
    expect(overview.teamsConnectivity[team.id].isOnline).toBe(true);
    expect(overview.teamsConnectivity[team.id].devices).toContain('Móvil (iOS)');
    expect(overview.teamsConnectivity[team.id].devices).toContain('Tablet (Android)');
  });

  it('debe permitir expulsar (kick) un dispositivo específico sin afectar a otros dispositivos del equipo (Criterio M2)', async () => {
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'GP Kick' })
    });

    const teamRes = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Flecha Azul' })
    });
    const team = (await teamRes.json()).team;

    // Conectar dos dispositivos
    await fetch(`${baseUrl}/api/presence/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'dev-legit',
        role: 'team-operator',
        teamId: team.id,
        teamName: team.name,
        deviceInfo: 'Tablet Oficial'
      })
    });

    await fetch(`${baseUrl}/api/presence/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'dev-unwanted',
        role: 'team-operator',
        teamId: team.id,
        teamName: team.name,
        deviceInfo: 'Dispositivo No Autorizado'
      })
    });

    // Race Control expulsa 'dev-unwanted'
    const kickRes = await fetch(`${baseUrl}/api/presence/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'dev-unwanted' })
    });
    expect(kickRes.status).toBe(200);
    expect((await kickRes.json()).ok).toBe(true);

    // El dispositivo no autorizado intenta hacer heartbeat y recibe 403 kicked: true
    const heartbeatUnwanted = await fetch(`${baseUrl}/api/presence/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'dev-unwanted',
        role: 'team-operator',
        teamId: team.id
      })
    });
    expect(heartbeatUnwanted.status).toBe(403);
    const kickedData = await heartbeatUnwanted.json();
    expect(kickedData.kicked).toBe(true);
    expect(kickedData.message).toContain('Dirección de Carrera');

    // El dispositivo legítimo sigue conectado y responde 200 OK
    const heartbeatLegit = await fetch(`${baseUrl}/api/presence/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'dev-legit',
        role: 'team-operator',
        teamId: team.id
      })
    });
    expect(heartbeatLegit.status).toBe(200);
    expect((await heartbeatLegit.json()).ok).toBe(true);
  });
});
