"use client";

import { useMemo, useState } from "react";
import type { ShipmentDelayEvent, TraceResponse, WorkItemResponse, RunWorkItemResponse } from "@/lib/api";
import { createWorkItem, runWorkItem, getTrace } from "@/lib/api";

const defaultEvent: ShipmentDelayEvent = {
  shipment_id: "SIM-9999",
  supplier_id: "SUP-001",
  original_eta: "2026-02-21",
  updated_eta: "2026-02-24",
  delay_days: 3,
  inventory_days_of_supply: 5,
  order_value: 2000,
  region: "US-CENTRAL",
  priority_flag: false,
};

type AgentTraceRow = {
  name: string;
  score: number;
  recommendation: string;
  reason: string;
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function fmtPct(n: number) {
  const v = Math.round(clamp01(n) * 100);
  return `${v}%`;
}

function decisionBadgeClasses(decision: string) {
  const d = (decision || "").toUpperCase();
  if (d === "ESCALATE") return "bg-red-500/15 text-red-200 ring-1 ring-red-500/30";
  if (d === "AUTO_RESOLVE") return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30";
  return "bg-slate-500/15 text-slate-200 ring-1 ring-slate-500/30";
}

function confidenceBarClasses(confidence: number) {
  const c = clamp01(confidence);
  if (c >= 0.75) return "bg-red-500";
  if (c >= 0.4) return "bg-amber-400";
  return "bg-emerald-500";
}

function recChipClasses(rec: string) {
  const r = (rec || "").toUpperCase();
  if (r === "ESCALATE") return "bg-red-500/15 text-red-200 ring-1 ring-red-500/30";
  if (r === "AUTO_RESOLVE") return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30";
  return "bg-slate-500/15 text-slate-200 ring-1 ring-slate-500/30";
}

function parseAgentTrace(trace: TraceResponse | null): AgentTraceRow[] {
  const ctx = trace?.work_item?.context;
  const rows: AgentTraceRow[] | undefined = ctx?.agent_trace;
  if (Array.isArray(rows)) return rows;
  // fallback: sometimes trace is nested
  const maybe = ctx?.agent_trace || ctx?.final?.agent_trace;
  if (Array.isArray(maybe)) return maybe;
  return [];
}

export default function WorkItemsPage() {
  const [event, setEvent] = useState<ShipmentDelayEvent>(defaultEvent);

  const [created, setCreated] = useState<WorkItemResponse | null>(null);
  const [runResult, setRunResult] = useState<RunWorkItemResponse | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof ShipmentDelayEvent>(key: K, value: ShipmentDelayEvent[K]) {
    setEvent((prev) => ({ ...prev, [key]: value }));
  }

  const agentTrace = useMemo(() => parseAgentTrace(trace), [trace]);

  const finalSummary = useMemo(() => {
    // runResult.agent_summary is what your backend returns
    // trace.work_item.context.final is also available
    const rr = runResult?.agent_summary;
    const ctxFinal = (trace?.work_item?.context as any)?.final;
    return rr || ctxFinal || null;
  }, [runResult, trace]);

  async function onCreate() {
    setError(null);
    setBusy(true);
    try {
      const wi = await createWorkItem(event);
      setCreated(wi);
      setRunResult(null);
      setTrace(null);
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRun() {
    if (!created?.id) return;
    setError(null);
    setBusy(true);
    try {
      const rr = await runWorkItem(created.id);
      setRunResult(rr);
      const tr = await getTrace(created.id);
      setTrace(tr);
    } catch (e: any) {
      setError(e?.message || "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRefreshTrace() {
    if (!created?.id) return;
    setError(null);
    setBusy(true);
    try {
      const tr = await getTrace(created.id);
      setTrace(tr);
    } catch (e: any) {
      setError(e?.message || "Trace failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Supply Chain AI Orchestrator</h1>
            <p className="mt-1 text-sm text-slate-300">
              Multi-agent decisioning with RAG and full traceability.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-indigo-500/15 px-3 py-1 text-xs text-indigo-200 ring-1 ring-indigo-500/30 md:inline">
              Portfolio Mode
            </span>

            <a
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              href="/"
            >
              Home
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-12">
        {/* Left: Form */}
        <section className="lg:col-span-5">
          <Card>
            <CardHeader
              title="Create Work Item"
              subtitle="Enter a shipment delay event. This creates a new work item in Postgres."
            />
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="shipment_id"
                value={event.shipment_id}
                onChange={(v) => setField("shipment_id", v)}
              />
              <TextField
                label="supplier_id"
                value={event.supplier_id}
                onChange={(v) => setField("supplier_id", v)}
              />

              <TextField
                label="original_eta"
                value={event.original_eta}
                onChange={(v) => setField("original_eta", v)}
              />
              <TextField
                label="updated_eta"
                value={event.updated_eta}
                onChange={(v) => setField("updated_eta", v)}
              />

              <NumberField
                label="delay_days"
                value={event.delay_days}
                onChange={(v) => setField("delay_days", v)}
              />
              <NumberField
                label="inventory_days_of_supply"
                value={event.inventory_days_of_supply}
                onChange={(v) => setField("inventory_days_of_supply", v)}
              />

              <NumberField
                label="order_value"
                value={event.order_value}
                onChange={(v) => setField("order_value", v)}
              />
              <TextField label="region" value={event.region} onChange={(v) => setField("region", v)} />

              <div className="sm:col-span-2">
                <Toggle
                  label="priority_flag"
                  checked={event.priority_flag}
                  onChange={(v) => setField("priority_flag", v)}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryButton onClick={onCreate} disabled={busy}>
                {busy ? "Working..." : "Create Work Item"}
              </PrimaryButton>

              <SecondaryButton onClick={onRun} disabled={busy || !created?.id}>
                {busy ? "Working..." : "Run Orchestration"}
              </SecondaryButton>

              <SecondaryButton onClick={onRefreshTrace} disabled={busy || !created?.id}>
                Refresh Trace
              </SecondaryButton>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                <div className="font-semibold">Error</div>
                <div className="mt-1 break-words text-red-100/90">{error}</div>
              </div>
            )}

            {created?.id && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-slate-300">Created Work Item</div>
                <div className="mt-1 break-all font-mono text-sm text-slate-100">{created.id}</div>
                <div className="mt-2 text-sm text-slate-300">
                  Status: <span className="text-slate-100">{created.status}</span>
                </div>
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <CardHeader title="Tips" subtitle="Quick checks when wiring frontend to backend." />
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li className="flex gap-2">
                <span className="mt-[2px] h-2 w-2 rounded-full bg-emerald-400/80" />
                Backend: <span className="text-slate-200">http://localhost:8000</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[2px] h-2 w-2 rounded-full bg-indigo-400/80" />
                If you see <span className="text-slate-200">OPTIONS 405</span>, you are hitting the API from the browser and need CORS.
              </li>
              <li className="flex gap-2">
                <span className="mt-[2px] h-2 w-2 rounded-full bg-amber-400/80" />
                Use <span className="text-slate-200">/work-items/{`{id}`}/trace</span> to show explainability.
              </li>
            </ul>
          </Card>
        </section>

        {/* Right: Decision + Trace */}
        <section className="lg:col-span-7">
          <Card>
            <CardHeader title="Decision Panel" subtitle="Latest orchestration outcome with confidence and explanation." />

            {!runResult ? (
              <EmptyState
                title="No decision yet"
                subtitle="Create a work item, then click “Run Orchestration” to see the decision panel."
              />
            ) : (
              <div className="mt-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${decisionBadgeClasses(runResult.decision)}`}>
                      {runResult.decision}
                    </span>
                    <span className="text-sm text-slate-300">
                      Status: <span className="text-slate-100">{runResult.new_status}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-300">Confidence</span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-sm font-semibold text-slate-100 ring-1 ring-white/10">
                      {fmtPct(runResult.confidence)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full ${confidenceBarClasses(runResult.confidence)}`}
                      style={{ width: `${Math.round(clamp01(runResult.confidence) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-slate-100">Reason</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200/90">
                    {runResult.reason}
                  </p>
                </div>

                {finalSummary && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Metric label="Final Decision" value={finalSummary.decision || runResult.decision} />
                    <Metric
                      label="Avg Score"
                      value={typeof finalSummary.avg_score === "number" ? finalSummary.avg_score.toFixed(3) : "—"}
                    />
                    <Metric
                      label="Override"
                      value={finalSummary.override ? String(finalSummary.override) : "NONE"}
                    />
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <CardHeader title="Agent Trace" subtitle="How each agent voted and why." />

            {agentTrace.length === 0 ? (
              <EmptyState title="No trace yet" subtitle="Run orchestration to see multi-agent reasoning." />
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {agentTrace.map((a) => (
                  <div
                    key={`${a.name}-${a.recommendation}-${a.score}`}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{a.name}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          Score: <span className="text-slate-200">{Number(a.score).toFixed(3)}</span>
                        </div>
                      </div>

                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${recChipClasses(a.recommendation)}`}>
                        {a.recommendation}
                      </span>
                    </div>

                    <div className="mt-3 text-sm text-slate-200/90">
                      <div className="text-xs font-semibold text-slate-300">Reason</div>
                      <div className="mt-1 whitespace-pre-wrap leading-6">{a.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <CardHeader title="Decision History" subtitle="Every run is stored as a decision record." />

            {!trace?.decisions?.length ? (
              <EmptyState title="No decision records" subtitle="Run orchestration to generate decision history." />
            ) : (
              <div className="mt-5 space-y-3">
                {trace.decisions
                  .slice()
                  .reverse()
                  .map((d) => (
                    <div
                      key={d.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${decisionBadgeClasses(d.decision)}`}>
                            {d.decision}
                          </span>
                          <span className="text-xs text-slate-400 font-mono break-all">{d.id}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(d.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-slate-200/90">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span>
                            Confidence: <span className="text-slate-200">{fmtPct(d.confidence)}</span>
                          </span>
                          <span>
                            Reviewer: <span className="text-slate-200">{d.created_by ?? "system"}</span>
                          </span>
                        </div>

                        <div className="mt-2 whitespace-pre-wrap leading-6">{d.reason}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </section>
      </div>

      <footer className="border-t border-white/10 py-6">
        <div className="mx-auto max-w-6xl px-6 text-xs text-slate-400">
          Tip: This page is intentionally built without extra UI libraries. We can add shadcn/ui later if you want.
        </div>
      </footer>
    </main>
  );
}

/* ---------------------- UI Components ---------------------- */

function Card(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-950/40 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] ${props.className || ""}`}>
      {props.children}
    </div>
  );
}

function CardHeader(props: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-lg font-semibold text-slate-100">{props.title}</div>
      <div className="mt-1 text-sm text-slate-300">{props.subtitle}</div>
    </div>
  );
}

function EmptyState(props: { title: string; subtitle: string }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-white/10 bg-white/5 p-6">
      <div className="text-sm font-semibold text-slate-100">{props.title}</div>
      <div className="mt-1 text-sm text-slate-300">{props.subtitle}</div>
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-slate-400">{props.label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-100">{props.value}</div>
    </div>
  );
}

function TextField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-2">
      <div className="text-xs font-medium text-slate-300">{props.label}</div>
      <input
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function NumberField(props: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="space-y-2">
      <div className="text-xs font-medium text-slate-300">{props.label}</div>
      <input
        type="number"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <div>
        <div className="text-xs font-semibold text-slate-200">{props.label}</div>
        <div className="text-xs text-slate-400">Escalate priority shipments regardless of other signals.</div>
      </div>

      <button
        type="button"
        onClick={() => props.onChange(!props.checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          props.checked ? "bg-indigo-500/80" : "bg-white/10"
        }`}
        aria-pressed={props.checked}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            props.checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function PrimaryButton(props: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {props.children}
    </button>
  );
}

function SecondaryButton(props: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {props.children}
    </button>
  );
}