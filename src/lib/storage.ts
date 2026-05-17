export const getStorageBucket = (origem: string): string => {
  const map: Record<string, string> = {
    'campo_customizado': 'projeto-documentos',
    'projeto': 'projeto-documentos',
    'credito': 'credit-documents',
    'gerado': 'generated-documents',
    'solarmarket': 'imported-files',
    'recibo': 'recibos',
  };

  return map[origem] ?? 'projeto-documentos';
};
