import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { apiRouter } from '../server/routes/api';
import { setPersistenceStore } from '../server/storage';
import { FileDurableStore } from '../server/storage/fileStore';

describe('Pruebas de API de M1: Eventos, Escuderías sin límite estricto y Rondas', () => {
  let testDir: string;
  let store: FileDurableStore;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pitwall-m1-test-'));
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('debe devolver configured: false inicialmente cuando no existe evento creado', async () => {
    const res = await fetch(`${baseUrl}/api/event`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.configured).toBe(false);
    expect(body.event).toBeNull();
  });

  it('debe crear un evento escolar correctamente y responder en español', async () => {
    const res = await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Gran Premio Escolar 2026',
        edition: '1ª Edición',
        configuredBy: 'Prof. Martínez'
      })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toContain('Evento');
    expect(body.event.name).toBe('Gran Premio Escolar 2026');
    expect(body.event.edition).toBe('1ª Edición');
    expect(body.event.configuredBy).toBe('Prof. Martínez');

    // Comprobar que persiste vía GET
    const checkRes = await fetch(`${baseUrl}/api/event`);
    const checkBody = await checkRes.json();
    expect(checkBody.configured).toBe(true);
    expect(checkBody.event.name).toBe('Gran Premio Escolar 2026');
  });

  it('debe permitir crear más de 4 escuderías sin límite arbitrario (Criterio de Aceptación M1)', async () => {
    // 1. Crear evento
    await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trofeo Abierto' })
    });

    // 2. Registrar 7 escuderías (> 4)
    const teamNames = [
      'Rayo Escolar',
      'Flecha Verde',
      'Tornado Azul',
      'Halcones Rojos',
      'Centellas Amarillas',
      'Karts del Norte',
      'Titanes del Asfalto'
    ];

    for (let i = 0; i < teamNames.length; i++) {
      const res = await fetch(`${baseUrl}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamNames[i],
          shortName: `T${i + 1}`,
          color: '#ff0000',
          number: i + 1,
          kartName: `Kart-${i + 1}`
        })
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.team.token).toBeDefined();
    }

    // 3. Comprobar que todas las 7 escuderías están persistidas
    const listRes = await fetch(`${baseUrl}/api/teams`);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.teams.length).toBe(7);

    // 4. Simular recarga persistente en frío
    const freshStore = new FileDurableStore(testDir);
    await freshStore.init();
    const event = await freshStore.getEvent();
    const reloadedTeams = await freshStore.getTeams(event!.id);
    expect(reloadedTeams.length).toBe(7);
  });

  it('debe crear múltiples sesiones con vueltas configurables y escuderías seleccionadas (Criterio M1)', async () => {
    // 1. Crear evento
    const eventRes = await fetch(`${baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Jornada Karting' })
    });
    const eventBody = await eventRes.json();
    const eventId = eventBody.event.id;

    // 2. Crear 3 escuderías
    const t1Res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Equipo 1' })
    });
    const t1 = await t1Res.json();

    const t2Res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Equipo 2' })
    });
    const t2 = await t2Res.json();

    const t3Res = await fetch(`${baseUrl}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Equipo 3' })
    });
    const t3 = await t3Res.json();

    // 3. Crear Sesión Clasificatoria (2 vueltas objetivo, compiten t1 y t2)
    const qRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Clasificación 1',
        type: 'qualifying',
        targetLaps: 2,
        participatingTeamIds: [t1.team.id, t2.team.id]
      })
    });

    expect(qRes.status).toBe(201);
    const qBody = await qRes.json();
    expect(qBody.session.targetLaps).toBe(2);
    expect(qBody.session.participatingTeamIds.length).toBe(2);

    // 4. Crear Gran Carrera Final (25 vueltas objetivo, compiten todos)
    const raceRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Carrera Principal',
        type: 'race',
        targetLaps: 25,
        participatingTeamIds: [t1.team.id, t2.team.id, t3.team.id]
      })
    });

    expect(raceRes.status).toBe(201);
    const raceBody = await raceRes.json();
    expect(raceBody.session.targetLaps).toBe(25);
    expect(raceBody.session.participatingTeamIds.length).toBe(3);

    // 5. Verificar recuperación completa en frío tras recarga sin pérdida de datos
    const freshStore = new FileDurableStore(testDir);
    await freshStore.init();
    const loadedSessions = await freshStore.getSessions(eventId);
    expect(loadedSessions.length).toBe(2);
    expect(loadedSessions[0].targetLaps).toBe(2);
    expect(loadedSessions[1].targetLaps).toBe(25);
  });
});
