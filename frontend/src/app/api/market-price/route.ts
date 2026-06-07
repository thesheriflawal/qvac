import { NextRequest, NextResponse } from "next/server";

// Tokens available on Bybit P2P with NGN pairs
const BYBIT_P2P_TOKENS = ["USDT", "BTC", "ETH"];
const STABLE_USD: Record<string, number> = { USDT: 1, USDC: 1, BUSD: 1, DAI: 1 };

async function fetchBybitP2PAvg(tokenId: string): Promise<number | null> {
  try {
    const response = await fetch("https://api2.bybit.com/fiat/otc/item/online", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "",
        tokenId,
        currencyId: "NGN",
        payment: [],
        side: "1", // sell side (merchants selling crypto)
        size: "20",
        page: "1",
        amount: "",
      }),
      next: { revalidate: 60 },
    });
    const data = await response.json();
    const items: { price: string }[] = data?.result?.items ?? [];
    if (items.length === 0) return null;
    const prices = items.map((item) => parseFloat(item.price));
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  } catch {
    return null;
  }
}

async function fetchBybitSpotPrice(symbol: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}USDT`,
      { next: { revalidate: 30 } }
    );
    const data = await response.json();
    const price = data?.result?.list?.[0]?.lastPrice;
    return price ? parseFloat(price) : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase();
  const format = request.nextUrl.searchParams.get("format"); // "usd" or default "ngn"
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    // ── USD format: return spot price in USDT (≈ USD) ──────────────────
    if (format === "usd") {
      if (STABLE_USD[symbol] !== undefined) {
        return NextResponse.json({ price: "1", symbol, source: "stable" });
      }
      const spotPrice = await fetchBybitSpotPrice(symbol);
      if (spotPrice === null) {
        return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 });
      }
      return NextResponse.json({
        price: spotPrice.toString(),
        symbol,
        source: "bybit_spot",
      });
    }

    // ── NGN format (default): return NGN price ──────────────────────────
    if (BYBIT_P2P_TOKENS.includes(symbol)) {
      const avg = await fetchBybitP2PAvg(symbol);
      if (avg === null) {
        return NextResponse.json({ error: "No P2P data" }, { status: 500 });
      }
      return NextResponse.json({
        price: Math.round(avg).toString(),
        symbol,
        source: "bybit_p2p",
      });
    }

    // Derive: spot price in USDT × USDT/NGN P2P rate
    const [spotPrice, usdtNgnRate] = await Promise.all([
      fetchBybitSpotPrice(symbol),
      fetchBybitP2PAvg("USDT"),
    ]);

    if (spotPrice === null || usdtNgnRate === null) {
      return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 });
    }

    return NextResponse.json({
      price: Math.round(spotPrice * usdtNgnRate).toString(),
      symbol,
      source: "derived",
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 });
  }
}
