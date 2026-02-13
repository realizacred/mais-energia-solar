#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# check-imports-pinned.sh
# Detecta imports esm.sh sem versão exata (ex: @2 ao invés de @2.49.4).
#
# Modos:
#   --strict   (CI/produção) → falha em qualquer import sem pin exato
#   --warn     (dev/Lovable) → apenas avisa, exit 0
#
# Uso:
#   bash supabase/scripts/check-imports-pinned.sh --strict
#   bash supabase/scripts/check-imports-pinned.sh --warn
# ─────────────────────────────────────────────────────────
set -euo pipefail

MODE="${1:---strict}"
FUNCTIONS_DIR="supabase/functions"
ERRORS=0
WARNINGS=0

if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "✅ Diretório $FUNCTIONS_DIR não encontrado — nada a verificar."
  exit 0
fi

# Regex: esm.sh imports com versão flutuante (ex: @2" ou @2/) ao invés de exata (ex: @2.49.4)
# Padrão flutuante: @<major>" ou @<major>/ sem .<minor>
FLOAT_PATTERN='esm\.sh/[^"]*@[0-9]+["/?]'
# Padrão sem versão alguma
NO_VERSION_PATTERN='esm\.sh/[^@"]+["?]'

while IFS= read -r -d '' file; do
  rel="${file#./}"

  # Check floating version (@2, @3, etc. sem minor)
  while IFS= read -r line; do
    lineno=$(echo "$line" | cut -d: -f1)
    content=$(echo "$line" | cut -d: -f2-)
    echo "⚠️  IMPORT SEM PIN EXATO [$rel:$lineno] $content"
    WARNINGS=$((WARNINGS + 1))
  done < <(grep -n -E "$FLOAT_PATTERN" "$file" 2>/dev/null || true)

  # Check no version at all
  while IFS= read -r line; do
    lineno=$(echo "$line" | cut -d: -f1)
    content=$(echo "$line" | cut -d: -f2-)
    echo "❌ IMPORT SEM VERSÃO [$rel:$lineno] $content"
    ERRORS=$((ERRORS + 1))
  done < <(grep -n -E "$NO_VERSION_PATTERN" "$file" 2>/dev/null || true)

done < <(find "$FUNCTIONS_DIR" -name "*.ts" -type f -print0)

echo ""
echo "━━━ Resultado ━━━"
echo "  Sem versão (crítico): $ERRORS"
echo "  Versão flutuante:     $WARNINGS"

if [ "$ERRORS" -gt 0 ]; then
  echo "🚫 $ERRORS import(s) sem versão — DEVE corrigir antes de deploy."
  exit 1
fi

if [ "$WARNINGS" -gt 0 ]; then
  if [ "$MODE" = "--strict" ]; then
    echo "🚫 $WARNINGS import(s) com versão flutuante — proibido em produção."
    echo "   Use versão exata: @2.49.4 ao invés de @2"
    echo "   Ou migre para npm: specifier com deno.json import map."
    exit 1
  else
    echo "⚠️  $WARNINGS import(s) com versão flutuante — aceitável em dev (Lovable workaround)."
    echo "   Em produção, use: supabase functions deploy (com npm: specifier + lockfile)"
    exit 0
  fi
fi

echo "✅ Todos os imports estão com versão exata."
exit 0
