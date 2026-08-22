#!/usr/bin/env bash
# Полная сверка нашего парсера с чужими реализациями cron.
# Часовой пояс фиксируем: cron считает по настенным часам, и сравнивать ответы
# двух библиотек в разных поясах бессмысленно.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
export TZ=UTC

echo "== собираем парсер в CommonJS =="
npx esbuild "$ROOT/src/utils/cron-parser.ts" --bundle --format=cjs --platform=node \
  --outfile="$HERE/cron-parser.cjs" >/dev/null

echo "== ставим чужие библиотеки (не попадают в зависимости приложения) =="
npm install --no-save --prefix "$HERE" cron-parser@5 croner@10 >/dev/null 2>&1

PY="${PY:-python3}"
if ! "$PY" -c "import croniter" 2>/dev/null; then
  echo "нет croniter — ставлю в $HERE/venv"
  "$PY" -m venv "$HERE/venv"
  "$HERE/venv/bin/pip" install --quiet croniter
  PY="$HERE/venv/bin/python"
fi

echo "== считаем нашим кодом =="
node "$HERE/cases.cjs"

echo "== считаем croniter =="
"$PY" "$HERE/croniter-out.py"

echo "== сравниваем =="
NODE_PATH="$HERE/node_modules" node "$HERE/compare.cjs"

echo "== проверяем ожидания, вписанные руками в тесты =="
NODE_PATH="$HERE/node_modules" node "$HERE/verify-test-expectations.cjs" \
  "$ROOT/src/utils/__tests__/cron-parser.test.ts"
