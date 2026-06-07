import api from "./api";

export interface CreateAgentRequest {
  name: string;
  description?: string;
  risk_level: "conservative" | "moderate" | "aggressive";
  max_spend_usd: number;
  target_assets: string[];
  auto_execute: boolean;
  cycle_seconds?: number;
}

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  status: "active" | "paused" | "terminated";
  total_decisions: number;
  total_executed: number;
  win_count: number;
  profit_loss_usd: string;
  total_volume_usd: string;
  last_cycle_at?: string;
  created_at: string;
}

export interface AgentDecision {
  id: string;
  agent_id: string;
  action: "buy" | "sell" | "hold";
  asset: string;
  amount_usd: string;
  price: string;
  reasoning: string;
  status: "pending" | "executed" | "skipped" | "failed";
  pnl_usd: string;
  created_at: string;
}

export interface AgentPerformance {
  agent_id: string;
  name: string;
  status: string;
  total_decisions: number;
  total_executed: number;
  win_rate: string;
  profit_loss_usd: string;
  total_volume_usd: string;
  last_cycle_at?: string;
}

export interface MarketContext {
  agent_id: string;
  agent_name: string;
  strategy: {
    risk_level: string;
    max_spend_usd: number;
    target_assets: string[];
    auto_execute: boolean;
    cycle_seconds: number;
  };
  timestamp: string;
  prices_usd: Record<string, number>;
  recent_trades: Array<{
    action: string;
    asset: string;
    amount_usd: number;
    pnl_usd: number;
  }>;
  pnl_usd: number;
  volume_usd: number;
  total_executed: number;
}

export interface SubmitDecisionRequest {
  action: "buy" | "sell" | "hold";
  asset: string;
  amount_usd: number;
  reasoning: string;
  context_json?: string;
}

const agentService = {
  createAgent: (data: CreateAgentRequest) =>
    api.post<{ data: Agent }>("/agents", data).then(r => r.data),

  listAgents: () =>
    api.get<{ data: Agent[] }>("/agents").then(r => r.data),

  getAgent: (id: string) =>
    api.get<{ data: Agent }>(`/agents/${id}`).then(r => r.data),

  updateStatus: (id: string, status: "active" | "paused" | "terminated") =>
    api.patch<{ data: Agent }>(`/agents/${id}/status`, { status }).then(r => r.data),

  getMarketContext: (id: string) =>
    api.get<{ data: MarketContext }>(`/agents/${id}/context`).then(r => r.data),

  submitDecision: (id: string, data: SubmitDecisionRequest) =>
    api.post<{ data: AgentDecision }>(`/agents/${id}/decisions`, data).then(r => r.data),

  listDecisions: (id: string, page = 1, pageSize = 20) =>
    api.get<{ data: { decisions: AgentDecision[]; pagination: { total: number; page: number; page_size: number } } }>(
      `/agents/${id}/decisions?page=${page}&page_size=${pageSize}`
    ).then(r => r.data),

  getPerformance: (id: string) =>
    api.get<{ data: AgentPerformance }>(`/agents/${id}/performance`).then(r => r.data),
};

export { agentService };
