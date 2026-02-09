# Auditoria de Fricção do Vendedor

> Análise prática do fluxo **LEAD → CONTATO → PROPOSTA → FECHAMENTO** no Portal do Vendedor.  
> Data: 2026-02-09 | Modo: Hardening — apenas melhorias simples, sem novas features.

---

## Resumo Executivo

O portal do vendedor tem **boa cobertura funcional**, mas sofre de **sobrecarga de informação no Dashboard** e **fragmentação de ações** entre abas. O vendedor precisa navegar entre 4 abas + dialogs para completar o ciclo de um lead. Os maiores gargalos são:

1. **Dashboard poluído** — gamificação, métricas, calendário, scoring, templates ocupam 80% da tela principal
2. **Ausência de ação rápida** — não há "quick actions" para as 3 ações mais frequentes (ligar, WhatsApp, mudar status)
3. **Conversão Lead→Cliente tem 13+ campos** — formulário pesado para mobile
4. **Follow-up não conecta direto ao WhatsApp Inbox** — exige troca de aba

---

## 1. Criar Lead (via link do vendedor)

**Fluxo atual**: Cliente acessa `/v/:codigo` → preenche wizard 3 etapas → lead criado com `vendedor` vinculado.

| Aspecto | Avaliação |
|---|---|
| Cliques | 8-12 (3 etapas + campos) |
| Tempo estimado | 2-4 min (pelo cliente) |
| Campos desnecessários | Nenhum — wizard é enxuto |
| Confusão | ✅ Baixa — etapas claras |
| Automático? | ✅ Já é — lead code, tenant, vendedor resolvidos |

**Problemas encontrados**: Nenhum crítico.

**Sugestão**: _(nenhuma — fluxo ok)_

---

## 2. Distribuir Lead

**Fluxo atual**: Admin configura regra (round_robin/regional/manual) → lead cai automaticamente ou admin atribui.

| Aspecto | Avaliação |
|---|---|
| Cliques (vendedor) | 0 — automático |
| Tempo | Instantâneo |
| Confusão | ⚠️ Vendedor NÃO recebe notificação visível de "novo lead atribuído" no portal |

### 🟡 MÉDIO: Falta indicador visual de leads novos não vistos

**Problema**: O vendedor precisa ir na aba "Orçamentos", rolar a tabela e verificar checkbox "Visto". Não há badge/contador na aba ou alert visível.

**Solução**: Adicionar badge de contagem de "não vistos" na tab "Orçamentos" (`orcamentos.filter(o => !o.visto).length`). ~10 linhas de código.

---

## 3. Abrir Conversa WhatsApp

**Fluxo atual**: Vendedor pode iniciar WhatsApp de 3 lugares:
- Tabela de orçamentos → ícone 💬 → `ScheduleWhatsAppDialog`
- Detalhe do lead → aba "WhatsApp" → link direto wa.me
- Aba "WhatsApp" → WaInbox (inbox completo)

| Aspecto | Avaliação |
|---|---|
| Cliques até 1ª msg | 3-5 (ir à aba → encontrar lead → clicar → escrever) |
| Tempo | 30-60s |
| Confusão | ⚠️ 3 entry points diferentes, UX inconsistente |

### 🔴 ALTO: WhatsApp da tabela abre Dialog de agendamento, não conversa direta

**Problema**: O botão 💬 na tabela de orçamentos abre `ScheduleWhatsAppDialog` (para agendar envio futuro), não para enviar mensagem agora. O vendedor que quer contato rápido precisa: clicar no olho (ver detalhes) → aba WhatsApp → clicar "Abrir WhatsApp". São **4 cliques** para algo que deveria ser **1 clique**.

**Solução**: O botão 💬 na tabela deveria abrir direto `wa.me/55{telefone}` (link direto). Manter o agendamento como opção secundária (long-press ou menu dropdown). ~15 linhas.

### 🟡 MÉDIO: Aba WhatsApp (WaInbox) não filtra pelo lead selecionado

**Problema**: Se o vendedor está olhando um lead na aba "Orçamentos" e troca para "WhatsApp", o inbox não foca na conversa desse lead. Precisa buscar manualmente.

**Solução**: Ao clicar em "WhatsApp" no detalhe do lead, navegar para aba WhatsApp com filtro pré-aplicado por telefone. ~20 linhas.

---

## 4. Gerar Proposta

