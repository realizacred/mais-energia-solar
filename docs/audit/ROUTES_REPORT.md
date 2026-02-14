# ROUTES REPORT — Auditoria Completa de Rotas

**Data:** 2026-02-14  
**Auditor:** Principal Software Architect

---

## 1. Todas as Rotas Admin (path → componente)

| # | Path (`/admin/...`) | Componente | No Menu? |
|---|---|---|---|
| 1 | `dashboard` | AnalyticsDashboard | ✅ dashboard |
| 2 | `release` | ReleaseChecklist | ✅ release |
| 3 | `leads` | LeadsView | ✅ leads |
| 4 | `pipeline` | LeadsPipeline | ✅ pipeline |
| 5 | `followup` | FollowUpManager | ✅ followup |
| 6 | `propostas` | PropostasManager | ✅ propostas |
| 7 | `propostas-nativas` | ProposalListPage | ✅ propostas-nativas |
| 8 | `propostas-nativas/nova` | ProposalWizardPage | ❌ Sub-rota (OK) |
| 9 | `propostas-nativas/:id/versoes/:vid` | ProposalDetailPage | ❌ Sub-rota (OK) |
| 10 | `aprovacao` | AprovacaoUsuarios | ✅ aprovacao |
| 11 | `lead-status` | LeadStatusManager | ✅ lead-status |
| 12 | `inteligencia` | IntelligenceDashboard | ✅ inteligencia |
| 13 | `distribuicao` | DistributionConfig | ✅ distribuicao |
| 14 | `sla-breaches` | SlaBreachDashboard | ✅ sla-breaches |
| 15 | `motivos-perda` | MotivoPerdaManager | ✅ motivos-perda |
| 16 | `inbox` | WaInbox | ✅ inbox |
| 17 | `respostas-rapidas` | WaQuickRepliesManager | ✅ respostas-rapidas |
| 18 | `followup-wa` | WaFollowupRulesManager | ✅ followup-wa |
| 19 | `followup-queue` | WaFollowupQueuePage | ✅ followup-queue |
| 20 | `wa-etiquetas` | WaTagsManager | ✅ wa-etiquetas |
| 21 | `validacao` | ValidacaoVendasManager | ✅ validacao |
| 22 | `tarefas` | TasksSlaDashboard | ✅ tarefas |
| 23 | `clientes` | ClientesManager | ✅ clientes |
| 24 | `checklists` | ChecklistsManager | ✅ checklists |
| 25 | `avaliacoes` | AvaliacoesManager | ✅ avaliacoes |
| 26 | `servicos` | ServicosManager | ✅ servicos |
| 27 | `instaladores` | InstaladorManager | ✅ instaladores |
| 28 | `recebimentos` | RecebimentosManager | ✅ recebimentos |
| 29 | `inadimplencia` | InadimplenciaDashboard | ✅ inadimplencia |
| 30 | `comissoes` | ComissoesManager | ✅ comissoes |
| 31 | `engenharia` | EngenhariaFinanceiraConfig | ✅ engenharia |
| 32 | `financiamento` | FinanciamentoConfig | ✅ financiamento |
| 33 | `vendedores` | VendedoresManager | ✅ vendedores |
| 34 | `usuarios` | UsuariosManager | ✅ usuarios |
| 35 | `equipamentos` | EquipamentosManager | ✅ equipamentos |
| 36 | `modulos` | ModulosManager | ✅ modulos |
| 37 | `inversores-cadastro` | InversoresManager | ✅ inversores-cadastro |
| 38 | `baterias` | BateriasManager | ✅ baterias |
| 39 | `concessionarias` | ConcessionariasManager | ✅ concessionarias |
| 40 | `config` | CalculadoraConfig | ✅ config |
| 41 | `gamificacao` | GamificacaoConfig | ✅ gamificacao |
| 42 | `loading-config` | LoadingConfigAdmin | ✅ loading-config |
| 43 | `agenda-config` | AgendaConfigPage | ✅ agenda-config |
| 44 | `diretor` | CommercialDirectorDashboard | ✅ diretor |
| 45 | `wa-instances` | WaInstancesManager | ✅ wa-instances |
| 46 | `whatsapp` | WhatsAppAutomationConfig | ✅ whatsapp |
| 47 | `instagram` | InstagramConfig | ✅ instagram |
| 48 | `solarmarket` | SolarMarketManager | ✅ solarmarket |
| 49 | `webhooks` | WebhookManager | ✅ webhooks |
| 50 | `n8n` | N8nPlaceholder | ✅ n8n |
| 51 | `google-calendar` | AgendaConfigPage | ❌ **OCULTA** (alias) |
| 52 | `ai-config` | AiConfigPage | ✅ ai-config |
| 53 | `site-config` | SiteSettingsUnified | ✅ site-config |
| 54 | `brand` | SiteSettingsUnified | ❌ **OCULTA** (alias) |
| 55 | `site-servicos` | SiteServicosManager | ✅ site-servicos |
| 56 | `obras` | ObrasManager | ✅ obras |
| 57 | `tenant-settings` | TenantSettings | ✅ tenant-settings |
| 58 | `auditoria` | AuditLogsViewer | ✅ auditoria |
| 59 | `data-reset` | DataResetManager | ✅ data-reset |
| 60 | `integracoes-status` | IntegrationStatusPage | ✅ integracoes-status |
| 61 | `canais-captacao` | CanaisCaptacaoPage | ❌ **OCULTA** — sem menu |
| 62 | `links-instalacao` | LinksInstalacaoPage | ✅ links-instalacao |
| 63 | `changelog` | ChangelogViewer | ✅ changelog |
| 64 | `notificacoes-config` | NotificationConfigAdmin | ✅ notificacoes-config |
| 65 | `menus` | MenuConfigPage | ✅ menus |

## 2. Rotas Ocultas (existem mas não aparecem no menu)

| Rota | Motivo | Ação |
|---|---|---|
| `google-calendar` | Alias para AgendaConfigPage (unificado) | 🟢 OK — manter para retrocompatibilidade |
| `brand` | Alias para SiteSettingsUnified | 🟢 OK — manter para retrocompatibilidade |
| `canais-captacao` | **Sem item no navRegistry** | 🟡 ATENÇÃO — avaliar se deve ter menu ou ser removida |
| `propostas-nativas/nova` | Sub-rota de wizard | 🟢 OK |
| `propostas-nativas/:id/versoes/:vid` | Sub-rota de detalhe | 🟢 OK |

## 3. Itens de Menu SEM Rota Correspondente

**Nenhum encontrado.** ✅ Todos os 48 nav_keys no navRegistry têm rota correspondente.

## 4. Componentes Órfãos (existem em disco mas não são importados)

| Arquivo | Referências | Status |
|---|---|---|
| `SiteConfigManager.tsx` | 0 imports | 🔴 DELETAR |
| `propostas-nativas/index.ts` | 0 imports (barrel não usado) | 🟡 DELETAR |

---

**Veredito:** 🟢 Rotas e menus estão **98% consistentes**. Pendências menores: `canais-captacao` sem menu e 2 arquivos órfãos.
