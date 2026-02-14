# MENUS VALIDATION — Cruzamento Menu ↔ Rotas

**Data:** 2026-02-14

---

## Source of Truth: `navRegistry.ts` (48 itens)

| nav_key | label | group | Rota existe? | Status |
|---|---|---|---|---|
| dashboard | Dashboard | Dashboard | ✅ | OK |
| leads | Leads | Comercial | ✅ | OK |
| pipeline | Pipeline | Comercial | ✅ | OK |
| propostas | Propostas (SM) | Comercial | ✅ | OK |
| propostas-nativas | Gerador de Propostas | Comercial | ✅ | OK |
| followup | Follow-ups | Comercial | ✅ | OK |
| distribuicao | Distribuição | Comercial | ✅ | OK |
| sla-breaches | SLA & Breaches | Comercial | ✅ | OK |
| inteligencia | Inteligência Comercial | Comercial | ✅ | OK |
| inbox | Central WhatsApp | Conversas | ✅ | OK |
| followup-queue | Fila de Follow-ups | Conversas | ✅ | OK |
| followup-wa | Follow-up WhatsApp | Conversas | ✅ | OK |
| clientes | Gestão de Clientes | Clientes | ✅ | OK |
| checklists | Documentação | Clientes | ✅ | OK |
| avaliacoes | Avaliações | Clientes | ✅ | OK |
| servicos | Agenda Técnica | Clientes | ✅ | OK |
| instaladores | Instaladores | Operações | ✅ | OK |
| validacao | Validação | Operações | ✅ | OK |
| tarefas | Tarefas & SLA | Operações | ✅ | OK |
| recebimentos | Recebimentos | Financeiro | ✅ | OK |
| inadimplencia | Inadimplência | Financeiro | ✅ | OK |
| comissoes | Comissões | Financeiro | ✅ | OK |
| engenharia | Engenharia Financeira | Financeiro | ✅ | OK |
| financiamento | Bancos | Financeiro | ✅ | OK |
| vendedores | Consultores | Gestão | ✅ | OK |
| aprovacao | Aprovações | Gestão | ✅ | OK |
| gamificacao | Gamificação | Gestão | ✅ | OK |
| release | Release Notes | Gestão | ✅ | OK |
| diretor | Copilot IA | IA | ✅ | OK |
| integracoes-status | Status das Integrações | Integrações | ✅ | OK |
| wa-instances | Instâncias WhatsApp | Integrações | ✅ | OK |
| whatsapp | WhatsApp API | Integrações | ✅ | OK |
| instagram | Instagram | Integrações | ✅ | OK |
| solarmarket | SolarMarket | Integrações | ✅ | OK |
| webhooks | Webhooks | Integrações | ✅ | OK |
| n8n | Automações | Integrações | ✅ | OK |
| ai-config | Configuração de IA | Integrações | ✅ | OK |
| site-config | Conteúdo & Visual | Site | ✅ | OK |
| site-servicos | Serviços | Site | ✅ | OK |
| obras | Portfólio | Site | ✅ | OK |
| config | Calculadora Solar | Configurações | ✅ | OK |
| lead-status | Status de Leads | Configurações | ✅ | OK |
| motivos-perda | Motivos de Perda | Configurações | ✅ | OK |
| respostas-rapidas | Respostas Rápidas | Configurações | ✅ | OK |
| wa-etiquetas | Etiquetas WhatsApp | Configurações | ✅ | OK |
| equipamentos | Disjuntores & Transf. | Configurações | ✅ | OK |
| modulos | Módulos Fotovoltaicos | Configurações | ✅ | OK |
| inversores-cadastro | Inversores | Configurações | ✅ | OK |
| baterias | Baterias | Configurações | ✅ | OK |
| concessionarias | Concessionárias | Configurações | ✅ | OK |
| menus | Menus | Configurações | ✅ | OK |
| agenda-config | Agenda & Compromissos | Configurações | ✅ | OK |
| loading-config | Loading & Mensagens | Configurações | ✅ | OK |
| tenant-settings | Empresa | Administração | ✅ | OK |
| usuarios | Usuários & Permissões | Administração | ✅ | OK |
| auditoria | Auditoria (Logs) | Administração | ✅ | OK |
| notificacoes-config | Notificações | Administração | ✅ | OK |
| links-instalacao | Links & Captação | Administração | ✅ | OK |
| changelog | Atualizações | Administração | ✅ | OK |
| data-reset | Limpeza de Dados | Administração | ✅ | OK |

## Resultado

- **Links quebrados (menu → rota inexistente):** 0 ✅
- **Menus sem rota:** 0 ✅  
- **Rotas sem menu:** 3 (google-calendar, brand = aliases OK; canais-captacao = pendente)

## Duplicação de Fontes no sidebarConfig.ts

O `sidebarConfig.ts` possui itens hardcoded que são **sobrescritos** pelo `useNavConfig()` que usa o `navRegistry.ts`. O `sidebarConfig.ts` serve apenas como fallback/referência estática. A fonte de verdade é `navRegistry.ts`.

**⚠️ Recomendação:** Considerar remover os itens hardcoded de `sidebarConfig.ts` para evitar divergência futura.
