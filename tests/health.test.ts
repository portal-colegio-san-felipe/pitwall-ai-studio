import { describe, it, expect } from 'vitest';
import { FileDurableStore } from '../server/storage/fileStore';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Pruebas de Diagnóstico y Salud del Servidor (M0)', () => {
  it('debe responder satisfactoriamente a la comprobación de salud de persistencia', async () => {
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pitwall-health-'));
    const store = new FileDurableStore(testDir);
    await store.init();

    const health = await store.checkHealth();

    expect(health.ok).toBe(true);
    expect(health.reachable).toBe(true);
    expect(health.hasProductionSeedData).toBe(false);
    expect(typeof health.checkedAt).toBe('string');

    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('debe detectar anomalías si el directorio de persistencia es inaccesible', async () => {
    const invalidStore = new FileDurableStore('/proc/invalid_pitwall_path_no_write');
    const health = await invalidStore.checkHealth();

    expect(health.ok).toBe(false);
    expect(health.reachable).toBe(false);
  });
});