**Fluxo atual**: Detalhe do lead → aba "Proposta" → `ProposalGenerator` com slider de parcelas + toggle financiamento → gerar PDF.

| Aspecto | Avaliação |
|---|---|
| Cliques | 4-6 (abrir lead → aba proposta → ajustar → gerar) |
| Tempo | 1-2 min |
| Campos | Razoável — dados puxados do lead automaticamente |
| Confusão | ⚠️ Valores calculados com constantes hardcoded, não da config do admin |

### 🟡 MÉDIO: ProposalGenerator usa constantes locais, ignora `calculadora_config`

**Problema**: `CONFIG` no componente tem valores fixos (`tarifaMediaKwh: 0.85`, `custoPorKwp: 4500`, etc.) ao invés de buscar da tabela `calculadora_config`. Admin configura valores no painel mas a proposta do vendedor ignora.

**Solução**: Usar `get_calculator_config()` RPC no ProposalGenerator. ~20 linhas.

### 🟡 MÉDIO: Bancos de financiamento hardcoded

**Problema**: `FINANCING_OPTIONS` é um array fixo no código. A tabela `financiamento_bancos` existe e o admin pode configurar, mas o ProposalGenerator não lê.

**Solução**: Usar `get_active_financing_banks()` RPC existente. ~10 linhas.

---

## 5. Registrar Perda ou Ganho

### Ganho (Conversão)

**Fluxo atual**: Tabela → botão "Converter" → `ConvertLeadToClientDialog` com **13+ campos** + upload de documentos.

| Aspecto | Avaliação |
|---|---|
| Cliques | 15-25 (todos os campos do formulário) |
| Tempo | 5-10 min |
| Campos desnecessários | ⚠️ Sim — vários opcionais parecem obrigatórios visualmente |

### 🔴 ALTO: Formulário de conversão é intimidador

**Problema**: O dialog `ConvertLeadToClientDialog` tem **1.153 linhas** e apresenta ~15 campos + 3 seções de upload de documentos + seleção de disjuntor/transformador/simulação tudo de uma vez. Para o vendedor mobile, isso é um muro de texto.

**Campos que poderiam ser postergados** (preenchidos depois pelo admin/backoffice):
- `disjuntor_id` — técnico, vendedor geralmente não sabe
- `transformador_id` — técnico
- `localizacao` (GPS) — pode ser coletado na instalação
- `simulacao_aceita_id` — se houver apenas uma, selecionar auto
- `comprovante_beneficiaria` — documento complementar
- Uploads de documentos em geral — podem ser enviados depois

**Solução**: Dividir em 2 etapas: (1) dados essenciais (nome, tel, endereço, valor) — ~5 campos; (2) "completar cadastro" posterior com dados técnicos e docs. ~30 linhas de reorganização visual, sem mudança de schema.

### Perda

**Fluxo atual**: Mudar status para "Perdido" via `OrcamentoStatusSelector` → dialog de motivo de perda abre automaticamente.

| Aspecto | Avaliação |
|---|---|
| Cliques | 3 (select → "Perdido" → selecionar motivo → confirmar) |
| Tempo | 10s |
| Confusão | ✅ Baixa — fluxo bem guiado |

**Sugestão**: _(nenhuma — fluxo ok)_

---

## 6. Follow-up

**Fluxo atual**: Aba "Orçamentos" → seção `VendorFollowUpManager` mostra leads urgentes/pendentes/em dia com badges de dias sem contato.

| Aspecto | Avaliação |
|---|---|
| Visibilidade | ⚠️ Baixa — seção está ENTERRADA sob alertas, docs pendentes, duplicatas e link de compartilhamento |
| Cliques para agir | 3-4 (encontrar lead → clicar → WhatsApp) |
| Automático | ⚠️ Parcial — classifica por urgência mas não notifica proativamente |

### 🔴 ALTO: Follow-up enterrado na aba errada

**Problema**: `VendorFollowUpManager` está dentro da aba "Orçamentos" (linhas 224-232 de VendedorPortal), depois de `LeadAlerts`. O vendedor precisa rolar a aba de orçamentos para encontrar o follow-up. Deveria estar **acima da tabela** ou na **aba Dashboard** com destaque.

**Solução**: Mover `VendorFollowUpManager` + `LeadAlerts` para o topo da aba "Orçamentos", antes dos filtros. Ou melhor: mover para o Dashboard como primeiro card. ~5 linhas de reordenação.

