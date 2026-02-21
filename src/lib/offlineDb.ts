// Native IndexedDB wrapper — replaces Dexie to avoid TS1540 typing bug

const DB_NAME = 'MaisEnergiaOfflineDB';
const DB_VERSION = 1;

// Types for offline data
export interface OfflineLead {
  id?: number;
  tempId: string;
  vendedorNome: string;
  data: {
    nome: string;
    telefone: string;
    cidade: string;
    estado: string;
    area: string;
    tipo_telhado: string;
    rede_atendimento: string;
    media_consumo: number;
    consumo_previsto: number;
    bairro?: string;
    rua?: string;
    numero?: string;
    complemento?: string;
    cep?: string;
    observacoes?: string;
    vendedor?: string;
  };
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'duplicate';
  retryCount: number;
  lastError?: string;
  serverLeadId?: string;
}

export interface OfflineChecklist {
  id?: number;
  tempId: string;
  instaladorId: string;
  data: {
    nome_cliente: string;
    endereco: string;
    bairro?: string;
    data_instalacao: string;
    lead_code?: string;
    placas_local_aprovado?: boolean;
    inversor_local_aprovado?: boolean;
    configuracao_wifi?: boolean;
    adesivo_inversor?: boolean;
    plaquinha_relogio?: boolean;
    foto_servico?: boolean;
    observacoes?: string;
    avaliacao_atendimento?: string;
    fotos_urls?: string[];
    assinatura_cliente_url?: string;
    assinatura_instalador_url?: string;
  };
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  retryCount: number;
  lastError?: string;
  serverChecklistId?: string;
}

export interface OfflineMedia {
  id?: number;
  tempId: string;
  parentType: 'lead' | 'checklist';
  parentTempId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  serverUrl?: string;
}

