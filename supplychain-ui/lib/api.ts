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

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  // Helpful error messages
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