### 🟡 MÉDIO: Ação de follow-up não atualiza `ultimo_contato`

**Problema**: O vendedor clica em "WhatsApp" no follow-up mas o `ultimo_contato` só atualiza quando o STATUS muda (via `LeadStatusSelector`). Se o vendedor apenas envia mensagem sem mudar status, o lead continua aparecendo como "urgente".

**Solução**: Ao abrir WhatsApp do follow-up, chamar update em `leads.ultimo_contato`. ~10 linhas.

---

## 7. Avançar Pipeline

**Fluxo atual**: `OrcamentoStatusSelector` inline na tabela — select dropdown com status coloridos.

| Aspecto | Avaliação |
|---|---|
| Cliques | 2 (abrir select → escolher status) |
| Tempo | 3s |
| Confusão | ✅ Baixa — intuitivo |
| Automático | ✅ `ultimo_contato` atualiza ao mudar status |

**Sugestão**: _(fluxo ok)_

---

## Dashboard — Excesso de Informação

### 🔴 ALTO: Dashboard com 10+ seções visíveis simultaneamente

**Problema**: A aba Dashboard renderiza tudo de uma vez:
1. VendedorShareLink
2. GoalProgressNotifications
3. VendorPersonalDashboard
4. VendorGoals + VendorAchievements (grid 2 cols)
5. VendorLeaderboard
6. AdvancedMetricsCard
7. SyncStatusWidget + NotificationSettings
8. SmartReminders + WhatsAppTemplates
9. FollowUpStatsCards
10. FollowUpCalendar
11. LeadScoring

Isso são **11 componentes** visíveis na mesma tela. O vendedor abre o portal e vê um mural de cards que não consegue priorizar.

**Solução**: Hierarquizar — mover para o topo apenas:
1. Alertas urgentes (leads sem contato)
2. Próximas ações (tasks/agenda)  
3. KPIs pessoais (resumo 3 cards)

Restante (gamificação, leaderboard, scoring, templates) pode ficar em seção colapsável "Ver mais" ou sub-aba. ~20 linhas de layout.

---

## Consolidação por Prioridade

### 🔴 ALTO IMPACTO (resolver primeiro)

| # | Problema | Etapa | Esforço |
|---|---|---|---|
| 1 | Dashboard sobrecarregado — 11 componentes sem hierarquia | Dashboard | ~20 linhas |
| 2 | Botão WhatsApp na tabela abre agendamento, não conversa | Contato | ~15 linhas |
| 3 | Conversão Lead→Cliente com 13+ campos — intimidador no mobile | Ganho | ~30 linhas |
| 4 | Follow-up enterrado no fundo da aba Orçamentos | Follow-up | ~5 linhas |

### 🟡 MÉDIO IMPACTO

| # | Problema | Etapa | Esforço |
|---|---|---|---|
| 5 | Falta badge de "não vistos" na aba Orçamentos | Distribuição | ~10 linhas |
| 6 | ProposalGenerator ignora config do admin (valores hardcoded) | Proposta | ~20 linhas |
| 7 | Bancos de financiamento hardcoded no ProposalGenerator | Proposta | ~10 linhas |
| 8 | Follow-up não atualiza `ultimo_contato` ao abrir WhatsApp | Follow-up | ~10 linhas |
| 9 | WhatsApp Inbox não foca no lead selecionado ao trocar aba | Contato | ~20 linhas |

### 🟢 BAIXO IMPACTO

| # | Problema | Etapa | Esforço |
|---|---|---|---|
| 10 | Vendedor não recebe notificação visual de "novo lead" | Distribuição | ~15 linhas |

---

## Métricas Alvo

| Métrica | Atual (estimado) | Meta |
|---|---|---|
| Tempo até 1º contato (WhatsApp) | 45-60s | <15s |
| Cliques para mudar status | 2 | 2 (ok) |
| Cliques para enviar proposta | 4-6 | 3-4 |
| Campos na conversão | 13+ | 5 essenciais + "completar depois" |
| Componentes visíveis no dashboard | 11 | 3-4 prioritários + expandir |

---

## Próximos Passos

Resolver na ordem de impacto (ALTO → MÉDIO → BAIXO), sem novas tabelas, sem novas features, sem mudança de arquitetura. Todas as soluções são reorganização de UI e conexão de dados existentes.
