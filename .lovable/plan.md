Refatoração do ProposalWizard.tsx para arquitetura baseada em WizardContext.

**FASE A — Mapeamento de Estados e Funções**

1. **Props do ProposalWizard.tsx:**
   - O componente não recebe props externas significativas (é o ponto de entrada principal via rotas).

2. **Estados Identificados (WizardSnapshot):**
   - **Localização:** `locEstado`, `locCidade`, `locTipoTelhado`, `locDistribuidoraId`, `locDistribuidoraNome`, `locIrradiacao`, `locGhiSeries`, `locSkipPoa`, `locLatitude`, `distanciaKm`, `projectAddress`, `mapSnapshots`.
   - **Cliente:** `selectedLead`, `cliente`, `clienteMunicipioIbgeCodigo`.
   - **Sistema/UCs:** `ucs`, `grupo`, `potenciaKwp`, `preDimensionamento`, `premissas`.
   - **Custom Fields:** `customFieldValues`.
   - **Kit:** `itens`, `manualKits`, `selectedManualIdx`.
   - **Adicionais/Layouts:** `adicionais`, `layouts`.
   - **Serviços:** `servicos`.
   - **Venda:** `venda`, `precoFinal` (derivado).
   - **Pagamento:** `pagamentoOpcoes`.
   - **Proposta/Geração:** `step`, `nomeProposta`, `descricaoProposta`, `templateSelecionado`, `generating`, `rendering`, `result`, `htmlPreview`, `pdfBlobUrl`, `docxBlob`, `outputDocxPath`, `outputPdfPath`, `generationStatus`, `generationError`, `missingVars`, `generationAuditReport`.
   - **Controle:** `savedPropostaId`, `savedVersaoId`, `savedProjetoId`, `savedDealId`, `savedClienteId`, `isRestoring`, `showPosDialog`, `showGateModal`, `showBlockModal`, etc.

3. **Funções Handler e Lógica:**
   - `handleItensChange`: Sincroniza itens e custo_kit_override.
   - `handleUcsChange`: Gerencia lista de UCs e gatilhos de sincronização.
   - `collectSnapshot`: Reúne todos os estados para persistência (incluindo cálculos financeiros).
   - `restoreFromSnapshot`: Hidrata o estado a partir de um snapshot.
   - `handleGenerate`: Orquestra validação, salvamento e chamada da API de geração.
   - `handleSelectLead`: Inicializa dados a partir de um lead.
   - `invalidateProposalCaches`: Limpeza de cache do React Query.
   - `persistAtomic` (via hook): Persistência no banco.

4. **Uso por Steps:**
   - **Estado Compartilhado (Quase tudo):** `precoFinal`, `potenciaKwp`, `geracaoMensalEstimada`, `ucs`, `itens`, `venda`.
   - **Estado Local/Semi-local:** `manualKits` (StepKit), `layouts` (StepAdicionais).

**PRÓXIMOS PASSOS (Aguardando Confirmação):**
- Iniciar a **FASE B** criando o `WizardContext.tsx`.
- Centralizar o gerenciamento desses estados no Context Provider.
- Integrar `useWizardPersistence` e `collectSnapshot` diretamente no Contexto.
- Transformar `ProposalWizard.tsx` em um renderizador limpo.

*Nota técnica: O ProposalWizard.tsx possui atualmente ~3.427 linhas. A meta é reduzir drasticamente o tamanho do arquivo principal, movendo a lógica de estado para o Contexto e os sub-componentes.*