/* ─── Thin IndexedDB helper ─── */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('leads')) {
        const s = db.createObjectStore('leads', { keyPath: 'id', autoIncrement: true });
        s.createIndex('tempId', 'tempId');
        s.createIndex('vendedorNome', 'vendedorNome');
        s.createIndex('syncStatus', 'syncStatus');
      }
      if (!db.objectStoreNames.contains('checklists')) {
        const s = db.createObjectStore('checklists', { keyPath: 'id', autoIncrement: true });
        s.createIndex('tempId', 'tempId');
        s.createIndex('instaladorId', 'instaladorId');
        s.createIndex('syncStatus', 'syncStatus');
      }
      if (!db.objectStoreNames.contains('media')) {
        const s = db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
        s.createIndex('tempId', 'tempId');
        s.createIndex('parentType', 'parentType');
        s.createIndex('parentTempId', 'parentTempId');
        s.createIndex('syncStatus', 'syncStatus');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addRecord<T>(store: string, record: T): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function getById<T>(store: string, id: number): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function updateRecord(store: string, id: number, data: Record<string, any>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    const getReq = os.get(id);
    getReq.onsuccess = () => {
      if (!getReq.result) { reject(new Error('Record not found')); return; }
      os.put({ ...getReq.result, ...data });
      tx.oncomplete = () => resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function deleteRecord(store: string, id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deleteByFilter<T extends { id?: number }>(store: string, filter: (r: T) => boolean): Promise<void> {
  const all = await getAll<T>(store);
  const toDelete = all.filter(filter);
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const r of toDelete) {
    if (r.id != null) os.delete(r.id);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ─── Service APIs (same interface as before) ─── */

export const offlineLeadService = {
  async add(lead: Omit<OfflineLead, 'id'>): Promise<number> {
    return addRecord('leads', lead);
  },
  async getByVendedor(vendedorNome: string): Promise<OfflineLead[]> {
    const all = await getAll<OfflineLead>('leads');
    return all.filter(l => l.vendedorNome === vendedorNome);
  },
  async getPending(vendedorNome?: string): Promise<OfflineLead[]> {
    const all = await getAll<OfflineLead>('leads');
    return all.filter(l =>
      (l.syncStatus === 'pending' || l.syncStatus === 'error') &&
      (!vendedorNome || l.vendedorNome === vendedorNome)
    );
  },
  async updateStatus(id: number, syncStatus: OfflineLead['syncStatus'], serverLeadId?: string, lastError?: string): Promise<void> {
    const data: Partial<OfflineLead> = { syncStatus, serverLeadId, lastError };
    if (syncStatus === 'error') {
      const current = await getById<OfflineLead>('leads', id);
      data.retryCount = (current?.retryCount ?? 0) + 1;
    }
    await updateRecord('leads', id, data);
  },
  async delete(id: number): Promise<void> {
    await deleteRecord('leads', id);
  },
  async clearSynced(vendedorNome?: string): Promise<void> {
    await deleteByFilter<OfflineLead>('leads', l =>
      l.syncStatus === 'synced' && (!vendedorNome || l.vendedorNome === vendedorNome)
    );
  },
  async count(vendedorNome?: string, status?: OfflineLead['syncStatus']): Promise<number> {
    const all = await getAll<OfflineLead>('leads');
    return all.filter(l =>
      (!vendedorNome || l.vendedorNome === vendedorNome) &&
      (!status || l.syncStatus === status)
    ).length;
  },
};

export const offlineChecklistService = {
  async add(checklist: Omit<OfflineChecklist, 'id'>): Promise<number> {
    return addRecord('checklists', checklist);
  },
  async getByInstalador(instaladorId: string): Promise<OfflineChecklist[]> {
    const all = await getAll<OfflineChecklist>('checklists');
    return all.filter(c => c.instaladorId === instaladorId);
  },
  async getPending(instaladorId?: string): Promise<OfflineChecklist[]> {
    const all = await getAll<OfflineChecklist>('checklists');
    return all.filter(c =>
      (c.syncStatus === 'pending' || c.syncStatus === 'error') &&
      (!instaladorId || c.instaladorId === instaladorId)
    );
  },
  async updateStatus(id: number, syncStatus: OfflineChecklist['syncStatus'], serverChecklistId?: string, lastError?: string): Promise<void> {
    const data: Partial<OfflineChecklist> = { syncStatus, serverChecklistId, lastError };
    if (syncStatus === 'error') {
      const current = await getById<OfflineChecklist>('checklists', id);
      data.retryCount = (current?.retryCount ?? 0) + 1;
    }
    await updateRecord('checklists', id, data);
  },
  async delete(id: number): Promise<void> {
    await deleteRecord('checklists', id);
  },
  async clearSynced(instaladorId?: string): Promise<void> {
    await deleteByFilter<OfflineChecklist>('checklists', c =>
      c.syncStatus === 'synced' && (!instaladorId || c.instaladorId === instaladorId)
    );
  },
  async count(instaladorId?: string, status?: OfflineChecklist['syncStatus']): Promise<number> {
    const all = await getAll<OfflineChecklist>('checklists');
    return all.filter(c =>
      (!instaladorId || c.instaladorId === instaladorId) &&
      (!status || c.syncStatus === status)
    ).length;
  },
};

export const offlineMediaService = {
  async add(media: Omit<OfflineMedia, 'id'>): Promise<number> {
    return addRecord('media', media);
  },
  async getByParent(parentType: 'lead' | 'checklist', parentTempId: string): Promise<OfflineMedia[]> {
    const all = await getAll<OfflineMedia>('media');
    return all.filter(m => m.parentType === parentType && m.parentTempId === parentTempId);
  },
  async getPending(): Promise<OfflineMedia[]> {
    const all = await getAll<OfflineMedia>('media');
    return all.filter(m => m.syncStatus === 'pending' || m.syncStatus === 'error');
  },
  async updateStatus(id: number, syncStatus: OfflineMedia['syncStatus'], serverUrl?: string): Promise<void> {
    await updateRecord('media', id, { syncStatus, serverUrl });
  },
  async delete(id: number): Promise<void> {
    await deleteRecord('media', id);
  },
  async clearSynced(): Promise<void> {
    await deleteByFilter<OfflineMedia>('media', m => m.syncStatus === 'synced');
  },
};

// Generate unique temp ID
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
