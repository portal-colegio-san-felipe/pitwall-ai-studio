import { config } from '../config.js';
import { FileDurableStore } from './fileStore.js';
import { PersistenceStore } from './types.js';

let storeInstance: PersistenceStore | null = null;

export function getPersistenceStore(): PersistenceStore {
  if (!storeInstance) {
    storeInstance = new FileDurableStore(config.persistenceDir);
  }
  return storeInstance;
}

export function setPersistenceStore(store: PersistenceStore | null): void {
  storeInstance = store;
}

export * from './types.js';
