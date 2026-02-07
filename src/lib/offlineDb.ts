import Dexie, { type Table } from 'dexie';

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

// Dexie database class
class OfflineDatabase extends Dexie {
  leads!: Table<OfflineLead, number>;
  checklists!: Table<OfflineChecklist, number>;
  media!: Table<OfflineMedia, number>;

  constructor() {
    super('MaisEnergiaOfflineDB');
    
    this.version(1).stores({
      leads: '++id, tempId, vendedorNome, syncStatus, createdAt',
      checklists: '++id, tempId, instaladorId, syncStatus, createdAt',
      media: '++id, tempId, parentType, parentTempId, syncStatus'
    });
  }
}

// Singleton instance
export const offlineDb = new OfflineDatabase();

// Helper functions for leads
export const offlineLeadService = {
  async add(lead: Omit<OfflineLead, 'id'>): Promise<number> {
    return await offlineDb.leads.add(lead);
  },

  async getByVendedor(vendedorNome: string): Promise<OfflineLead[]> {
    return await offlineDb.leads
      .where('vendedorNome')
      .equals(vendedorNome)
      .toArray();
  },

  async getPending(vendedorNome?: string): Promise<OfflineLead[]> {
    let query = offlineDb.leads.where('syncStatus').anyOf(['pending', 'error']);
    
    if (vendedorNome) {
      const all = await query.toArray();
      return all.filter(lead => lead.vendedorNome === vendedorNome);
    }
    
    return await query.toArray();
  },

  async updateStatus(
    id: number, 
    syncStatus: OfflineLead['syncStatus'], 
    serverLeadId?: string,
    lastError?: string
  ): Promise<void> {
    await offlineDb.leads.update(id, { 
      syncStatus, 
      serverLeadId,
      lastError,
      retryCount: syncStatus === 'error' 
        ? (await offlineDb.leads.get(id))?.retryCount ?? 0 + 1 
        : undefined
    });
  },

  async delete(id: number): Promise<void> {
    await offlineDb.leads.delete(id);
  },

  async clearSynced(vendedorNome?: string): Promise<void> {
    if (vendedorNome) {
      await offlineDb.leads
        .where('syncStatus')
        .equals('synced')
        .filter(lead => lead.vendedorNome === vendedorNome)
        .delete();
    } else {
      await offlineDb.leads.where('syncStatus').equals('synced').delete();
    }
  },

  async count(vendedorNome?: string, status?: OfflineLead['syncStatus']): Promise<number> {
    let leads = await offlineDb.leads.toArray();
    
    if (vendedorNome) {
      leads = leads.filter(l => l.vendedorNome === vendedorNome);
    }
    
    if (status) {
      leads = leads.filter(l => l.syncStatus === status);
    }
    
    return leads.length;
  }
};

// Helper functions for checklists
export const offlineChecklistService = {
  async add(checklist: Omit<OfflineChecklist, 'id'>): Promise<number> {
    return await offlineDb.checklists.add(checklist);
  },

  async getByInstalador(instaladorId: string): Promise<OfflineChecklist[]> {
    return await offlineDb.checklists
      .where('instaladorId')
      .equals(instaladorId)
      .toArray();
  },

  async getPending(instaladorId?: string): Promise<OfflineChecklist[]> {
    let query = offlineDb.checklists.where('syncStatus').anyOf(['pending', 'error']);
    
    if (instaladorId) {
      const all = await query.toArray();
      return all.filter(checklist => checklist.instaladorId === instaladorId);
    }
    
    return await query.toArray();
  },

  async updateStatus(
    id: number, 
    syncStatus: OfflineChecklist['syncStatus'], 
    serverChecklistId?: string,
    lastError?: string
  ): Promise<void> {
    await offlineDb.checklists.update(id, { 
      syncStatus, 
      serverChecklistId,
      lastError,
      retryCount: syncStatus === 'error' 
        ? (await offlineDb.checklists.get(id))?.retryCount ?? 0 + 1 
        : undefined
    });
  },

  async delete(id: number): Promise<void> {
    await offlineDb.checklists.delete(id);
  },

  async clearSynced(instaladorId?: string): Promise<void> {
    if (instaladorId) {
      await offlineDb.checklists
        .where('syncStatus')
        .equals('synced')
        .filter(c => c.instaladorId === instaladorId)
        .delete();
    } else {
      await offlineDb.checklists.where('syncStatus').equals('synced').delete();
    }
  },

  async count(instaladorId?: string, status?: OfflineChecklist['syncStatus']): Promise<number> {
    let checklists = await offlineDb.checklists.toArray();
    
    if (instaladorId) {
      checklists = checklists.filter(c => c.instaladorId === instaladorId);
    }
    
    if (status) {
      checklists = checklists.filter(c => c.syncStatus === status);
    }
    
    return checklists.length;
  }
};

// Helper functions for media (photos, signatures)
export const offlineMediaService = {
  async add(media: Omit<OfflineMedia, 'id'>): Promise<number> {
    return await offlineDb.media.add(media);
  },

  async getByParent(parentType: 'lead' | 'checklist', parentTempId: string): Promise<OfflineMedia[]> {
    return await offlineDb.media
      .where(['parentType', 'parentTempId'])
      .equals([parentType, parentTempId])
      .toArray();
  },

  async getPending(): Promise<OfflineMedia[]> {
    return await offlineDb.media
      .where('syncStatus')
      .anyOf(['pending', 'error'])
      .toArray();
  },

  async updateStatus(
    id: number, 
    syncStatus: OfflineMedia['syncStatus'], 
    serverUrl?: string
  ): Promise<void> {
    await offlineDb.media.update(id, { syncStatus, serverUrl });
  },

  async delete(id: number): Promise<void> {
    await offlineDb.media.delete(id);
  },

  async clearSynced(): Promise<void> {
    await offlineDb.media.where('syncStatus').equals('synced').delete();
  }
};

// Generate unique temp ID
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
