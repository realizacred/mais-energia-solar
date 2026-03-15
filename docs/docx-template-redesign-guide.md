# Guia de Redesign de Templates DOCX para LibreOffice/Gotenberg

**Data**: 2026-03-15  
**Objetivo**: Eliminar elementos OOXML incompatíveis com LibreOffice e garantir fidelidade de layout na conversão DOCX → PDF.

---

## 1. Por que `wp:anchor` + `behindDoc="1"` é frágil

- O LibreOffice calcula posicionamento de âncoras (`wp:anchor`) com mecanismo diferente do Word.
- `behindDoc="1"` coloca a imagem **atrás do texto** usando coordenadas absolutas (EMU). O LibreOffice frequentemente recalcula essas coordenadas com offsets diferentes, causando deslocamento visível da imagem de fundo.
- Mudança de fonte (métricas diferentes) altera o fluxo do texto, que por sua vez desloca o ponto de ancoragem.
- **Resultado**: imagem de fundo aparece deslocada, cortada, ou sobreposta ao conteúdo.

## 2. Por que `w:txbx` / `w:txbxContent` é frágil

- Caixas de texto flutuantes usam posicionamento absoluto via `wp:anchor` + `wp:posOffset`.
- O LibreOffice interpreta `positionH` e `positionV` com tolerâncias diferentes do Word.
- Quando fontes são substituídas (ex: Calibri → Carlito), as métricas de texto mudam, mas a caixa mantém tamanho fixo — o texto pode transbordar ou deixar espaço vazio.
- **Resultado**: texto cortado, desalinhado, ou com posição incorreta.

## 3. Como substituir TextBox por tabela sem borda

```
ANTES (Word TextBox flutuante):
┌──────────────────────┐
│ [nome_cliente]       │  ← wp:anchor + w:txbxContent
│ [telefone]           │
└──────────────────────┘

DEPOIS (Tabela invisível em fluxo normal):
┌──────────────────────┐
│ [nome_cliente]       │  ← w:tbl com bordas "none"
│ [telefone]           │     posição controlada por célula
└──────────────────────┘
```

**Passos no Word**:
1. Selecione o conteúdo da caixa de texto
2. Delete a caixa de texto
3. Insira uma tabela (1 coluna, N linhas) no mesmo local
4. Defina bordas da tabela como "Nenhuma" (Design → Borders → No Border)
5. Ajuste largura da tabela para ocupar a área desejada
6. Cole o conteúdo nas células

**Vantagem**: tabelas são elementos em fluxo que o LibreOffice renderiza com alta fidelidade.

## 4. Como substituir imagem de fundo por solução estável

### Opção A — Watermark via Header (Recomendado)
1. No Word: Inserir → Cabeçalho → Editar Cabeçalho
2. Inserir a imagem dentro do cabeçalho
3. Definir a imagem como "Atrás do texto" **dentro do header** (mais estável que no body)
4. Posicionar com alinhamento centralizado em relação à página
5. Ajustar transparência se necessário

### Opção B — Marca d'água nativa
1. Design → Marca d'água → Marca d'água personalizada
2. Selecionar imagem
3. Definir escala e lavagem

### Opção C — Cor de fundo de página
1. Se a "imagem de fundo" é apenas uma cor sólida, usar: Design → Cor da Página

**Nota**: Nenhuma dessas opções usa `wp:anchor` no body do documento, eliminando o risco de deslocamento.

## 5. O que evitar em templates DOCX para LibreOffice

| Elemento | Risco | Alternativa |
|----------|-------|-------------|
| `wp:anchor` no body | ALTO — deslocamento de posição | Tabela ou imagem inline |
| `behindDoc="1"` | ALTO — offset inconsistente | Watermark em header |
| `w:txbx` / `w:txbxContent` | ALTO — posição absoluta | Tabela sem borda |
| `w:pict` (VML legado) | MÉDIO — suporte limitado | `w:drawing` (DrawingML) |
| Fontes não-padrão sem embed | ALTO — substituição de métricas | Usar Liberation Sans/Carlito/Caladea ou embedar a fonte |
| Espaçamento via múltiplos Enter | BAIXO — inconsistência | Usar espaçamento de parágrafo (antes/depois) |
| Tabs para alinhar colunas | MÉDIO — métricas de tab stop | Usar tabela |

## 6. Fontes seguras para LibreOffice no container

| Fonte do Word | Substituto Linux | Pacote |
|---------------|------------------|--------|
| Arial | Liberation Sans | fonts-liberation |
| Times New Roman | Liberation Serif | fonts-liberation |
| Calibri | Carlito | fonts-crosextra-carlito |
| Cambria | Caladea | fonts-crosextra-caladea |
| Courier New | Liberation Mono | fonts-liberation |
| Verdana | DejaVu Sans | fonts-dejavu |
| Roboto | Roboto | fonts-roboto |
| Inter | Inter | fonts-inter |

**Recomendação**: Usar preferencialmente **Liberation Sans** ou **Carlito** nos templates para garantir métricas idênticas em Word e LibreOffice.

## 7. Montserrat — Como adicionar de forma estável

O pacote `fonts-montserrat` **não existe** nos repositórios Debian/Ubuntu padrão. Para adicionar:

```dockerfile
# Download oficial do Google Fonts (estável, versionado)
RUN mkdir -p /usr/local/share/fonts/montserrat && \
    curl -sL "https://fonts.google.com/download?family=Montserrat" -o /tmp/montserrat.zip && \
    unzip -o /tmp/montserrat.zip -d /usr/local/share/fonts/montserrat/ && \
    rm /tmp/montserrat.zip && \
    fc-cache -fv
```

**Alternativa mais segura**: Em vez de baixar em build time, copie os arquivos `.ttf` da Montserrat para o repositório e use `COPY` no Dockerfile:

```dockerfile
COPY fonts/Montserrat/ /usr/local/share/fonts/montserrat/
RUN fc-cache -fv
```

Isso elimina dependência de download externo durante o build.
