# Matriz de Regras de Negócio Financeiras (Configuráveis por Tenant)

| Regra | Categoria | Configurável | Default | Impacto | Feature Flag |
|---|---|---|---|---|---|
| **Recibo Automático** | Recibos | Sim | `true` | Emite recibo (PDF) automaticamente ao confirmar pagamento. | `recibos_v2` |
| **Permitir Recibo Avulso** | Recibos | Sim | `true` | Permite emitir recibo sem vínculo direto a um pagamento canônico. | `recibos_v2` |
| **Exigir Justificativa** | Auditoria | Sim | `false` | Obriga preenchimento de motivo ao editar/excluir pagamentos. | `ledger_v1` |
| **Bloquear Edição Pós-Fechamento** | Caixa | Sim | `true` | Impede alterações em pagamentos vinculados a um caixa fechado. | `caixa_v2` |
| **Permitir Excluir Pagamento** | Auditoria | Sim | `false` | Define se pagamentos podem ser deletados (Hard Delete) ou apenas estornados. | `ledger_v1` |
| **Comissão por Aceite** | Comissões | Sim | `false` | Gera comissão no momento do aceite da proposta. | `comissoes_v2` |
| **Comissão por Quitação** | Comissões | Sim | `true` | Libera comissão apenas após a quitação da parcela/pagamento. | `comissoes_v2` |
| **Multi-Caixa** | Caixa | Sim | `false` | Permite múltiplos caixas abertos simultaneamente por tenant. | `caixa_v2` |
| **Exigir Abertura de Caixa** | Caixa | Sim | `false` | Bloqueia recebimentos se não houver um caixa aberto para o operador. | `caixa_v2` |
| **Fechamento Diário Obrigatório** | Caixa | Sim | `false` | Exige que o caixa seja fechado ao final do dia. | `caixa_v2` |
| **Aprovação de Estorno** | Auditoria | Sim | `false` | Exige que um supervisor aprove estornos de pagamentos. | `ledger_v1` |
| **Numeração Automática de Recibos** | Recibos | Sim | `true` | Gera número sequencial anual para cada recibo. | `recibos_v2` |
| **QRCode no Recibo** | Recibos | Sim | `true` | Inclui QRCode para validação de autenticidade no PDF. | `recibos_v2` |
| **Assinatura Digital** | Recibos | Sim | `false` | Habilita assinatura digital (e-CNPJ/e-CPF) no documento. | `recibos_v3` |
| **Envio Automático WhatsApp** | Automação | Sim | `false` | Dispara o recibo via WhatsApp após confirmação. | `automation_v1` |
| **Envio Automático Email** | Automação | Sim | `false` | Dispara o recibo via Email após confirmação. | `automation_v1` |
| **Lock Financeiro (Dias)** | Auditoria | Sim | `0` | Número de dias após o qual um pagamento não pode mais ser editado. | `ledger_v1` |
| **Retenção para Auditoria** | Auditoria | Sim | `true` | Mantém logs de todas as alterações financeiras por 5 anos. | `audit_v1` |
