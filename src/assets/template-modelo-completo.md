# Template de Referência — Proposta Comercial DOCX

Este arquivo serve como referência para criação de templates DOCX
com todas as variáveis disponíveis no sistema de propostas.

Use o formato `[variavel]` no DOCX para substituição automática.

---

## CABEÇALHO

```
PROPOSTA COMERCIAL [proposta_numero]
Data: [proposta_data]
Validade: [proposta_validade]
```

---

## DADOS DO CLIENTE

| Campo | Variável |
|-------|----------|
| Nome | `[cliente_nome]` |
| CPF/CNPJ | `[cliente_cpf_cnpj]` |
| Telefone | `[cliente_celular]` |
| E-mail | `[cliente_email]` |
| Rua | `[cliente_endereco]` |
| Número | `[cliente_numero]` |
| Bairro | `[cliente_bairro]` |
| Cidade | `[cliente_cidade]` |
| Estado | `[cliente_estado]` |
| CEP | `[cliente_cep]` |

---

## DADOS DO SISTEMA

| Campo | Variável |
|-------|----------|
| Potência (kWp) | `[potencia_kwp]` |
| Qtd Módulos | `[modulo_quantidade]` |
| Fabricante Módulo | `[modulo_fabricante]` |
| Modelo Módulo | `[modulo_modelo]` |
| Potência Módulo (Wp) | `[modulo_potencia]` |
| Fabricante Inversor | `[inversor_fabricante]` |
| Modelo Inversor | `[inversor_modelo]` |
| Potência Inversor (kW) | `[inversor_potencia_kw]` |
| Tipo de Telhado | `[tipo_telhado]` |
| Área Útil (m²) | `[area_util]` |
| Geração Mensal (kWh) | `[geracao_mensal]` |
| Geração Anual (kWh) | `[geracao_anual]` |
| Consumo Mensal (kWh) | `[consumo_mensal]` |

---

## ANÁLISE FINANCEIRA

| Campo | Variável |
|-------|----------|
| Investimento Total | `[preco_total]` |
| Payback (anos) | `[payback_anos]` |
| Payback (meses) | `[payback_meses]` |
| Economia Mensal (R$) | `[economia_mensal]` |
| Economia Anual (R$) | `[economia_anual]` |
| Retorno 25 anos (R$) | `[economia_25_anos]` |
| TIR (%) | `[tir_anual]` |
| ROI 25 anos (%) | `[roi_25_anos]` |

---

## FORMAS DE PAGAMENTO

| Campo | Variável |
|-------|----------|
| Valor à Vista | `[vc_a_vista]` |
| Entrada Financiamento | `[entrada_fin]` |
| Valor Parcela | `[valor_parcela]` |
| Número Parcelas | `[num_parcelas]` |
| Taxa de Juros | `[taxa_juros]` |
| Cartão 12x | `[cartao_12x]` |

---

## CONCESSIONÁRIA / UC

| Campo | Variável |
|-------|----------|
| Concessionária | `[concessionaria_nome]` |
| Nº UC | `[uc_numero]` |
| Tarifa (R$/kWh) | `[tarifa]` |
| Grupo Tarifário | `[grupo_tarifario]` |
| Tensão Rede | `[tensao_rede]` |

---

## DADOS DA EMPRESA

| Campo | Variável |
|-------|----------|
| Nome | `[empresa_nome]` |
| CNPJ | `[empresa_cnpj]` |
| Endereço | `[empresa_endereco]` |
| CEP | `[empresa_cep]` |
| Telefone | `[empresa_telefone]` |
| E-mail | `[empresa_email]` |
| Representante Legal | `[empresa_representante_legal]` |
| Cargo Representante | `[empresa_representante_cargo]` |

---

## CONSULTOR

| Campo | Variável |
|-------|----------|
| Nome | `[consultor_nome]` |
| Telefone | `[consultor_telefone]` |
| E-mail | `[consultor_email]` |

---

## GARANTIAS

| Campo | Variável |
|-------|----------|
| Garantia Módulos (anos) | `[modulo_garantia]` |
| Garantia Inversor (anos) | `[inversor_garantia]` |
| Garantia Serviço (anos) | `[servico_garantia]` |

---

## GERAÇÃO MENSAL

| Mês | Variável |
|-----|----------|
| Janeiro | `[geracao_jan]` |
| Fevereiro | `[geracao_fev]` |
| Março | `[geracao_mar]` |
| Abril | `[geracao_abr]` |
| Maio | `[geracao_mai]` |
| Junho | `[geracao_jun]` |
| Julho | `[geracao_jul]` |
| Agosto | `[geracao_ago]` |
| Setembro | `[geracao_set]` |
| Outubro | `[geracao_out]` |
| Novembro | `[geracao_nov]` |
| Dezembro | `[geracao_dez]` |

---

## ASSINATURA

```
Local e data: [cliente_cidade], [data_hoje]


Cliente: _________________________
[cliente_nome]


Responsável: _________________________
[consultor_nome]
[empresa_nome]
```

---

## GRÁFICOS (Placeholders de imagem)

| Placeholder | Descrição |
|-------------|-----------|
| `[grafico_geracao_mensal]` | Barras de geração por mês |
| `[grafico_economia_mensal]` | Barras de economia por mês |
| `[vc_grafico_de_comparacao]` | Comparação de custos |
| `[s_fluxo_caixa_acumulado_anual]` | Fluxo de caixa acumulado |

---

## NOTAS

1. Variáveis não encontradas no snapshot permanecem como `[nome_da_variavel]`
2. Placeholders de gráfico devem ficar sozinhos em um parágrafo
3. Use fontes Liberation Sans ou Carlito para compatibilidade com LibreOffice
4. Consulte `docs/chart-template-best-practices.md` para regras de gráficos
5. Consulte `docs/docx-template-redesign-guide.md` para boas práticas de layout
