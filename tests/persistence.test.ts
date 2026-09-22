import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileDurableStore } from '../server/storage/fileStore';
import { EventData, TeamData, SessionData } from '../server/storage/types';

describe('Pruebas de Persistencia Duradera (M0)', () => {
  let testDir: string;
  let store: FileDurableStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pitwall-test-'));
    store = new FileDurableStore(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('debe inicializarse limpiamente y ser alcanzable sin datos de prueba en producción', async () => {
    await store.init();
    const health = await store.checkHealth();

    expect(health.ok).toBe(true);
    expect(health.reachable).toBe(true);
    expect(health.type).toBe('file-durable');
    // Regla crítica de M0: Cero datos semilla/ficticios en producción
    expect(health.hasProductionSeedData).toBe(false);

    const initialEvent = await store.getEvent();
    expect(initialEvent).toBeNull();
  });

  it('debe persistir un evento y recuperarlo tras recarga de almacenamiento', async () => {
    const newEvent: EventData = {
      id: 'event-colegio-2026',
      name: 'Gran Premio Escolar San Felipe 2026',
      edition: '1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await store.saveEvent(newEvent);

    // Simular reinicio del servidor creando una nueva instancia sobre el mismo directorio
    const freshStore = new FileDurableStore(testDir);
    await freshStore.init();

    const loadedEvent = await freshStore.getEvent();
    expect(loadedEvent).not.toBeNull();
    expect(loadedEvent?.id).toBe('event-colegio-2026');
    expect(loadedEvent?.name).toBe('Gran Premio Escolar San Felipe 2026');
  });

  it('debe permitir almacenar más de cuatro escuderías sin límite estricto (M0 / Invariante A)', async () => {
    await store.init();

    const teams: TeamData[] = Array.from({ length: 6 }, (_, i) => ({
      id: `team-${i + 1}`,
      eventId: 'event-1',
      name: `Escudería de Prueba ${i + 1}`,
      color: '#00ffff',
      token: `token-${i + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    for (const team of teams) {
      await store.saveTeam(team);
    }

    const loadedTeams = await store.getTeams('event-1');
    expect(loadedTeams.length).toBe(6);
  });

  it('debe persistir sesiones con vueltas objetivo configurables y no fijadas en 30', async () => {
    await store.init();

    const session: SessionData = {
      id: 'session-1',
      eventId: 'event-1',
      name: 'Ronda Clasificatoria 1',
      type: 'qualifying',
      targetLaps: 2, // 2 vueltas para clasificación
      participatingTeamIds: ['team-1', 'team-2'],
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await store.saveSession(session);

    const loaded = await store.getSessions('event-1');
    expect(loaded.length).toBe(1);
    expect(loaded[0].targetLaps).toBe(2);
  });
});
