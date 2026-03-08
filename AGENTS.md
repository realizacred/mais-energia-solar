Atualize o arquivo existente `AGENTS.md` do projeto para criar a versão mais robusta e clara possível, preservando toda a estrutura boa já existente e melhorando o conteúdo.

IMPORTANTE:
- NÃO criar novos arquivos
- NÃO remover seções importantes já existentes
- NÃO mudar o design system
- NÃO alterar stack
- NÃO quebrar regras já definidas
- APENAS reorganizar, consolidar e fortalecer o AGENTS.md

OBJETIVO DO AGENTS.md:
Garantir que qualquer IA ou desenvolvedor mantenha consistência no frontend, arquitetura de código e integração com o backend.

O arquivo deve continuar focado em:
- padrão visual
- padrão de componentes
- padrão de layout
- organização de código
- regras de segurança para desenvolvimento

---

ADICIONE OU GARANTA QUE EXISTAM AS SEGUINTES SEÇÕES:

### 1. DESIGN SYSTEM
Manter exatamente os padrões atuais:

Stack obrigatória:
React 18  
TypeScript  
Tailwind CSS  
shadcn/ui  
Framer Motion  
Recharts  

Fontes:
Inter (corpo)  
Plus Jakarta Sans (títulos)

Paleta:
Solar Orange `hsl(var(--primary))`
Structural Blue `hsl(var(--secondary))`

Regras:
- nunca usar cores hardcoded
- sempre usar tokens semânticos
- suportar dark mode

---

### 2. DARK MODE

Todos os componentes devem suportar dark mode.

Usar sempre:

bg-background  
text-foreground  
bg-card  
text-card-foreground  
bg-muted  
text-muted-foreground  
border-border  

Nunca usar:

bg-white  
text-black  
text-gray-*  
border-gray-*

---

### 3. COMPONENTES PADRÃO

Sempre reutilizar componentes existentes.

Exemplos obrigatórios:

Card  
Button  
Badge  
Table  
Dialog  
Sheet  

Inputs obrigatórios:

CpfCnpjInput  
AddressFields  
PhoneInput  
DateInput  
CurrencyInput  
UnitInput  

Nunca criar inputs customizados duplicando esses.

---

### 4. TABELAS

Sempre usar o componente Table do shadcn.

Nunca criar tabela usando div.

Tabelas devem:

- suportar hover
- suportar estado vazio
- ter actions via DropdownMenu
- manter layout consistente

---

### 5. GRÁFICOS

Sempre usar Recharts.

Cores devem vir das variáveis:

--primary  
--secondary  
--success  
--warning  
--info  
--destructive  

Nunca usar cores hardcoded.

---

### 6. APROVEITAMENTO DE TELA

O sistema deve usar o máximo da área útil.

Nunca usar:

max-w-4xl  
max-w-3xl  
container mx-auto  

Fora de modais.

Layouts devem usar grids densos.

---

### 7. ANIMAÇÕES

Usar Framer Motion.

Cards e listas devem animar entrada.

Hover deve ser sutil e rápido.

---

### 8. LOADING STATES

Toda tela async deve ter skeleton.

Nunca deixar tela vazia.

---

### 9. PADRÃO DE QUERIES

Nunca fazer query Supabase diretamente em componentes React.

Queries devem ficar em:

src/hooks/

Exemplos:

useLeads  
useProjects  
usePlants  
useMonitorData  

Componentes devem apenas consumir hooks.

---

### 10. SERVIÇOS

Lógica de negócio nunca deve ficar no componente.

Deve ficar em:

src/services/

Responsabilidades:

- integração com APIs
- cálculos de negócio
- transformação de dados
- comunicação com providers externos

---

### 11. TIPOS

Sempre usar tipos gerados do Supabase:

@/integrations/supabase/types

Nunca duplicar interfaces se o tipo já existe.

---

### 12. SAFE QUERY PATTERNS

Sempre que aplicável:

- respeitar tenant isolation
- evitar selects desnecessários
- não quebrar RLS
- não retornar dados excessivos

---

### 13. PADRÃO DE INTEGRAÇÕES

Integrações devem ficar em:

src/services/integrations/

Organizar por provider.

Separar:

client  
mapper  
provider metadata  
health/status  

Nunca misturar integração com UI.

---

### 14. MONITORAMENTO SOLAR

Status das plantas segue padrão único:

offline  
mais de 2h sem comunicação

stale  
mais de 30min sem leitura

warning  
anomalia de geração

ok  
dados atualizados

Nunca calcular status diretamente em componente.

Centralizar lógica.

---

### 15. FORMATADORES

Nunca formatar valores manualmente.

Usar utilitários em:

src/lib/formatters

Exemplos:

formatBRL  
formatKwh  
formatPercent  
formatDateBR  
formatBRLCompact

---

### 16. PRINCÍPIOS DE ENGENHARIA

Seguir sempre:

SRP  
DRY  
SSOT  
KISS  
YAGNI  
SOLID quando aplicável  

Separar UI de lógica de negócio.

Serviços devem concentrar regras e APIs.

Código deve ser:

- simples
- previsível
- testável
- reutilizável

---

### 17. FAIL SAFE RULE

Antes de modificar código:

1. auditar o estado atual
2. entender como já funciona
3. preservar o que está correto
4. alterar apenas o necessário
5. evitar reescrever arquivos sem necessidade

Preferir patches incrementais.

---

### 18. OBJETIVO DO AGENTE

Este arquivo existe para:

- manter consistência visual
- manter consistência arquitetural
- evitar regressões
- permitir desenvolvimento rápido sem bagunça

Toda nova tela ou alteração deve seguir estas regras.

---

RESULTADO FINAL:

Entregar o AGENTS.md completo revisado.

Não explicar.

Não criar novos arquivos.

Não criar documentação paralela.

Apenas devolver o conteúdo final do AGENTS.md.