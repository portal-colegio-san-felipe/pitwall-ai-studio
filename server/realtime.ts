import { EventEmitter } from 'events';
import { Response } from 'express';

export interface RealtimeTimingEvent {
  type: 'timing_update' | 'session_update' | 'event_update' | 'presence_update';
  sessionId?: string;
  revision: number;
  serverTime: number;
  data?: unknown;
}

class RealtimeEventBus extends EventEmitter {
  private currentRevision = 1;
  private sseClients = new Set<{ res: Response; sessionId?: string }>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setMaxListeners(100);
    this.startHeartbeat();
  }

  public getRevision(): number {
    return this.currentRevision;
  }

  public nextRevision(): number {
    this.currentRevision += 1;
    return this.currentRevision;
  }

  public registerClient(res: Response, sessionId?: string) {
    const client = { res, sessionId };
    this.sseClients.add(client);

    // Enviar evento inicial de conexión
    const initData = {
      type: 'connected',
      revision: this.currentRevision,
      serverTime: Date.now()
    };
    res.write(`event: connected\ndata: ${JSON.stringify(initData)}\n\n`);

    return () => {
      this.sseClients.delete(client);
    };
  }

  public broadcast(event: RealtimeTimingEvent) {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.sseClients) {
      // Si el cliente especificó un sessionId y el evento tiene sessionId diferente, omitir
      if (client.sessionId && event.sessionId && client.sessionId !== event.sessionId) {
        continue;
      }
      try {
        client.res.write(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  public publishTimingUpdate(sessionId: string, data?: unknown) {
    const revision = this.nextRevision();
    const event: RealtimeTimingEvent = {
      type: 'timing_update',
      sessionId,
      revision,
      serverTime: Date.now(),
      data
    };
    this.emit('timing_update', event);
    this.broadcast(event);
  }

  public publishSessionUpdate(sessionId: string, data?: unknown) {
    const revision = this.nextRevision();
    const event: RealtimeTimingEvent = {
      type: 'session_update',
      sessionId,
      revision,
      serverTime: Date.now(),
      data
    };
    this.emit('session_update', event);
    this.broadcast(event);
  }

  public publishEventUpdate(data?: unknown) {
    const revision = this.nextRevision();
    const event: RealtimeTimingEvent = {
      type: 'event_update',
      revision,
      serverTime: Date.now(),
      data
    };
    this.emit('event_update', event);
    this.broadcast(event);
  }

  public subscribe(listener: (eventType: string, event: RealtimeTimingEvent) => void) {
    const onTiming = (e: RealtimeTimingEvent) => listener('timing_update', e);
    const onSession = (e: RealtimeTimingEvent) => listener('session_update', e);
    const onEvent = (e: RealtimeTimingEvent) => listener('event_update', e);
    this.on('timing_update', onTiming);
    this.on('session_update', onSession);
    this.on('event_update', onEvent);
    return () => {
      this.off('timing_update', onTiming);
      this.off('session_update', onSession);
      this.off('event_update', onEvent);
    };
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.sseClients) {
        try {
          client.res.write(':heartbeat\n\n');
        } catch {
          this.sseClients.delete(client);
        }
      }
    }, 15000);
  }

  public reset() {
    this.currentRevision = 1;
    for (const client of this.sseClients) {
      try {
        client.res.end();
      } catch {
        // Ignorar
      }
    }
    this.sseClients.clear();
  }
}

export const realtimeBus = new RealtimeEventBus();
