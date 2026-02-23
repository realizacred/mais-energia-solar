# ♻️ Checklist de Regressão

**Data:** 2026-02-23  
**Uso:** Executar antes de cada deploy para produção

---

## 🔴 P0 — Bloqueante (impede deploy)

- [ ] **Login/Auth**: Usuário consegue logar e ver dashboard correto
- [ ] **Tenant Isolation**: Dados de um tenant NÃO aparecem para outro
- [ ] **Criar Lead**: Formulário público cria lead com tenant_id correto
- [ ] **Criar Cliente**: Conversão lead→cliente preserva dados
- [ ] **Criar Projeto**: Projeto vinculado ao cliente correto
- [ ] **Criar Proposta**: Proposta com cálculo de valores correto
- [ ] **Gerar PDF**: PDF da proposta gera sem erro
- [ ] **RLS Funcional**: Queries retornam apenas dados do tenant logado
- [ ] **Edge Functions respondendo**: Webhook Evolution, process-webhook-events, send-wa-message retornam 200
- [ ] **WhatsApp**: Mensagem enviada aparece na conversa
- [ ] **Comissões**: Cálculo correto com plano ativo

## 🟠 P1 — Importante (pode adiar 24h)

- [ ] **Dashboard Vendedor**: Widgets carregam sem erro
- [ ] **Dashboard Admin**: Métricas e gráficos renderizam
- [ ] **Simulação**: Cálculo de economia coerente
- [ ] **Checklist Cliente**: Criar, preencher, enviar
- [ ] **Checklist Instalador**: Criar, avançar fases
- [ ] **Calendário**: Criar agendamento, visualizar na agenda
- [ ] **Pipeline/Kanban**: Mover cards entre colunas
- [ ] **Busca de CEP**: ViaCEP preenche endereço
- [ ] **Upload de arquivos**: Upload funciona, URL salva corretamente
- [ ] **Formatação**: CPF, CNPJ, telefone, BRL formatados corretamente
- [ ] **Notificações**: Toast aparece em ações críticas
- [ ] **Paginação**: Listas com muitos itens pagina corretamente

## 🟡 P2 — Desejável (pode adiar 1 semana)

- [ ] **Dark Mode**: Cores e contraste corretos
- [ ] **Responsividade 375px**: Layout não quebra em mobile
- [ ] **Acessibilidade**: Tab navigation funcional nos formulários
- [ ] **Gamificação**: Conquistas e ranking visíveis
- [ ] **Filtros avançados**: Filtros de leads/clientes funcionam
- [ ] **Exportação Excel**: Download funciona com dados corretos
- [ ] **Site institucional**: Páginas públicas carregam
- [ ] **Calculadora pública**: Cálculo funciona sem login
- [ ] **Favoritos sidebar**: Salvar e remover favoritos
- [ ] **Onboarding/Tour**: Joyride inicia corretamente

---

## Como usar

1. **Antes de deploy**: Execute todos os P0. Se algum falhar → **NÃO faça deploy**.
2. **P1 falhou**: Deploy pode ir, mas criar ticket para corrigir em 24h.
3. **P2 falhou**: Documentar e agendar para próximo sprint.

## Automação futura

Os itens P0 devem ser convertidos em testes E2E (Playwright) para execução automática no CI/CD.
