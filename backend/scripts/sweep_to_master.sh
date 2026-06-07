#!/usr/bin/env bash
# sweep_to_master.sh — manually trigger a sweep from a sub-account to master
#
# Usage:
#   ./scripts/sweep_to_master.sh <quidax_user_id> <currency>
#
# Example:
#   ./scripts/sweep_to_master.sh wudqy0y3 usdt
#
# Reads QUIDAX_SECRET_KEY and QUIDAX_BASE_URL from the environment (or .env).

set -euo pipefail

QUIDAX_USER_ID="${1:?Usage: $0 <quidax_user_id> <currency>}"
CURRENCY="${2:?Usage: $0 <quidax_user_id> <currency>}"
CURRENCY_LOWER=$(echo "$CURRENCY" | tr '[:upper:]' '[:lower:]')

# Load .env if vars not already set
if [[ -z "${QUIDAX_SECRET_KEY:-}" && -f .env ]]; then
  export $(grep -E '^QUIDAX_(SECRET_KEY|BASE_URL)=' .env | xargs)
fi

BASE_URL="${QUIDAX_BASE_URL:-https://openapi.quidax.io/exchange-open-api/api/v1}"
SECRET_KEY="${QUIDAX_SECRET_KEY:?QUIDAX_SECRET_KEY is not set}"

echo "==> Fetching wallet balance for user=$QUIDAX_USER_ID currency=$CURRENCY_LOWER"

BALANCE_RESP=$(curl -sf -X GET \
  "${BASE_URL}/users/${QUIDAX_USER_ID}/wallets/${CURRENCY_LOWER}" \
  -H "Authorization: Bearer ${SECRET_KEY}" \
  -H "Content-Type: application/json")

echo "Balance response: $BALANCE_RESP"

BALANCE=$(echo "$BALANCE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['balance'])" 2>/dev/null || echo "")

if [[ -z "$BALANCE" || "$BALANCE" == "0" || "$BALANCE" == "0.0" ]]; then
  echo "ERROR: Could not parse balance or balance is zero"
  exit 1
fi

# Truncate to 2 decimal places (no rounding)
TRUNCATED=$(python3 -c "from decimal import Decimal, ROUND_DOWN; print(str(Decimal('${BALANCE}').quantize(Decimal('0.01'), rounding=ROUND_DOWN)))")

echo "==> Balance: $BALANCE  →  Truncated: $TRUNCATED"

REF="sweep_manual:$(date +%s)"

echo "==> Submitting withdrawal of $TRUNCATED $CURRENCY_LOWER to master (fund_uid=1kzdlfkp)"

WITHDRAW_RESP=$(curl -sf -X POST \
  "${BASE_URL}/users/${QUIDAX_USER_ID}/withdraws" \
  -H "Authorization: Bearer ${SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"currency\": \"${CURRENCY_LOWER}\",
    \"amount\": \"${TRUNCATED}\",
    \"fund_uid\": \"1kzdlfkp\",
    \"transaction_note\": \"Manual sweep to master\",
    \"reference\": \"${REF}\"
  }")

echo "Withdrawal response: $WITHDRAW_RESP"

STATUS=$(echo "$WITHDRAW_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null || echo "")

if [[ "$STATUS" == "success" ]]; then
  ID=$(echo "$WITHDRAW_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null || echo "?")
  echo "==> Sweep initiated. Withdrawal ID: $ID  Reference: $REF"
else
  echo "ERROR: Withdrawal failed"
  exit 1
fi
