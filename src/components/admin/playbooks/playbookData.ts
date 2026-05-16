
export interface Playbook {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  symptoms: string[];
  causes: string[];
  diagnosis: {
    steps: string[];
    sql?: string;
  };
  resolution: string[];
  escalation: string;
  operational_risk: string;
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: "wa-backlog",
    title: "WhatsApp Backlog Alto",
    severity: "critical",
    symptoms: ["Mensagens demoram a sair", "Fila wa_outbox > 100", "Usuários reclamam de atraso"],
    causes: ["Instância WhatsApp offline", "Evolution API instável", "Rate limiting"],
    diagnosis: {
      steps: [
        "Acessar Saúde Operacional",
        "Verificar status das instâncias",
        "Checar latência da Evolution API"
      ],
      sql: "SELECT count(*) FROM wa_outbox WHERE status = 'pending';"
    },
    resolution: [
      "Verificar se o QR Code está conectado",
      "Reiniciar a instância via painel de integrações",
      "Se persistir, verificar logs da Evolution API"
    ],
    escalation: "Contatar Suporte de Infraestrutura se a API Evolution retornar 502/504.",
    operational_risk: "Interrupção total da comunicação com leads."
  },
  {
    id: "pdf-generation-failure",
    title: "Falha na Geração de PDF/DOCX",
    severity: "warning",
    symptoms: ["Erro ao baixar proposta", "Botão de 'Gerar' trava em loading", "Página em branco no PDF"],
    causes: ["Gotenberg fora do ar", "Template com variáveis quebradas", "Imagens pesadas no snapshot"],
    diagnosis: {
      steps: [
        "Verificar logs em Saúde Operacional > Documentos",
        "Testar geração com um template básico (Ex: Simples)",
        "Verificar se o arquivo DOCX de origem existe no Storage"
      ],
      sql: "SELECT id, status, error_message FROM generated_documents WHERE status = 'error' ORDER BY created_at DESC LIMIT 5;"
    },
    resolution: [
      "Limpar variáveis nulas no snapshot da proposta",
      "Reiniciar job de geração",
      "Verificar se o Gotenberg está acessível via Edge Function"
    ],
    escalation: "Escalar para o Arquiteto se for erro de parser de variáveis (Liquid/Handlebars).",
    operational_risk: "Impossibilidade de fechamento de contratos."
  },
  {
    id: "orphan-proposals",
    title: "Propostas Órfãs Detectadas",
    severity: "info",
    symptoms: ["Proposta aparece na listagem geral mas não no projeto", "Divergência de contagem de propostas"],
    causes: ["Exclusão de Deal via banco direto", "Falha em migração legada", "Race condition na criação"],
    diagnosis: {
      steps: ["Acessar Saúde Operacional > Saúde do Tenant", "Verificar contagem de órfãos"],
      sql: "SELECT id, titulo FROM propostas_nativas WHERE deal_id IS NULL AND projeto_id IS NULL AND status != 'excluida';"
    },
    resolution: [
      "Vincular manualmente ao deal_id correto via SQL (se conhecido)",
      "Arquivar a proposta se for lixo de sistema",
      "Utilizar script de sanitização de órfãos"
    ],
    escalation: "Analista de Dados para limpeza de banco.",
    operational_risk: "Inconsistência de dados e confusão para o usuário."
  }
];
