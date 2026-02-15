// ─── Mock Data for SolarWizard ──────────────────────────────
// Realistic seed data for standalone wizard demo

export interface MockCliente {
  id: string;
  nome: string;
  telefone: string;
  cpf_cnpj: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface MockConcessionaria {
  id: string;
  nome: string;
  sigla: string;
  estado: string;
  tarifa_kwh: number;
  logo?: string;
}

export interface MockBanco {
  id: string;
  nome: string;
  taxa_mensal: number;
  max_parcelas: number;
  carencia_meses: number;
}

export interface MockModulo {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_wp: number;
  eficiencia: number;
  tipo: string;
}

export interface MockInversor {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_kw: number;
  tipo: string;
  mppt: number;
  fases: string;
}

export interface MockKit {
  id: string;
  tier: "economy" | "standard" | "premium";
  label: string;
  modulo: MockModulo;
  inversor: MockInversor;
  precoBase_kwp: number;
  degradacao25: number;
  roiAnos: number;
  garantiaModulo: number;
  garantiaInversor: number;
}

// ─── Clients ──────────────────────────────────────────────
export const MOCK_CLIENTES: MockCliente[] = [
  { id: "c1", nome: "João Silva Pereira", telefone: "(11) 99887-6543", cpf_cnpj: "123.456.789-00", email: "joao@email.com", cep: "01310-100", endereco: "Av. Paulista", numero: "1578", bairro: "Bela Vista", cidade: "São Paulo", estado: "SP" },
  { id: "c2", nome: "Maria Santos Costa", telefone: "(21) 98765-4321", cpf_cnpj: "987.654.321-00", email: "maria@email.com", cep: "20040-020", endereco: "Rua da Assembleia", numero: "10", bairro: "Centro", cidade: "Rio de Janeiro", estado: "RJ" },
  { id: "c3", nome: "Empresa Solar LTDA", telefone: "(31) 3456-7890", cpf_cnpj: "12.345.678/0001-90", email: "contato@solar.com", cep: "30130-000", endereco: "Rua da Bahia", numero: "1148", bairro: "Lourdes", cidade: "Belo Horizonte", estado: "MG" },
  { id: "c4", nome: "Carlos Eduardo Ferreira", telefone: "(41) 99123-4567", cpf_cnpj: "456.789.012-34", email: "carlos@gmail.com", cep: "80060-000", endereco: "Rua XV de Novembro", numero: "700", bairro: "Centro", cidade: "Curitiba", estado: "PR" },
  { id: "c5", nome: "Ana Paula Rodrigues", telefone: "(48) 99876-5432", cpf_cnpj: "789.012.345-67", email: "ana@hotmail.com", cep: "88010-000", endereco: "Rua Felipe Schmidt", numero: "315", bairro: "Centro", cidade: "Florianópolis", estado: "SC" },
];

// ─── Concessionárias ──────────────────────────────────────
export const MOCK_CONCESSIONARIAS: MockConcessionaria[] = [
  { id: "cn1", nome: "CEMIG", sigla: "CEMIG", estado: "MG", tarifa_kwh: 0.85 },
  { id: "cn2", nome: "CPFL Paulista", sigla: "CPFL", estado: "SP", tarifa_kwh: 0.78 },
  { id: "cn3", nome: "Enel São Paulo", sigla: "ENEL-SP", estado: "SP", tarifa_kwh: 0.82 },
  { id: "cn4", nome: "Light", sigla: "LIGHT", estado: "RJ", tarifa_kwh: 0.92 },
  { id: "cn5", nome: "Copel", sigla: "COPEL", estado: "PR", tarifa_kwh: 0.72 },
  { id: "cn6", nome: "Celesc", sigla: "CELESC", estado: "SC", tarifa_kwh: 0.68 },
  { id: "cn7", nome: "Energisa MT", sigla: "ENERGISA", estado: "MT", tarifa_kwh: 0.88 },
  { id: "cn8", nome: "Equatorial GO", sigla: "EQUATORIAL", estado: "GO", tarifa_kwh: 0.80 },
];

// ─── Bancos ──────────────────────────────────────────────
export const MOCK_BANCOS: MockBanco[] = [
  { id: "b1", nome: "BV Financeira", taxa_mensal: 1.49, max_parcelas: 120, carencia_meses: 3 },
  { id: "b2", nome: "Santander", taxa_mensal: 1.29, max_parcelas: 96, carencia_meses: 6 },
  { id: "b3", nome: "Sicredi", taxa_mensal: 1.19, max_parcelas: 84, carencia_meses: 0 },
  { id: "b4", nome: "Sol Agora (BNB)", taxa_mensal: 0.95, max_parcelas: 72, carencia_meses: 12 },
  { id: "b5", nome: "Caixa Solar", taxa_mensal: 1.05, max_parcelas: 60, carencia_meses: 0 },
];

// ─── Módulos ──────────────────────────────────────────────
export const MOCK_MODULOS: MockModulo[] = [
  { id: "m1", fabricante: "Canadian Solar", modelo: "HiKu7 CS7L-600MS", potencia_wp: 600, eficiencia: 21.8, tipo: "Mono PERC" },
  { id: "m2", fabricante: "Jinko Solar", modelo: "Tiger Neo N-type 580W", potencia_wp: 580, eficiencia: 22.3, tipo: "N-Type TOPCon" },
  { id: "m3", fabricante: "Trina Solar", modelo: "Vertex S+ TSM-445NEG9R.28", potencia_wp: 445, eficiencia: 21.5, tipo: "N-Type" },
  { id: "m4", fabricante: "LONGi", modelo: "Hi-MO 7 LR5-72HTH-570M", potencia_wp: 570, eficiencia: 22.5, tipo: "HJT" },
  { id: "m5", fabricante: "JA Solar", modelo: "JAM72S30-550/MR", potencia_wp: 550, eficiencia: 21.3, tipo: "Mono PERC" },
];

// ─── Inversores ──────────────────────────────────────────
export const MOCK_INVERSORES: MockInversor[] = [
  { id: "i1", fabricante: "Growatt", modelo: "MIN 6000TL-X", potencia_kw: 6.0, tipo: "String", mppt: 2, fases: "Monofásico" },
  { id: "i2", fabricante: "Solis", modelo: "S5-GR1P8K", potencia_kw: 8.0, tipo: "String", mppt: 2, fases: "Monofásico" },
  { id: "i3", fabricante: "Huawei", modelo: "SUN2000-10KTL-M1", potencia_kw: 10.0, tipo: "String", mppt: 2, fases: "Trifásico" },
  { id: "i4", fabricante: "Fronius", modelo: "Symo GEN24 10.0 Plus", potencia_kw: 10.0, tipo: "Híbrido", mppt: 2, fases: "Trifásico" },
  { id: "i5", fabricante: "Deye", modelo: "SUN-12K-SG04LP3", potencia_kw: 12.0, tipo: "Híbrido", mppt: 2, fases: "Trifásico" },
  { id: "i6", fabricante: "Hoymiles", modelo: "HMS-2000-4T", potencia_kw: 2.0, tipo: "Microinversor", mppt: 4, fases: "Monofásico" },
];

// ─── Kit Presets ──────────────────────────────────────────
export function generateKits(potenciaKwp: number): MockKit[] {
  return [
    {
      id: "kit-economy",
      tier: "economy",
      label: "Econômico",
      modulo: MOCK_MODULOS[4], // JA Solar 550W
      inversor: MOCK_INVERSORES[0], // Growatt 6kW
      precoBase_kwp: 3200,
      degradacao25: 14.8,
      roiAnos: 4.2,
      garantiaModulo: 25,
      garantiaInversor: 10,
    },
    {
      id: "kit-standard",
      tier: "standard",
      label: "Performance",
      modulo: MOCK_MODULOS[1], // Jinko 580W
      inversor: MOCK_INVERSORES[2], // Huawei 10kW
      precoBase_kwp: 4100,
      degradacao25: 12.5,
      roiAnos: 4.8,
      garantiaModulo: 30,
      garantiaInversor: 10,
    },
    {
      id: "kit-premium",
      tier: "premium",
      label: "Premium",
      modulo: MOCK_MODULOS[3], // LONGi HJT 570W
      inversor: MOCK_INVERSORES[3], // Fronius Hybrid
      precoBase_kwp: 5400,
      degradacao25: 10.2,
      roiAnos: 5.5,
      garantiaModulo: 30,
      garantiaInversor: 12,
    },
  ];
}

// ─── Helpers ──────────────────────────────────────────────

export const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

export const SEASON_FACTORS = [1.15, 1.10, 1.05, 0.95, 0.85, 0.80, 0.80, 0.85, 0.95, 1.05, 1.10, 1.15];

export const TELHADO_OPTIONS = [
  { value: "fibrocimento", label: "Fibrocimento", icon: "🏗️" },
  { value: "metalico", label: "Metálico", icon: "🏭" },
  { value: "laje", label: "Laje", icon: "🏢" },
  { value: "ceramico", label: "Cerâmico", icon: "🏠" },
  { value: "solo", label: "Solo", icon: "🌱" },
] as const;

export const ORIENTACAO_OPTIONS = [
  { value: "N", label: "Norte", fator: 1.00, desc: "Ideal" },
  { value: "NE", label: "Nordeste", fator: 0.95, desc: "Ótimo" },
  { value: "NO", label: "Noroeste", fator: 0.95, desc: "Ótimo" },
  { value: "L", label: "Leste", fator: 0.88, desc: "Bom" },
  { value: "O", label: "Oeste", fator: 0.88, desc: "Bom" },
  { value: "S", label: "Sul", fator: 0.75, desc: "Regular" },
] as const;

export const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
