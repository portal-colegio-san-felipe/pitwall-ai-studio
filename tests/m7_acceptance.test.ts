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
import { computeTeamStewarding } from '../server/stewarding';
import { RaceEventData } from '../server/storage/types';

describe('Pruebas de Aceptación de M7: Comisaría Deportiva y Sanciones Manuales (Escenario H)', () => {
  let testDir: string;
  let store: FileDurableStore;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    presenceManager.reset();
    realtimeBus.reset();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pitwall-m7-test-'));
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

  describe('Motor Determinista de Comisaría (Pure Logic)', () => {
    it('1. Registra advertencias (warnings) de comisaría con motivo, actor y fecha', () => {
      const events: RaceEventData[] = [
        {
          id: 'w-1',
          sessionId: 's-1',
          teamId: 'team-1',
          type: 'STEWARD_WARNING',
          serverTimestamp: 1000,
          actor: 'Comisario 1',
          payload: { reason: 'Exceso de límites de pista en curva 2' }
        }
      ];

      const state = computeTeamStewarding('team-1', events);
      expect(state.warnings).toHaveLength(1);
      expect(state.warnings[0].reason).toBe('Exceso de límites de pista en curva 2');
      expect(state.warnings[0].actor).toBe('Comisario 1');
      expect(state.totalPenaltyMs).toBe(0);
      expect(state.isDisqualified).toBe(false);
    });

    it('2. Calcula penalizaciones de tiempo sumando segundos y permite revocación auditada', () => {
      const events: RaceEventData[] = [
        {
          id: 'p-1',
          sessionId: 's-1',
          teamId: 'team-1',
          type: 'STEWARD_TIME_PENALTY',
          serverTimestamp: 2000,
          actor: 'Director de Carrera',
          payload: { seconds: 3, penaltyMs: 3000, reason: 'Toque antideportivo' }
        },
        {
          id: 'p-2',
          sessionId: 's-1',
          teamId: 'team-1',
          type: 'STEWARD_TIME_PENALTY',
          serverTimestamp: 3000,
          actor: 'Director de Carrera',
          payload: { seconds: 5, penaltyMs: 5000, reason: 'Velocidad en pit lane' }
        }
      ];

      let state = computeTeamStewarding('team-1', events);
      expect(state.timePenalties).toHaveLength(2);
      expect(state.totalPenaltyMs).toBe(8000);

      // Ahora se revoca la penalización p-1 con motivo auditado
      const cancelEvent: RaceEventData = {
        id: 'c-1',
        sessionId: 's-1',
        teamId: 'team-1',
        type: 'STEWARD_TIME_PENALTY_CANCELLED',
        serverTimestamp: 4000,
        actor: 'Comisario de Apelaciones',
        payload: { penaltyId: 'p-1', reason: 'Error en identificación visual del kart' }
      };

      state = computeTeamStewarding('team-1', [...events, cancelEvent]);
      expect(state.totalPenaltyMs).toBe(5000); // Solo queda p-2 activa
      const revoked = state.timePenalties.find((p) => p.id === 'p-1');
      expect(revoked?.cancelled).toBe(true);
      expect(revoked?.cancelReason).toBe('Error en identificación visual del kart');
      expect(revoked?.cancelledBy).toBe('Comisario de Apelaciones');
    });

    it('3. Gestiona el ciclo de vida de la directiva PIT_REQUIRED (PENDING -> SERVED / CANCELLED)', () => {
      const issueEvent: RaceEventData = {
        id: 'dir-1',
        sessionId: 's-1',
        teamId: 'team-1',
        type: 'STEWARD_PIT_REQUIRED',
        serverTimestamp: 5000,
        actor: 'Director de Carrera',
        payload: { reason: 'Revisión obligatoria de fijación de pontón' }
      };

      let state = computeTeamStewarding('team-1', [issueEvent]);
      expect(state.pitRequiredDirectives).toHaveLength(1);
      expect(state.activePitRequired).toBeDefined();
      expect(state.activePitRequired?.status).toBe('PENDING');

      // Resolución manual a SERVED
      const resolveEvent: RaceEventData = {
        id: 'res-1',
        sessionId: 's-1',
        teamId: 'team-1',
        type: 'STEWARD_PIT_REQUIRED_RESOLVED',
        serverTimestamp: 6000,
        actor: 'Comisario Técnico',
        payload: { directiveId: 'dir-1', status: 'SERVED' }
      };

      state = computeTeamStewarding('team-1', [issueEvent, resolveEvent]);
      expect(state.activePitRequired).toBeUndefined(); // Ya no hay directiva pendiente
      expect(state.pitRequiredDirectives[0].status).toBe('SERVED');
      expect(state.pitRequiredDirectives[0].servedBy).toBe('Comisario Técnico');
    });

    it('4. Cumple automáticamente PIT_REQUIRED cuando la escudería realiza PIT_IN posterior', () => {
      const issueEvent: RaceEventData = {
        id: 'dir-auto',
        sessionId: 's-1',
        teamId: 'team-1',
        type: 'STEWARD_PIT_REQUIRED',
        serverTimestamp: 10000,
        actor: 'Director de Carrera',
        payload: { reason: 'Paso por boxes mandatorio' }
      };

      const pitInEvent: RaceEventData = {
        id: 'pit-1',
        sessionId: 's-1',
        teamId: 'team-1',
        type: 'PIT_IN',
        serverTimestamp: 12000,
        actor: 'team-token',
        payload: { lapNumber: 4 }
      };

      const state = computeTeamStewarding('team-1', [issueEvent, pitInEvent]);
      expect(state.activePitRequired).toBeUndefined();
      expect(state.pitRequiredDirectives[0].status).toBe('SERVED');
      expect(state.pitRequiredDirectives[0].servedBy).toBe('pit-in-auto');
    });

    it('5. Descalifica con motivo y permite reversión deliberada y auditada (REINSTATE)', () => {
      const dqEvent: RaceEventData = {
        id: 'dq-1',
        sessionId: 's-1',
        teamId: 'team-1',
        type: 'STEWARD_DISQUALIFY',
        serverTimestamp: 15000,
        actor: 'Director de Carrera',
        payload: { reason: 'Pesaje insuficiente al final de la tanda' }
      };

      let state = computeTeamStewarding('team-1', [dqEvent]);
      expect(state.isDisqualified).toBe(true);
      expect(state.disqualification?.reason).toBe('Pesaje insuficiente al final de la tanda');
      expect(state.disqualification?.reinstated).toBe(false);

      // Reversión deliberada y auditada
      const reinstateEvent: RaceEventData = {
        id: 'rein-1',
        sessionId: 's-1',
        teamId: 'team-1',
        type: 'STEWARD_REINSTATE',
        serverTimestamp: 18000,
        actor: 'Comisario Técnico Jefe',
        payload: { reason: 'Báscula de pesaje recalibrada: kart dentro del límite legal' }
      };

      state = computeTeamStewarding('team-1', [dqEvent, reinstateEvent]);
      expect(state.isDisqualified).toBe(false);
      expect(state.disqualification?.reinstated).toBe(true);
      expect(state.disqualification?.reinstateReason).toBe('Báscula de pesaje recalibrada: kart dentro del límite legal');
      expect(state.disqualification?.reinstatedBy).toBe('Comisario Técnico Jefe');
    });
  });

  describe('Pruebas de Aceptación End-to-End M7 (Escenario H y Flujo Operativo)', () => {
    it('6. Escenario H: Aplica penalización de +3.000s preservando tiempos brutos, directiva PIT_REQUIRED y descalificación con reversión', async () => {
      // 1. Configurar evento y escuderías
      const evRes = await fetch(`${baseUrl}/api/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Trofeo Comisaría 2026' })
      });
      expect(evRes.ok).toBe(true);

      const teamARes = await fetch(`${baseUrl}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Escudería Águilas', color: '#ff0000' })
      });
      const { team: teamA } = await teamARes.json();

      const teamBRes = await fetch(`${baseUrl}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Escudería Halcones', color: '#0000ff' })
      });
      const { team: teamB } = await teamBRes.json();

      // 2. Iniciar manga
      const sessRes = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Manga 1',
          type: 'race',
          participatingTeamIds: [teamA.id, teamB.id]
        })
      });
      const { session } = await sessRes.json();
      await fetch(`${baseUrl}/api/sessions/${session.id}/start`, { method: 'POST' });

      // 3. Registrar vueltas normales
      const lapARes = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teamA.token}`
        },
        body: JSON.stringify({ teamId: teamA.id })
      });
      const lapAData = await lapARes.json();
      const rawLapTimeA = lapAData.lap.lapTimeMs;

      // 4. Dirección de Carrera aplica penalización temporal de +3.000s con motivo
      const penRes = await fetch(`${baseUrl}/api/sessions/${session.id}/stewarding/time-penalty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: teamA.id,
          seconds: 3,
          reason: 'Límites de pista excedidos reiteradamente (+3.000s)'
        })
      });
      expect(penRes.status).toBe(201);
      const penData = await penRes.json();
      expect(penData.ok).toBe(true);
      expect(penData.stewarding.totalPenaltyMs).toBe(3000);

      // Verificar que el cronometraje bruto se conserva separado
      let timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
      let timingData = await timingRes.json();
      let teamAEntry = timingData.timing.leaderboard.find((l: any) => l.teamId === teamA.id);
      expect(teamAEntry.lastLapMs).toBe(rawLapTimeA); // Tiempo bruto intacto
      expect(teamAEntry.totalPenaltyMs).toBe(3000); // Penalización proyectada por separado

      // 5. Dirección de Carrera emite directiva PIT_REQUIRED
      const pitReqRes = await fetch(`${baseUrl}/api/sessions/${session.id}/stewarding/pit-required`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: teamA.id,
          reason: 'Inspección visual obligatoria en boxes'
        })
      });
      expect(pitReqRes.status).toBe(201);
      const pitReqData = await pitReqRes.json();
      expect(pitReqData.stewarding.activePitRequired).toBeDefined();
      expect(pitReqData.stewarding.activePitRequired.status).toBe('PENDING');

      // 6. La escudería efectúa entrada a boxes -> la directiva se cumple automáticamente (SERVED)
      await fetch(`${baseUrl}/api/sessions/${session.id}/strategy/pit-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teamA.token}`
        },
        body: JSON.stringify({ teamId: teamA.id })
      });

      timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
      timingData = await timingRes.json();
      teamAEntry = timingData.timing.leaderboard.find((l: any) => l.teamId === teamA.id);
      expect(timingData.timing.teamsStewarding[teamA.id].activePitRequired).toBeUndefined();
      expect(timingData.timing.teamsStewarding[teamA.id].pitRequiredDirectives[0].status).toBe('SERVED');

      // 7. Dirección de Carrera emite descalificación (DQ) a Escudería Águilas
      const dqRes = await fetch(`${baseUrl}/api/sessions/${session.id}/stewarding/disqualify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: teamA.id,
          reason: 'Infracción reglamentaria grave en pit lane'
        })
      });
      expect(dqRes.status).toBe(201);

      // Verificar que el equipo descalificado no puede registrar vueltas
      const lateLapRes = await fetch(`${baseUrl}/api/sessions/${session.id}/laps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teamA.token}`
        },
        body: JSON.stringify({ teamId: teamA.id })
      });
      expect(lateLapRes.status).toBe(403);
      const lateLapData = await lateLapRes.json();
      expect(lateLapData.error.code).toBe('TEAM_DISQUALIFIED');

      // Verificar que la tabla de clasificación refleja isDisqualified: true
      timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
      timingData = await timingRes.json();
      teamAEntry = timingData.timing.leaderboard.find((l: any) => l.teamId === teamA.id);
      expect(teamAEntry.isDisqualified).toBe(true);

      // 8. Reversión deliberada y auditada de la descalificación (REINSTATE)
      const reinRes = await fetch(`${baseUrl}/api/sessions/${session.id}/stewarding/reinstate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: teamA.id,
          reason: 'Apelación admitida: revisión de vídeo exonera a la escudería'
        })
      });
      expect(reinRes.ok).toBe(true);
      const reinData = await reinRes.json();
      expect(reinData.stewarding.isDisqualified).toBe(false);

      // Ahora el equipo puede volver a registrar vueltas
      timingRes = await fetch(`${baseUrl}/api/sessions/${session.id}/timing`);
      timingData = await timingRes.json();
      teamAEntry = timingData.timing.leaderboard.find((l: any) => l.teamId === teamA.id);
      expect(teamAEntry.isDisqualified).toBe(false);
    });

    it('7. Límite de permisos: Los operadores de equipo con token no pueden emitir sanciones de comisaría', async () => {
      // Configurar evento y escudería
      await fetch(`${baseUrl}/api/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Trofeo Seguridad' })
      });

      const teamRes = await fetch(`${baseUrl}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Team Intruso' })
      });
      const { team } = await teamRes.json();

      const sessRes = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Sesión 1', participatingTeamIds: [team.id] })
      });
      const { session } = await sessRes.json();

      // Intento no autorizado de descalificar usando token de escudería
      const unauthorizedRes = await fetch(`${baseUrl}/api/sessions/${session.id}/stewarding/disqualify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${team.token}`
        },
        body: JSON.stringify({
          teamId: team.id,
          reason: 'Ataque fraudulento'
        })
      });

      expect(unauthorizedRes.status).toBe(403);
      const data = await unauthorizedRes.json();
      expect(data.error.code).toBe('FORBIDDEN_STEWARDING_ACTION');
    });

    it('8. Auditoría inmutable y persistencia de hechos de comisaría deportiva', async () => {
      await fetch(`${baseUrl}/api/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Trofeo Auditoría M7' })
      });

      const teamRes = await fetch(`${baseUrl}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Escudería Cóndores' })
      });
      const { team } = await teamRes.json();

      const sessRes = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Sesión Final', participatingTeamIds: [team.id] })
      });
      const { session } = await sessRes.json();

      // Emitir advertencia y penalización de tiempo
      await fetch(`${baseUrl}/api/sessions/${session.id}/stewarding/warning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          reason: 'Advertencia formal por no respetar bandera amarilla'
        })
      });

      await fetch(`${baseUrl}/api/sessions/${session.id}/stewarding/time-penalty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          seconds: 10,
          reason: 'Parada en boxes fuera de zona reglamentaria'
        })
      });

      // Consultar registro inmutable de auditoría
      const auditRes = await fetch(`${baseUrl}/api/sessions/${session.id}/audit`);
      expect(auditRes.ok).toBe(true);
      const auditData = await auditRes.json();
      const stewardEvents = auditData.events.filter((e: any) =>
        e.type.startsWith('STEWARD_')
      );
      expect(stewardEvents.length).toBeGreaterThanOrEqual(2);

      // Reinicializar el almacén desde disco para verificar persistencia duradera
      const newStore = new FileDurableStore(testDir);
      await newStore.init();
      const persistedEvents = await newStore.getRaceEvents(session.id);
      const persistedStewarding = computeTeamStewarding(team.id, persistedEvents);
      expect(persistedStewarding.warnings.length).toBeGreaterThanOrEqual(1);
      expect(persistedStewarding.totalPenaltyMs).toBe(10000);
      expect(persistedEvents.some((e) => e.type === 'STEWARD_WARNING')).toBe(true);
      expect(persistedEvents.some((e) => e.type === 'STEWARD_TIME_PENALTY')).toBe(true);
    });
  });
});
