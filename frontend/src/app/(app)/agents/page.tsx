"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, Plus, TrendingUp, Activity, ChevronRight, X, Loader2,
  AlertCircle, Play, Pause, Zap, Cpu, Download, CheckCircle2,
} from "lucide-react";
import {
  agentService, Agent, CreateAgentRequest, MarketContext, SubmitDecisionRequest,
} from "@/services/agent.service";
import { useQvac } from "@/context/QvacContext";
import { getErrorMessage } from "@/utils/errorHandler";

// ── constants / helpers ─────────────────────────────────────────────────────

const PRIMARY = "#4472B7";

const fmt2 = (v: string | number) =>
  parseFloat(String(v)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: PRIMARY }} />;
}

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

const RISK_CFG = {
  conservative: { color: "text-blue-600",  bg: "bg-blue-50",  label: "Conservative" },
  moderate:     { color: "text-amber-600",  bg: "bg-amber-50", label: "Moderate"     },
  aggressive:   { color: "text-red-600",    bg: "bg-red-50",   label: "Aggressive"   },
};

const ALL_ASSETS = ["BTC", "ETH", "USDT", "USDC", "SOL", "BNB", "AVAX"];

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

// ── QVAC Model Banner ────────────────────────────────────────────────────────

function QvacModelBanner() {
  const { status, progress, error, loadModel } = useQvac();

  if (status === "ready") {
    return (
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-[11px] font-medium px-2.5 py-1 rounded-full border border-green-100">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          QVAC · Local model ready
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-[11px] font-medium px-2.5 py-1 rounded-full border border-blue-100">
          <Cpu size={10} />Edge inference · on-device
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="mb-4 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 size={13} className="animate-spin text-blue-600" />
          <span className="text-xs font-semibold text-blue-700">
            Loading model… {progress}%
          </span>
        </div>
        <div className="w-full bg-blue-100 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-blue-500 mt-1.5">
          Downloading Llama 3.2 1B — runs entirely on your device after this.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
        <AlertCircle size={13} className="text-red-500 shrink-0" />
        <p className="text-xs text-red-600 flex-1">{error ?? "Failed to load model"}</p>
        <button
          onClick={loadModel}
          className="text-xs font-semibold text-red-600 underline shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  // idle
  return (
    <div className="mb-4 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
          <Cpu size={14} className="text-gray-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-800">Local model not loaded</p>
          <p className="text-[11px] text-gray-500">Llama 3.2 1B · runs on your device</p>
        </div>
      </div>
      <button
        onClick={loadModel}
        className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-xl"
        style={{ background: PRIMARY }}
      >
        <Download size={12} />Load
      </button>
    </div>
  );
}

// ── Create Agent Modal ───────────────────────────────────────────────────────

function CreateAgentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (a: Agent) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [riskLevel, setRiskLevel] = useState<"conservative" | "moderate" | "aggressive">("moderate");
  const [maxSpend, setMaxSpend] = useState("100");
  const [assets, setAssets] = useState<string[]>(["BTC", "ETH", "USDT"]);
  const [autoExecute, setAutoExecute] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleAsset = (a: string) =>
    setAssets(prev => (prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]));

  const submit = async () => {
    if (!name.trim()) { setError("Agent name is required"); return; }
    if (assets.length === 0) { setError("Select at least one asset"); return; }
    setError(""); setLoading(true);
    try {
      const payload: CreateAgentRequest = {
        name: name.trim(),
        description: description.trim(),
        risk_level: riskLevel,
        max_spend_usd: parseFloat(maxSpend) || 100,
        target_assets: assets,
        auto_execute: autoExecute,
        cycle_seconds: 60,
      };
      const res = await agentService.createAgent(payload);
      onCreated(res.data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EBF4FF" }}>
              <Bot size={16} style={{ color: PRIMARY }} />
            </div>
            <h2 className="text-base font-bold text-gray-900">Create AI Agent</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Agent name *</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. BTC Momentum Bot"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optional — describe the strategy"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Risk level</label>
            <div className="grid grid-cols-3 gap-2">
              {(["conservative", "moderate", "aggressive"] as const).map(r => {
                const c = RISK_CFG[r];
                const active = riskLevel === r;
                return (
                  <button
                    key={r} onClick={() => setRiskLevel(r)}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all ${active ? `${c.bg} ${c.color} border-current` : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max spend per trade (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number" value={maxSpend} onChange={e => setMaxSpend(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Target assets</label>
            <div className="flex flex-wrap gap-2">
              {ALL_ASSETS.map(a => (
                <button
                  key={a} onClick={() => toggleAsset(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${assets.includes(a) ? "border-transparent text-white" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                  style={assets.includes(a) ? { background: PRIMARY } : {}}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border border-gray-100 rounded-xl px-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Auto Execute</p>
              <p className="text-xs text-gray-500">Record decisions as executed automatically</p>
            </div>
            <button
              onClick={() => setAutoExecute(p => !p)}
              className={`w-11 h-6 rounded-full relative transition-colors ${autoExecute ? "" : "bg-gray-200"}`}
              style={autoExecute ? { background: PRIMARY } : {}}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoExecute ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">
              <AlertCircle size={14} />{error}
            </div>
          )}

          <button
            onClick={submit} disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: PRIMARY }}
          >
            {loading ? <Spinner size={16} /> : <><Plus size={16} />Deploy Agent</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent, onRun, onToggle, running,
}: {
  agent: Agent;
  onRun: (id: string) => void;
  onToggle: (id: string, status: "active" | "paused") => void;
  running: boolean;
}) {
  const router = useRouter();
  const { status: modelStatus } = useQvac();
  const pnl = parseFloat(agent.profit_loss_usd);
  const winRate =
    agent.total_executed > 0
      ? ((agent.win_count / agent.total_executed) * 100).toFixed(1) + "%"
      : "—";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-200 transition-all hover:shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#EBF4FF" }}>
            <Bot size={20} style={{ color: PRIMARY }} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">{agent.name}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">QVAC local inference</p>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-gray-500 mb-0.5">PnL</p>
          <p className={`text-xs font-bold ${pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
            {pnl >= 0 ? "+" : ""}${fmt2(agent.profit_loss_usd)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-gray-500 mb-0.5">Win Rate</p>
          <p className="text-xs font-bold text-gray-800">{winRate}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-gray-500 mb-0.5">Trades</p>
          <p className="text-xs font-bold text-gray-800">{agent.total_executed}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-xs text-gray-500">Volume</span>
        <span className="text-xs font-semibold text-gray-700">${fmt2(agent.total_volume_usd)}</span>
      </div>

      <div className="flex gap-2">
        {agent.status !== "terminated" && (
          <button
            onClick={() => onToggle(agent.id, agent.status === "active" ? "paused" : "active")}
            className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            {agent.status === "active" ? <><Pause size={12} />Pause</> : <><Play size={12} />Resume</>}
          </button>
        )}
        <button
          onClick={() => onRun(agent.id)}
          disabled={running || agent.status !== "active" || modelStatus !== "ready"}
          title={modelStatus !== "ready" ? "Load the model first" : undefined}
          className="flex-1 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
          style={{ background: PRIMARY }}
        >
          {running ? <Spinner size={12} /> : <><Zap size={12} />Run Now</>}
        </button>
        <button
          onClick={() => router.push(`/agents/${agent.id}`)}
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50"
        >
          <ChevronRight size={14} className="text-gray-500" />
        </button>
      </div>
    </div>
  );
}

// ── Decision Toast ───────────────────────────────────────────────────────────

function DecisionToast({ decision, onClose }: { decision: SubmitDecisionRequest; onClose: () => void }) {
  const isAction = decision.action !== "hold";
  const color =
    decision.action === "buy" ? "#16a34a" : decision.action === "sell" ? "#dc2626" : "#6b7280";

  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-sm w-full animate-in slide-in-from-bottom-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: isAction ? `${color}15` : "#f3f4f6" }}
            >
              {isAction
                ? <TrendingUp size={15} style={{ color }} />
                : <Activity size={15} className="text-gray-400" />}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">
                QVAC decision:{" "}
                <span style={{ color }}>{decision.action.toUpperCase()}</span>
                {isAction && <span className="text-gray-600"> {decision.asset}</span>}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{decision.reasoning}</p>
              <p className="text-[10px] mt-1 text-gray-400 flex items-center gap-1">
                <Cpu size={9} />Inferred locally · no cloud
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 shrink-0 hover:bg-gray-100 rounded-lg">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [lastDecision, setLastDecision] = useState<SubmitDecisionRequest | null>(null);
  const [error, setError] = useState("");

  const { complete, status: modelStatus, loadModel } = useQvac();

  const load = useCallback(async () => {
    try {
      const res = await agentService.listAgents();
      setAgents(res.data || []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (agent: Agent) => {
    setAgents(prev => [agent, ...prev]);
    setShowCreate(false);
  };

  const handleRun = async (id: string) => {
    if (modelStatus !== "ready") {
      await loadModel();
      return;
    }
    setRunningId(id);
    setError("");
    try {
      // 1. Fetch market context from backend
      const ctxRes = await agentService.getMarketContext(id);
      const ctx = ctxRes.data;

      // 2. Build prompts for QVAC
      const { systemPrompt, userPrompt } = buildPrompts(ctx);

      // 3. Run local inference via QVAC (no cloud call)
      const rawText = await complete(systemPrompt, userPrompt);

      // 4. Parse the decision JSON from model output
      const decision = parseDecision(rawText, ctx.strategy.max_spend_usd);

      // 5. Submit decision to backend for storage
      const payload: SubmitDecisionRequest = {
        ...decision,
        context_json: JSON.stringify(ctx),
      };
      await agentService.submitDecision(id, payload);

      setLastDecision(payload);
      load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRunningId(null);
    }
  };

  const handleToggle = async (id: string, newStatus: "active" | "paused") => {
    try {
      const res = await agentService.updateStatus(id, newStatus);
      setAgents(prev => prev.map(a => (a.id === id ? res.data : a)));
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const totalPnL = agents.reduce((s, a) => s + parseFloat(a.profit_loss_usd), 0);
  const totalVolume = agents.reduce((s, a) => s + parseFloat(a.total_volume_usd), 0);
  const activeCount = agents.filter(a => a.status === "active").length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div
        className="rounded-2xl p-5 mb-5 text-white"
        style={{ background: "linear-gradient(135deg, #1D3B53 0%, #4472B7 100%)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">AI Trading Agents</h1>
              <p className="text-xs text-blue-200">Powered by QVAC · Edge AI on your device</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} />New Agent
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Active",     value: String(activeCount) },
            { label: "Total PnL",  value: `${totalPnL >= 0 ? "+" : ""}$${fmt2(totalPnL)}` },
            { label: "Volume",     value: `$${fmt2(totalVolume)}` },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-blue-200 mb-0.5">{s.label}</p>
              <p className="text-sm font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* QVAC model status banner */}
      <QvacModelBanner />

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={14} />{error}
          <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#EBF4FF" }}>
            <Bot size={28} style={{ color: PRIMARY }} />
          </div>
          <p className="text-gray-800 font-semibold mb-1">No agents yet</p>
          <p className="text-gray-500 text-sm mb-5">
            Deploy your first AI agent running on-device with QVAC.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
            style={{ background: PRIMARY }}
          >
            <Plus size={16} />Deploy Agent
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onRun={handleRun}
              onToggle={handleToggle}
              running={runningId === agent.id}
            />
          ))}
        </div>
      )}

      {/* How it works */}
      {agents.length === 0 && (
        <div className="mt-8 bg-gray-50 rounded-2xl p-5">
          <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">How it works</p>
          <div className="space-y-3">
            {[
              { icon: Bot,          title: "Deploy agent",           desc: "Configure strategy, risk level, and target assets." },
              { icon: Download,     title: "Load model",             desc: "Llama 3.2 1B downloads once and is cached on your device via QVAC." },
              { icon: Cpu,          title: "QVAC runs inference",    desc: "Every cycle, the model reads live prices and decides BUY / SELL / HOLD — entirely locally." },
              { icon: CheckCircle2, title: "Zero cloud dependency",  desc: "No API keys, no data sent to any server. Your trading logic stays private." },
              { icon: Activity,     title: "Track performance",      desc: "Monitor win rate, PnL, and volume in real time." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5" style={{ background: "#EBF4FF" }}>
                  <Icon size={13} style={{ color: PRIMARY }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{title}</p>
                  <p className="text-[11px] text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && <CreateAgentModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {lastDecision && <DecisionToast decision={lastDecision} onClose={() => setLastDecision(null)} />}
    </div>
  );
}
