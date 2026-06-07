"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Bot, Zap, TrendingUp, Activity, AlertCircle, Loader2,
  Play, Pause, Clock, BarChart2, RefreshCw, CheckCircle2, Cpu,
} from "lucide-react";
import { agentService, Agent, AgentDecision, AgentPerformance, MarketContext, SubmitDecisionRequest } from "@/services/agent.service";
import { useQvac } from "@/context/QvacContext";
import { getErrorMessage } from "@/utils/errorHandler";

// ── constants / helpers ─────────────────────────────────────────────────────

const PRIMARY = "#4472B7";

function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: PRIMARY }} />;
}

const fmt2 = (v: string | number) =>
  parseFloat(String(v)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
};

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; dot: string }> = {
    active:     { bg: "bg-green-50",  text: "text-green-700", dot: "bg-green-500" },
    paused:     { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
    terminated: { bg: "bg-red-50",    text: "text-red-600",   dot: "bg-red-400"   },
  };
  const c = cfg[status] ?? cfg.paused;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── QVAC inference helpers ───────────────────────────────────────────────────

function buildPrompts(ctx: MarketContext): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an autonomous AI trading agent running locally via QVAC on-device inference. No data leaves the user's device.

Strategy:
- Risk level: ${ctx.strategy.risk_level}
- Max trade size: $${ctx.strategy.max_spend_usd} USD
- Target assets: ${ctx.strategy.target_assets.join(", ")}

Rules:
1. conservative — only trade on very high confidence signals, prefer stablecoins.
2. moderate — balance risk and reward, trade when signals are clear.
3. aggressive — seek alpha, trade frequently with full conviction.

Respond ONLY with a JSON object. No markdown, no explanation outside the JSON:
{"action":"buy"|"sell"|"hold","asset":"<symbol or empty>","amount_usd":<number>,"reasoning":"<one sentence>"}

For "hold" set asset to "" and amount_usd to 0.`;

  const priceLines = Object.entries(ctx.prices_usd)
    .map(([a, p]) => `  ${a}: $${p.toFixed(4)}`)
    .join("\n");

  const tradeLines =
    ctx.recent_trades.length > 0
      ? ctx.recent_trades
          .map(t => `  ${t.action} ${t.asset} $${t.amount_usd.toFixed(2)} (PnL: $${t.pnl_usd.toFixed(2)})`)
          .join("\n")
      : "  No recent trades — this is the first cycle.";

  const userPrompt = `=== CYCLE: ${ctx.timestamp} ===
Agent: ${ctx.agent_name}
Lifetime PnL: $${ctx.pnl_usd.toFixed(2)} | Volume: $${ctx.volume_usd.toFixed(2)} | Executed: ${ctx.total_executed}

Live prices (USD):
${priceLines}

Recent trades:
${tradeLines}

Make your decision now.`;

  return { systemPrompt, userPrompt };
}

function parseDecision(
  raw: string,
  maxSpend: number
): { action: "buy" | "sell" | "hold"; asset: string; amount_usd: number; reasoning: string } {
  let text = raw.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

  const d = JSON.parse(text) as Record<string, unknown>;
  const action = (String(d.action ?? "hold")).toLowerCase() as "buy" | "sell" | "hold";
  if (!["buy", "sell", "hold"].includes(action)) throw new Error(`Invalid action: ${action}`);

  let amount = parseFloat(String(d.amount_usd ?? 0)) || 0;
  if (amount > maxSpend) amount = maxSpend;

  return {
    action,
    asset: (String(d.asset ?? "")).toUpperCase(),
    amount_usd: amount,
    reasoning: String(d.reasoning ?? ""),
  };
}

// ── Decision row ─────────────────────────────────────────────────────────────

function DecisionRow({ d }: { d: AgentDecision }) {
  const actionColor =
    d.action === "buy"  ? { text: "text-green-600", bg: "bg-green-50" } :
    d.action === "sell" ? { text: "text-red-600",   bg: "bg-red-50"   } :
                          { text: "text-gray-500",  bg: "bg-gray-50"  };
  const statusDot =
    d.status === "executed" ? "bg-green-400" :
    d.status === "failed"   ? "bg-red-400"   :
    d.status === "skipped"  ? "bg-gray-300"  : "bg-yellow-400";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${actionColor.bg} ${actionColor.text}`}>
        {d.action}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {d.asset && <span className="text-xs font-semibold text-gray-900">{d.asset}</span>}
          {d.action !== "hold" && parseFloat(d.amount_usd) > 0 && (
            <span className="text-xs text-gray-500">${fmt2(d.amount_usd)}</span>
          )}
          <span className="ml-auto text-[10px] text-gray-400 shrink-0">{relTime(d.created_at)}</span>
        </div>
        <p className="text-[11px] text-gray-600 leading-snug mb-1 line-clamp-2">{d.reasoning}</p>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          <span className="text-[10px] text-gray-400 capitalize">{d.status}</span>
          <span className="text-[10px] text-gray-300">·</span>
          <Cpu size={9} className="text-gray-400" />
          <span className="text-[10px] text-gray-400">local inference</span>
        </div>
      </div>
    </div>
  );
}

// ── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, positive,
}: {
  label: string; value: string; sub?: string; positive?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-2xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${positive === true ? "text-green-600" : positive === false ? "text-red-500" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [perf, setPerf] = useState<AgentPerformance | null>(null);
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [runError, setRunError] = useState("");
  const [liveDecision, setLiveDecision] = useState<SubmitDecisionRequest | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { complete, status: modelStatus, loadModel, progress } = useQvac();

  const loadAll = useCallback(async () => {
    try {
      const [agentRes, perfRes, decRes] = await Promise.all([
        agentService.getAgent(id),
        agentService.getPerformance(id),
        agentService.listDecisions(id, 1, 20),
      ]);
      setAgent(agentRes.data);
      setPerf(perfRes.data);
      setDecisions(decRes.data.decisions);
      setTotal(decRes.data.pagination.total);
    } catch {
      router.replace("/agents");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const loadMoreDecisions = async () => {
    const nextPage = page + 1;
    try {
      const res = await agentService.listDecisions(id, nextPage, 20);
      setDecisions(prev => [...prev, ...res.data.decisions]);
      setPage(nextPage);
    } catch {}
  };

  useEffect(() => {
    loadAll();
    pollRef.current = setInterval(loadAll, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadAll]);

  const handleRun = async () => {
    if (modelStatus !== "ready") {
      await loadModel();
      return;
    }
    setRunning(true);
    setRunError("");
    try {
      // 1. Fetch market context
      const ctxRes = await agentService.getMarketContext(id);
      const ctx = ctxRes.data;

      // 2. Build prompts + run QVAC inference locally
      const { systemPrompt, userPrompt } = buildPrompts(ctx);
      const rawText = await complete(systemPrompt, userPrompt);

      // 3. Parse decision
      const decision = parseDecision(rawText, ctx.strategy.max_spend_usd);

      // 4. Submit to backend
      const payload: SubmitDecisionRequest = {
        ...decision,
        context_json: JSON.stringify(ctx),
      };
      await agentService.submitDecision(id, payload);

      setLiveDecision(payload);
      await loadAll();
    } catch (e) {
      setRunError(getErrorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  const handleToggle = async () => {
    if (!agent) return;
    setToggling(true);
    try {
      const newStatus = agent.status === "active" ? "paused" : "active";
      const res = await agentService.updateStatus(id, newStatus);
      setAgent(res.data);
    } catch {} finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner size={28} />
      </div>
    );
  }

  if (!agent || !perf) return null;

  const pnl = parseFloat(perf.profit_loss_usd);

  const runLabel =
    modelStatus === "loading" ? `Loading… ${progress}%` :
    modelStatus !== "ready"   ? "Load model first" :
    running                   ? "Running…" : "Run Cycle";

  return (
    <div className="max-w-xl mx-auto pb-10">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition-colors"
      >
        <ArrowLeft size={16} /> Back to Agents
      </button>

      {/* Hero */}
      <div
        className="rounded-2xl p-5 mb-4 text-white"
        style={{ background: "linear-gradient(135deg, #1D3B53 0%, #4472B7 100%)" }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold">{agent.name}</h1>
              {agent.description && <p className="text-xs text-blue-200 mt-0.5">{agent.description}</p>}
              <div className="flex items-center gap-1 mt-1">
                <Cpu size={10} className="text-blue-300" />
                <span className="text-[10px] text-blue-300">QVAC · on-device inference</span>
              </div>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>

        <div className="flex gap-2">
          {agent.status !== "terminated" && (
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
            >
              {toggling ? <Spinner size={12} /> : agent.status === "active" ? <><Pause size={12} />Pause</> : <><Play size={12} />Resume</>}
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={running || agent.status !== "active" || modelStatus === "loading"}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white text-gray-900 flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-50"
          >
            {running ? <Spinner size={12} /> : <><Zap size={12} />{runLabel}</>}
          </button>
          <button onClick={loadAll} className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <RefreshCw size={14} className="text-white" />
          </button>
        </div>

        {runError && (
          <div className="mt-3 flex items-center gap-1.5 text-red-300 text-xs bg-red-900/20 rounded-xl px-3 py-2">
            <AlertCircle size={12} />{runError}
          </div>
        )}
      </div>

      {/* Live decision flash */}
      {liveDecision && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-green-600" />
            <span className="text-xs font-bold text-green-700">QVAC decision complete</span>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-green-600">
              <Cpu size={9} />on-device
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-lg ${liveDecision.action === "buy" ? "bg-green-100 text-green-700" : liveDecision.action === "sell" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}`}>
              {liveDecision.action}
            </span>
            {liveDecision.asset && <span className="text-xs font-semibold">{liveDecision.asset}</span>}
            {liveDecision.amount_usd > 0 && <span className="text-xs text-gray-500">${fmt2(liveDecision.amount_usd)}</span>}
          </div>
          <p className="text-[11px] text-gray-600 mt-1.5">{liveDecision.reasoning}</p>
        </div>
      )}

      {/* Performance metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricCard
          label="Profit / Loss"
          value={`${pnl >= 0 ? "+" : ""}$${fmt2(pnl)}`}
          sub="cumulative USD"
          positive={pnl >= 0}
        />
        <MetricCard
          label="Win Rate"
          value={perf.win_rate}
          sub={`${perf.total_executed} executed`}
        />
        <MetricCard
          label="Total Volume"
          value={`$${fmt2(perf.total_volume_usd)}`}
          sub="USD traded"
        />
        <MetricCard
          label="Decisions"
          value={String(perf.total_decisions)}
          sub={`${perf.total_executed} executed`}
        />
      </div>

      {/* Agent info */}
      {perf.last_cycle_at && (
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="text-xs font-bold text-gray-700 mb-3">Agent Info</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Last cycle</span>
            <span className="text-xs text-gray-600">{relTime(perf.last_cycle_at)}</span>
          </div>
        </div>
      )}

      {/* Decision history */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <Activity size={14} style={{ color: PRIMARY }} />
            <span className="text-sm font-bold text-gray-900">Decision Log</span>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{total}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Clock size={10} /><Cpu size={9} />Local inference log
          </div>
        </div>

        {decisions.length === 0 ? (
          <div className="text-center py-10">
            <BarChart2 size={24} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No decisions yet</p>
            <p className="text-xs text-gray-400 mt-1">Click &quot;Run Cycle&quot; to trigger the first QVAC inference.</p>
          </div>
        ) : (
          <div className="px-4">
            {decisions.map(d => <DecisionRow key={d.id} d={d} />)}
          </div>
        )}

        {decisions.length < total && (
          <div className="px-4 pb-4 pt-2">
            <button
              onClick={loadMoreDecisions}
              className="w-full py-2 rounded-xl text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
