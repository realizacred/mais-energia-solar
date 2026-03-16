# Boas Práticas para Templates DOCX com Gráficos

**Data**: 2026-03-16  
**Versão**: 1.0  
**Engine suportado nesta fase**: `rendered_image`

---

## 1. Visão Geral

O sistema detecta placeholders de gráfico no template DOCX (ex: `[grafico_geracao_mensal]`), renderiza o gráfico como PNG a partir dos dados reais da proposta, e injeta a imagem no lugar do placeholder antes de converter para PDF.

---

## 2. Formato do Placeholder

| Onde | Formato |
|------|---------|
| No template DOCX | `[nome_do_grafico]` — com colchetes |
| No banco (`proposal_charts.placeholder`) | `nome_do_grafico` — sem colchetes |
| Comparação interna | Normalizado: lowercase, sem colchetes, espaços → `_` |

---

## 3. Placeholders Suportados (Padrão)

| Placeholder | Gráfico | Fonte de Dados |
|-------------|---------|----------------|
| `[grafico_geracao_mensal]` | Geração Mensal (bar) | `tabelas.geracao_mensal` |
| `[grafico_economia_mensal]` | Economia Mensal (bar) | `tabelas.economia_mensal` |
| `[vc_grafico_de_comparacao]` | Comparação de Custos (bar) | `tabelas.comparacao_investimento` |
| `[s_fluxo_caixa_acumulado_anual]` | Fluxo de Caixa Acumulado (bar) | `tabelas.fluxo_caixa` |

Novos gráficos podem ser criados em **Configurações → Proposta Comercial → Gráficos**.

---

## 4. Regras de Posicionamento

### ✅ Correto — Placeholder sozinho no parágrafo

```
Texto antes do gráfico.

[grafico_geracao_mensal]

Texto depois do gráfico.
```

O placeholder ocupa uma linha inteira, sozinho. O sistema substitui o parágrafo completo pela imagem.

### ✅ Correto — Placeholder em célula de tabela

```
┌───────────────────────────────┐
│ [grafico_geracao_mensal]      │
└───────────────────────────────┘
```

O placeholder pode ficar dentro de uma célula de tabela, **desde que esteja sozinho na célula**. O sistema ajusta a largura da imagem para caber na célula.

### ❌ Incorreto — Placeholder misturado com texto

```
Veja o gráfico [grafico_geracao_mensal] abaixo.
```

O sistema **não injeta** o gráfico neste caso para evitar corrupção do documento. Um warning é registrado no log.

### ❌ Incorreto — Placeholder em header ou footer

```
Header: [grafico_geracao_mensal]
```

Gráficos em header/footer **não são suportados nesta fase**. O sistema registra um warning e ignora.

### ❌ Incorreto — Placeholder quebrado em múltiplos runs

Se o Word dividir o texto `[grafico_geracao_mensal]` em múltiplos "runs" XML (ex: `[grafico_` em um run e `geracao_mensal]` em outro), o placeholder pode não ser detectado.

**Solução**: Ao digitar o placeholder no Word, digite-o de uma vez só. Se necessário, copie e cole o placeholder completo.

---

## 5. O que é Suportado Nesta Fase

| Funcionalidade | Status |
|---------------|--------|
| Gráficos `rendered_image` (PNG) | ✅ Suportado |
| Placeholder isolado em parágrafo | ✅ Suportado |
| Placeholder em célula de tabela | ✅ Suportado |
| Múltiplos gráficos no mesmo template | ✅ Suportado |
| Cores condicionais (positivo/negativo) | ✅ Suportado |
| Gráficos `docx_native` (Word nativo) | ❌ Fase futura |
| Placeholder misturado com texto | ❌ Ignorado (warning) |
| Placeholder em header/footer | ❌ Bloqueado nesta fase |
| Importação Excel para dados | ❌ Fase futura |

---

## 6. Comportamento de Fallback

O sistema **nunca** interrompe a geração da proposta por causa de um gráfico.

| Situação | Comportamento |
|----------|--------------|
| Gráfico não cadastrado no catálogo | Ignorado silenciosamente (pode ser variável normal) |
| Gráfico inativo | Ignorado |
| Engine ≠ `rendered_image` | Skipped + warning |
| Dados ausentes no snapshot | Skipped + warning |
| Dataset vazio | Skipped + warning |
| Placeholder em contexto inseguro (inline/header) | Skipped + warning |
| Erro de renderização | Failed + warning |
| Erro de injeção | Failed + warning |

Em todos os casos, a proposta continua sendo gerada normalmente.

---

## 7. Relatório Técnico na Resposta

A resposta da API inclui um resumo de gráficos:

```json
{
  "charts": {
    "detected": ["grafico_geracao_mensal", "grafico_economia_mensal"],
    "rendered": ["grafico_geracao_mensal"],
    "failed": [],
    "skipped": ["grafico_economia_mensal"],
    "reasons": {
      "grafico_economia_mensal": "data_source \"tabelas.economia_mensal\" empty or missing in snapshot"
    }
  }
}
```

---

## 8. Dimensões do Gráfico

| Parâmetro | Valor Padrão | Descrição |
|-----------|-------------|-----------|
| Largura PNG | 1600px | Alta resolução para impressão |
| Altura PNG | 900px | Proporção 16:9 |
| Largura no DOCX (body) | ~15cm | Ajustado às margens A4 |
| Largura no DOCX (tabela) | ~13.3cm | Margem extra para célula |
| Altura máxima no DOCX | ~20cm | Evita overflow de página |

A proporção original é sempre preservada.

---

## 9. Checklist para o Time

Antes de usar um template com gráficos, verifique:

- [ ] Placeholders estão sozinhos em parágrafos próprios
- [ ] Placeholders estão com colchetes: `[nome]`
- [ ] Gráficos correspondentes estão cadastrados e ativos no catálogo
- [ ] A fonte de dados (`data_source`) existe no snapshot da proposta
- [ ] Se em tabela, a célula tem espaço visual suficiente
- [ ] Não há placeholders de gráfico em headers/footers
- [ ] Template foi testado com o preview antes de usar em produção
