const FIAT_CODES = new Set(["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR"]);

export function getFriendlyTxTitle(tx: any): string {
  const currency = String(tx?.currency || "").toUpperCase();
  const isFiat = FIAT_CODES.has(currency);
  const method = String(tx?.method || tx?.payment_method || "").toLowerCase();
  const typeStr = String(tx?.type || "").toLowerCase();

  // P2P and internal transfers keep a meaningful label
  if (method === "p2p_trade") return "P2P Trade";
  if (method === "internal_transfer") return "Internal Transfer";
  if (method === "referral_reward" || typeStr.includes("referral")) return "Referral Reward";
  if (method === "bonus" || typeStr === "bonus") return "First Trade Bonus";

  // Determine credit/debit direction
  const balBefore = parseFloat(String(tx?.balance_before ?? NaN));
  const balAfter = parseFloat(String(tx?.balance_after ?? NaN));
  const hasBalances = !isNaN(balBefore) && !isNaN(balAfter);
  const debitKws = ["withdrawal", "debit", "transfer_out", "sell", "sent"];
  const isCredit = hasBalances
    ? balAfter >= balBefore
    : !debitKws.some(k => typeStr.includes(k));

  if (isFiat) return isCredit ? "Fiat Deposit" : "Fiat Withdrawal";
  return isCredit ? "Crypto Deposit" : "Crypto Withdrawal";
}
