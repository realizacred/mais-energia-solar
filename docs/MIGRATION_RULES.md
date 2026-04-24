# Regras Mestras - Migração SolarMarket → CRM Nativo

## PRINCÍPIO FUNDAMENTAL

**NADA DO QUE FOR MIGRADO PODE QUEBRAR NADA DO QUE É NATIVO.**

Registros migrados do SolarMarket devem se comportar
EXATAMENTE como registros criados manualmente no sistema.

## REGRA #1 - PARIDADE FUNCIONAL

Toda entidade migrada deve responder a:

- ✅ Abrir detalhe sem erro
- ✅ Aparecer nos kanbans corretos
- ✅ Permitir edição
- ✅ Permitir exclusão
- ✅ Integrar com filtros/buscas
- ✅ Aparecer em relatórios
- ✅ Acionar triggers/automações

Se algo NATIVO funciona, MIGRADO também funciona.

## REGRA #2 - PARIDADE DE DADOS

### Cliente migrado DEVE TER:

- nome (formatado: "João Silva Santos" não "JOAO SILVA SANTOS")
- telefone (formato: "(32) 98888-7777")
- telefone_normalized (só números: "32988887777")
- email (validado ou NULL)
- cpf_cnpj (formatado: "123.456.789-00")
- Endereço SEPARADO: cep, rua, numero, bairro, cidade, estado, complemento
- external_source = 'solarmarket'
- external_id = id original do SM
- origem = 'migração_solarmarket' (ou similar)

### Projeto migrado DEVE TER:

- cliente_id preenchido
- consultor_id preenchido (fallback: user admin do tenant)
- deal_id preenchido (deal criado junto!)
- funil_id + etapa_id (no projeto_funis/projeto_etapas)
- cidade_instalacao, uf_instalacao, cep_instalacao
- valor_total > 0 (quando houver proposta)
- potencia_kwp > 0 (quando houver proposta)
- numero_modulos > 0
- external_source = 'solarmarket'
- external_id

### Proposta migrada DEVE TER:

- projeto_id preenchido
- deal_id preenchido
- ≥1 proposta_versao com:
  * valor_total > 0
  * potencia_kwp > 0
  * payback_meses
  * tir, vpl (se houver)
  * proposta_kit (módulos, inversor, etc)
  * proposta_versao_ucs (consumo, tarifa)

## REGRA #3 - CADEIA OBRIGATÓRIA

Ao migrar um projeto, DEVE criar em cadeia:

1. Cliente (se ainda não existir)
2. Projeto
3. Deal (NOVO - obrigatório para kanban comercial)
4. Vínculos funil/etapa
5. external_entity_links (rastreabilidade)

Propostas do SM geram:

6. Proposta nativa
7. Proposta versão
8. Kit + itens (módulos, inversores)
9. UCs (unidades consumidoras)
10. Custom fields + arquivos

## REGRA #4 - IDEMPOTÊNCIA

Rodar migração N vezes = mesmo resultado final.

- SELECT antes de INSERT
- UPDATE ao invés de duplicar
- external_entity_links como SSOT

## REGRA #5 - FORMATAÇÃO

Ao migrar, aplicar formatação nativa:

- Telefone: remove espaços, formata como "(XX) XXXXX-XXXX"
- CPF: formata como "XXX.XXX.XXX-XX"
- CNPJ: formata como "XX.XXX.XXX/XXXX-XX"
- CEP: formata como "XXXXX-XXX"
- Nome: capitaliza cada palavra
- Email: lowercase + trim

Se valor vier sujo do SM, NORMALIZAR antes de inserir.

## REGRA #6 - VALIDAÇÃO OBRIGATÓRIA

Antes de inserir, validar:

- CPF/CNPJ tem formato válido? Se não, guardar raw em observacoes
- Email tem @ e domínio? Se não, NULL
- Telefone tem 10-11 dígitos? Se não, NULL
- Endereço tem CEP? Se não, marcar como incompleto

## REGRA #7 - FALHAS EXPLÍCITAS

Se migração NÃO CONSEGUIR migrar algo:

- Log em solarmarket_promotion_logs
- Campo items_with_errors > 0
- NÃO inserir registro parcial
- NÃO gravar em estado inconsistente

## REGRA #8 - DUAS TABELAS DE FUNIL (ARQUITETURA)

Sistema tem DOIS sistemas paralelos:

- pipelines + pipeline_stages (para DEALS/comercial)
- projeto_funis + projeto_etapas (para PROJETOS/execução)

Ao migrar:

- deals.pipeline_id → pipelines.id
- deals.stage_id → pipeline_stages.id
- projetos.funil_id → projeto_funis.id
- projetos.etapa_id → projeto_etapas.id

Manter ESPELHO sincronizado: cada pipeline tem
um projeto_funis correspondente.

## REGRA #9 - QUANDO EM DÚVIDA

1. Consultar este documento primeiro
2. Comparar com registro NATIVO do sistema
3. Testar com 1 registro antes de 1000
4. Perguntar antes de assumir

## REGRA #10 - NUNCA FAZER

❌ Criar registro sem deal
❌ Gravar telefone sem formatar
❌ Deixar campos obrigatórios NULL
❌ Duplicar por causa de dedup fraco
❌ Assumir formato de dado sem validar
❌ Fazer mudanças sem testar em 1 registro primeiro

## CHECKLIST DE VALIDAÇÃO

Depois de migrar, validar:

- [ ] Cliente abre detalhe sem erro
- [ ] Projeto aparece em /admin/projetos
- [ ] Card do kanban mostra R$ e kWp
- [ ] Clicando abre detalhe completo
- [ ] Aba Propostas lista as propostas
- [ ] Proposta abre com kit completo
- [ ] Edição funciona
- [ ] Filtros mostram o registro

Se 1 item falhar, PARAR e investigar.

---

REFERÊNCIA: Este documento é atualizado a cada
descoberta durante auditoria/execução.
