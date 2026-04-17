Vou executar tudo via migration (que aceita INSERTs/UPDATEs), usando uma CTE em uma única transação para resolver os IDs sem precisar substituí-los manualmente.

O enum `projeto_etapa_categoria` tem outros valores. Deixa eu inspecioná-lo:

O enum só aceita `aberto`, `ganho`, `perdido`, `excluido`. Vou usar `aberto` para etapas em andamento e `ganho` para concluídas.

Preciso descobrir a coluna correta de ligação em `solar_market_projects`:

Não há coluna `projeto_id`. A ligação é via `sm_project_id` ? `projetos.snapshot->>'sm_project_id'` (ou pelo lead_id). Vou usar `sm_project_id` armazenado em `snapshot`:

A ligação é via `lead_id`. Vou refazer:

O JOIN via `lead_id` retorna 0. Os projetos SM não foram ligados aos `solar_market_projects` registros. Deixa eu verificar como os projetos SM se relacionam:

Os projetos SM têm `lead_id = NULL` e os `solar_market_projects` também. Não há JOIN possível. Os 490 projetos SM não têm vínculo direto com a tabela staging. Como confirmado na auditoria parte 3, vou simplesmente colocar TODOS os projetos sem etapa em "Aguardando Documentos" — o backfill SM-específico não funciona sem chave de ligação.

Funil "Engenharia" criado com 11 etapas. Resultado do PASSO 3:

| Etapa | Ordem | Total |
|---|---|---|
| **Aguardando Documentos** | 1 | **495** |
| Análise Técnica | 2 | 0 |
| Projeto Elétrico | 3 | 0 |
| Aprovação Concessionária | 4 | 0 |
| Aguardando Equipamentos | 5 | 0 |
| Instalação | 6 | 0 |
| Vistoria | 7 | 0 |
| Homologação | 8 | 0 |
| Sistema em Operação | 9 | 0 |
| Compensação Aceita | 10 | 0 |
| Finalizado | 11 | 0 |

**Observação importante sobre o backfill SM-específico:** Os 490 projetos com `import_source='solar_market'` têm `lead_id = NULL`, e os registros em `solar_market_projects` também têm `lead_id = NULL`. **Não existe coluna de ligação** (`projeto_id`/`sm_project_id`) entre `projetos` e `solar_market_projects`. Por isso o backfill etapa-a-etapa via `sm_stage_name` não foi possível — todos os 495 projetos foram colocados em "Aguardando Documentos".

Os linter warnings (Security Definer Views, search_path) são **pré-existentes** e não foram introduzidos por esta migração.

Funil "Engenharia" criado com 11 etapas. 495 projetos posicionados em "Aguardando Documentos". O backfill por `sm_stage_name` não foi aplicado: não há FK entre `projetos` e `solar_market_projects` (ambos têm `lead_id` nulo).