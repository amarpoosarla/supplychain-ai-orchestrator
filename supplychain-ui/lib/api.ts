const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type ShipmentDelayEvent = {
  shipment_id: string;
  supplier_id: string;
  original_eta: string;
  updated_eta: string;
  delay_days: number;
  inventory_days_of_supply: number;
  order_value: number;
  region: string;
  priority_flag: boolean;
};

export type WorkItemResponse = {
  id: string;
  type: string;
  status: string;
  payload: any;
  context?: any;
};

export type RunWorkItemResponse = {
  work_item_id: string;
  new_status: string;
  decision: string;
  reason: string;
  confidence: number;
  agent_summary: any;
};

export type TraceResponse = {
  work_item: WorkItemResponse;
  decisions: Array<{
    id: string;
    decision: string;
    reason: string;
    confidence: number;
    created_by: string | null;
    created_at: string;
  }>;
};

export type SimulationsReportResponse = {
  total: number;
  auto_resolved: number;
  escalated: number;
  auto_resolve_rate: number;
  escalation_rate: number;
  override_breakdown: Record<string, number>;
  message?: string;
};

export type SimulateResponse = {
  total: number;
  auto_resolved: number;
  escalated: number;
  auto_resolve_rate: number;
  escalation_rate: number;
  estimated_hours_saved_per_run: number;
  items: Array<{
    work_item_id: string;
    shipment_id: string;
    status: string;
    decision: string;
    confidence: number;
    votes_escalate: number;
  }>;
};

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${txt}`);
  }

  return (await res.json()) as T;
}

export async function createWorkItem(event: ShipmentDelayEvent): Promise<WorkItemResponse> {
  return http<WorkItemResponse>(`/work-items`, {
    method: "POST",
    body: JSON.stringify({ event }),
  });
}

export async function runWorkItem(workItemId: string): Promise<RunWorkItemResponse> {
  return http<RunWorkItemResponse>(`/work-items/${workItemId}/run`, {
    method: "POST",
  });
}

export async function getTrace(workItemId: string): Promise<TraceResponse> {
  return http<TraceResponse>(`/work-items/${workItemId}/trace`, {
    method: "GET",
  });
}

// ---- Simulations / Metrics ----

// export async function runSimulations(): Promise<SimulateResponse> {
//   return http<SimulateResponse>(`/work-items/simulate`, { method: "POST" });
// }

// export async function getSimulationsReport(): Promise<SimulationsReportResponse> {
//   return http<SimulationsReportResponse>(`/work-items/simulations/report`, { method: "GET" });
// }

// export async function resetSimulations(): Promise<{ deleted_work_items: number; deleted_decisions: number }> {
//   return http<{ deleted_work_items: number; deleted_decisions: number }>(`/work-items/simulations/reset`, {
//     method: "DELETE",
//   });
// }

export type SimulationsReport = {
    total: number;
    auto_resolved: number;
    escalated: number;
    auto_resolve_rate: number;
    escalation_rate: number;
    override_breakdown: Record<string, number>;
  };
  
// ---- Simulations / Metrics ----
  export async function getSimulationsReport(): Promise<SimulationsReport> {
    return http<SimulationsReport>(`/work-items/simulations/report`, { method: "GET" });
  }
  
  export async function resetSimulations(): Promise<{ status?: string } | any> {
    return http(`/work-items/simulations/reset`, { method: "DELETE" });
  }
  
  export async function runSimulations(): Promise<any> {
    // Your backend route is POST /work-items/simulate
    return http(`/work-items/simulate`, { method: "POST" });
  }

  // -------------------- Portfolio Grader --------------------

export type GradePortfolioRequest = {
  candidate_name?: string;
  target_role?: string; // e.g., "AI Engineer"
  portfolio_url?: string; // e.g., github/website URL
  notes?: string; // optional free text
  content_text?: string; // paste resume/portfolio text here
};

export type PortfolioRubric = {
  overall: number; // 0-100
  impact: number;
  clarity: number;
  technical_depth: number;
  relevance: number;
  presentation: number;
};

export type GradePortfolioResponse = {
  report_id: string; // for future "share report" link
  rubric: PortfolioRubric;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  rewritten_bullets?: string[];
};

export async function gradePortfolio(payload: GradePortfolioRequest): Promise<GradePortfolioResponse> {
  return http<GradePortfolioResponse>(`/portfolio/grade`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}