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
import {
  computeTeamStrategy,
  DEFAULT_EQUIPMENT,
  DEFAULT_PERSONNEL
} from '../server/strategy';
import { LapRecord, RaceEventData } from '../server/storage/types';

describe('Pruebas de Aceptación de M6: Medición Neutral de Estrategia (Escenario G)', () => {
  let testDir: string;
  let store: FileDurableStore;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    presenceManager.reset();
    realtimeBus.reset();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pitwall-m6-test-'));
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

  describe('Motor de Cálculo Determinista de Estrategia (Pure Logic)', () => {
    it('calcula estado inicial neutral por defecto cuando no hay eventos de estrategia', () => {
      const laps: LapRecord[] = [
        {
          id: 'lap-1',
          sessionId: 's-1',
          teamId: 'team-1',
          lapNumber: 1,
          lapTimeMs: 45000,
          serverTimestamp: 1000,
          isValid: true,
          clientIntentId: 'c1',
          recordedBy: 'test'
        },
        {
          id: 'lap-2',
          sessionId: 's-1',
          teamId: 'team-1',
          lapNumber: 2,
          lapTimeMs: 44000,
          serverTimestamp: 2000,
          isValid: true,
          clientIntentId: 'c2',
          recordedBy: 'test'
        }
      ];

      const strategy = computeTeamStrategy('team-1', laps, []);

      expect(strategy.pitState).toBe('ON_TRACK');
      expect(strategy.pitStopCount).toBe(0);
      expect(strategy.currentEquipment).toBe(DEFAULT_EQUIPMENT);
      expect(strategy.equipmentStintLaps).toBe(2);
      expect(strategy.equipmentTotals[DEFAULT_EQUIPMENT]).toBe(2);
      expect(strategy.currentPersonnel).toBe(DEFAULT_PERSONNEL);
      expect(strategy.personnelStintLaps).toBe(2);
      expect(strategy.personnelTotals[DEFAULT_PERSONNEL]).toBe(2);
    });

    it('gestiona paradas en boxes (PIT_IN / PIT_OUT) calculando tiempos sin inferir infracción', () => {
      const now = 10000;
      const events: RaceEventData[] = [
        {
          id: 'ev-pit-1',
          sessionId: 's-1',
          teamId: 'team-1',
          type: 'PIT_IN',
          serverTimestamp: now,
          actor: 'team',
          payload: { lapNumber: 5 }
        },
        {
          id: 'ev-pit-2',
          sessionId: 's-1',
          teamId: 'team-1',
          type: 'PIT_OUT',
          serverTimestamp: now + 25000,
          actor: 'team',
          payload: { lapNumber: 5, durationMs: 25000 }
        }
      ];

      const strategy = computeTeamStrategy('team-1', [], events);

      expect(strategy.pitState).toBe('ON_TRACK');
      expect(strategy.pitStopCount).toBe(1);
      expect(strategy.lastPitDurationMs).toBe(25000);
      expect(strategy.pitStops).toHaveLength(1);
      expect(strategy.pitStops[0].durationMs).toBe(25000);
      expect(strategy.pitStops[0].lapNumber).toBe(5);
    });

    it('Escenario G: registra cambio de calzado y personal, calculando stint y totales de forma neutral', () => {
      // Creamos 5 vueltas con HARD y Piloto 1
      const laps: LapRecord[] = [];
      for (let i = 1; i <= 8; i++) {
        laps.push({
          id: `lap-${i}`,
          sessionId: 's-1',
          teamId: 'team-1',
          lapNumber: i,
          lapTimeMs: 40000,
          serverTimestamp: 1000 * i,
          isValid: true,
          clientIntentId: `c-${i}`,
          recordedBy: 'test'
        });
      }

      // En la vuelta 5 se cambia a SOFT y en la vuelta 6 se cambia a "Lucía"
      const events: RaceEventData[] = [
        {
          id: 'ev-eq-1',
          sessionId: 's-1',
          teamId: 'team-1',
          type: 'EQUIPMENT_CHANGED',
          serverTimestamp: 5500,
          actor: 'team',
          payload: { newEquipment: 'SOFT', previousEquipment: 'HARD', lapNumber: 5 }
        },
        {
          id: 'ev-pers-1',
          sessionId: 's-1',
          teamId: 'team-1',
          type: 'PERSONNEL_CHANGED',
          serverTimestamp: 6500,
          actor: 'team',
          payload: { newPersonnel: 'Lucía', previousPersonnel: 'Piloto 1', lapNumber: 6 }
        }
      ];

      const strategy = computeTeamStrategy('team-1', laps, events);

      // Estado actual
      expect(strategy.currentEquipment).toBe('SOFT');
      // Vueltas desde el cambio (8 total - 5 en el cambio = 3 vueltas con SOFT)
      expect(strategy.equipmentStintLaps).toBe(3);
      // Totales
      expect(strategy.equipmentTotals['HARD']).toBe(5);
      expect(strategy.equipmentTotals['SOFT']).toBe(3);

      // Personal actual
      expect(strategy.currentPersonnel).toBe('Lucía');
      // Vueltas desde el relevo (8 total - 6 en el cambio = 2 vueltas con Lucía)
      expect(strategy.personnelStintLaps).toBe(2);
      // Totales
      expect(strategy.personnelTotals['Piloto 1']).toBe(6);
      expect(strategy.personnelTotals['Lucía']).toBe(2);

      // CRITERIO M6: Ningún campo infiere sanción, penalización ni descalificación automática
      expect(strategy).not.toHaveProperty('violation');
      expect(strategy).not.toHaveProperty('penalty');
      expect(strategy).not.toHaveProperty('disqualified');
    });
  });

  describe('Integración API Endpoints de Estrategia y Control de Acceso', () => {
    let sessionId: string;
    let teamAId: string;
    let teamAToken: string;
    let teamBId: string;
    let teamBToken: string;

    beforeEach(async () => {
      // 1. Crear evento
      await fetch(`${baseUrl}/api/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Campeonato Escolar M6' })
      });

      // 2. Crear dos escuderías
      const tARes = await fetch(`${baseUrl}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Escudería Alpha', color: '#3b82f6' })
      });
      const tAData = await tARes.json();
      teamAId = tAData.team.id;
      teamAToken = tAData.team.token;

      const tBRes = await fetch(`${baseUrl}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Escudería Beta', color: '#10b981' })
      });
      const tBData = await tBRes.json();
      teamBId = tBData.team.id;
      teamBToken = tBData.team.token;

      // 3. Crear sesión e iniciarla
      const sessRes = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Carrera M6',
          type: 'race',
          participatingTeamIds: [teamAId, teamBId]
        })
      });
      const sessData = await sessRes.json();
      sessionId = sessData.session.id;

      await fetch(`${baseUrl}/api/sessions/${sessionId}/start`, { method: 'POST' });
    });

    it('permite registrar PIT_IN y PIT_OUT con token de escudería válido', async () => {
      // PIT IN
      const pitInRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/strategy/pit-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teamAToken}`
        },
        body: JSON.stringify({ teamId: teamAId, reason: 'Parada programada' })
      });

      expect(pitInRes.status).toBe(201);
      const pitInData = await pitInRes.json();
      expect(pitInData.ok).toBe(true);
      expect(pitInData.strategy.pitState).toBe('IN_PIT');
      expect(pitInData.strategy.pitStopCount).toBe(1);

      // PIT OUT
      const pitOutRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/strategy/pit-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teamAToken}`
        },
        body: JSON.stringify({ teamId: teamAId, reason: 'Fin de repostaje' })
      });

      expect(pitOutRes.status).toBe(201);
      const pitOutData = await pitOutRes.json();
      expect(pitOutData.ok).toBe(true);
      expect(pitOutData.strategy.pitState).toBe('ON_TRACK');
      expect(pitOutData.strategy.lastPitDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('permite registrar cambio de compuesto y relevo de personal con idioma español', async () => {
      // Cambio a compuesto MEDIUM
      const eqRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/strategy/equipment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teamAToken}`
        },
        body: JSON.stringify({ teamId: teamAId, equipment: 'MEDIUM' })
      });

      expect(eqRes.status).toBe(201);
      const eqData = await eqRes.json();
      expect(eqData.ok).toBe(true);
      expect(eqData.message).toContain('MEDIUM');
      expect(eqData.strategy.currentEquipment).toBe('MEDIUM');

      // Relevo a Piloto 2
      const persRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/strategy/personnel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teamAToken}`
        },
        body: JSON.stringify({ teamId: teamAId, personnel: 'Piloto 2' })
      });

      expect(persRes.status).toBe(201);
      const persData = await persRes.json();
      expect(persData.ok).toBe(true);
      expect(persData.message).toContain('Piloto 2');
      expect(persData.strategy.currentPersonnel).toBe('Piloto 2');
    });

    it('Escenario C: el token de la Escudería B NO puede registrar acciones de estrategia para la Escudería A', async () => {
      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/strategy/pit-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teamBToken}` // Token de B
        },
        body: JSON.stringify({ teamId: teamAId }) // Intentando cambiar a A
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN_TEAM_ACTION');
    });

    it('GET /sessions/:sessionId/strategy devuelve la estrategia consolidada para todos los equipos', async () => {
      // Realizamos un cambio en Team A
      await fetch(`${baseUrl}/api/sessions/${sessionId}/strategy/equipment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teamAToken}`
        },
        body: JSON.stringify({ teamId: teamAId, equipment: 'SOFT' })
      });

      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/strategy`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.teamsStrategy).toBeDefined();
      expect(data.teamsStrategy[teamAId].currentEquipment).toBe('SOFT');
      expect(data.teamsStrategy[teamBId].currentEquipment).toBe('HARD');
    });

    it('proyección de cronometraje GET /timing incluye métricas neutrales de estrategia en el leaderboard', async () => {
      const timingRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/timing`);
      expect(timingRes.status).toBe(200);
      const data = await timingRes.json();
      expect(data.ok).toBe(true);
      expect(data.timing).toBeDefined();
      expect(data.timing.leaderboard).toHaveLength(2);

      const entryA = data.timing.leaderboard.find((l: { teamId: string }) => l.teamId === teamAId);
      expect(entryA).toBeDefined();
      expect(entryA.strategy).toBeDefined();
      expect(entryA.strategy.pitState).toBe('ON_TRACK');
      expect(entryA.strategy.currentEquipment).toBe('HARD');
      expect(entryA.strategy.currentPersonnel).toBe('Piloto 1');
    });
  });
});
