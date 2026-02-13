#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# check-functions-clean.sh
# Garante que supabase/functions/ contém APENAS arquivos executáveis.
# Arquivos permitidos: index.ts, deno.json, *.ts
# Proibidos: .md, .test.ts, .spec.ts, .json (exceto deno.json), .txt, .log, etc.
# ─────────────────────────────────────────────────────────
set -euo pipefail

FUNCTIONS_DIR="supabase/functions"
ERRORS=0

if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "✅ Diretório $FUNCTIONS_DIR não encontrado — nada a verificar."
  exit 0
fi

# Arquivos proibidos: tudo que NÃO é .ts ou deno.json
while IFS= read -r -d '' file; do
  rel="${file#$FUNCTIONS_DIR/}"

  # Ignorar diretórios e _shared (helpers compartilhados)
  [[ -d "$file" ]] && continue

  basename=$(basename "$file")
  ext="${basename##*.}"

  # Regra 1: deno.json é permitido
  [[ "$basename" == "deno.json" ]] && continue

  # Regra 2: apenas .ts é permitido
  if [[ "$ext" != "ts" ]]; then
    echo "❌ PROIBIDO [$rel] — extensão .$ext não é executável (apenas .ts e deno.json permitidos)"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Regra 3: arquivos de teste não podem estar dentro de functions/
  if [[ "$basename" == *".test.ts" || "$basename" == *".spec.ts" || "$basename" == *"_test.ts" ]]; then
    echo "❌ PROIBIDO [$rel] — arquivo de teste deve ficar em supabase/tests/"
    ERRORS=$((ERRORS + 1))
    continue
  fi

done < <(find "$FUNCTIONS_DIR" -mindepth 2 -type f -print0)

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "🚫 $ERRORS arquivo(s) proibido(s) encontrado(s) em $FUNCTIONS_DIR/"
  echo "   Mova para supabase/docs/, supabase/tests/ ou supabase/scripts/"
  exit 1
else
  echo "✅ Todas as Edge Functions estão limpas — apenas arquivos executáveis."
  exit 0
fi
