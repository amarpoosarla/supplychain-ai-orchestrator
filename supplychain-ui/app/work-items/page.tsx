"use client";

import { useMemo, useState } from "react";
import type {
  ShipmentDelayEvent,
  TraceResponse,
  WorkItemResponse,
  RunWorkItemResponse,
  SimulationsReport,
} from "@/lib/api";
import {
  createWorkItem,
  runWorkItem,
  getTrace,
  runSimulations,
  getSimulationsReport,
  resetSimulations,
} from "@/lib/api";

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

type AgentTraceItem = {
  name: string;
  score: number;
  recommendation: "ESCALATE" | "AUTO_RESOLVE" | string;
  reason: string;
};

type FinalSummary = {
  decision?: string;
  avg_score?: number;
  votes_escalate?: number;
  weighted_escalate_score?: number;
  override?: string;
};

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function fmtPct(n: number) {
  const x = clamp01(n);
  return `${Math.round(x * 100)}%`;
}

function decisionBadge(decision?: string) {
  const d = (decision || "").toUpperCase();
  if (d === "ESCALATE") return "bg-red-500/15 text-red-300 border-red-500/30";
  if (d === "AUTO_RESOLVE") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  return "bg-slate-500/15 text-slate-300 border-slate-500/30";
}

function recBadge(rec?: string) {
  const r = (rec || "").toUpperCase();
  if (r === "ESCALATE") return "bg-red-500/15 text-red-300 border-red-500/30";
  if (r === "AUTO_RESOLVE") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  return "bg-slate-500/15 text-slate-300 border-slate-500/30";
}

function scoreBarColor(score: number) {
  const s = clamp01(score);
  if (s >= 0.8) return "bg-emerald-500";
  if (s >= 0.5) return "bg-amber-500";
  return "bg-red-500";
}

function num(n: any): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

export default function WorkItemsPage() {
  const [event, setEvent] = useState<ShipmentDelayEvent>(defaultEvent);

  const [created, setCreated] = useState<WorkItemResponse | null>(null);
  const [runResult, setRunResult] = useState<RunWorkItemResponse | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Metrics state
  const [metricsBusy, setMetricsBusy] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SimulationsReport | null>(null);

  function setField<K extends keyof ShipmentDelayEvent>(key: K, value: ShipmentDelayEvent[K]) {
    setEvent((prev) => ({ ...prev, [key]: value }));
  }

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

  async function onRefreshMetrics() {
    setMetricsError(null);
    setMetricsBusy(true);
    try {
      const r = await getSimulationsReport();
      setMetrics(r);
    } catch (e: any) {
      setMetricsError(e?.message || "Metrics fetch failed");
    } finally {
      setMetricsBusy(false);
    }
  }

  async function onRunSimulations() {
    setMetricsError(null);
    setMetricsBusy(true);
    try {
      // backend: POST /work-items/simulate
      await runSimulations();
      const r = await getSimulationsReport();
      setMetrics(r);
    } catch (e: any) {
      setMetricsError(e?.message || "Simulation failed");
    } finally {
      setMetricsBusy(false);
    }
  }

  async function onResetMetrics() {
    setMetricsError(null);
    setMetricsBusy(true);
    try {
      // backend: DELETE /work-items/simulations/reset
      await resetSimulations();
      const r = await getSimulationsReport();
      setMetrics(r);
    } catch (e: any) {
      setMetricsError(e?.message || "Reset failed");
    } finally {
      setMetricsBusy(false);
    }
  }

  // ---- Extract explainability context safely ----
  const ctx = trace?.work_item?.context as any | undefined;
  const finalSummary: FinalSummary | undefined = ctx?.final;
  const agentTrace: AgentTraceItem[] = (ctx?.agent_trace || []) as AgentTraceItem[];

  const finalDecision = useMemo(() => {
    const dFromRun = runResult?.decision;
    const dFromTrace = finalSummary?.decision;
    return (dFromRun || dFromTrace || "").toUpperCase();
  }, [runResult?.decision, finalSummary?.decision]);

  const override = finalSummary?.override;

  const overrideBreakdownEntries = useMemo(() => {
    const ob = metrics?.override_breakdown || {};
    return Object.entries(ob).sort((a, b) => b[1] - a[1]);
  }, [metrics?.override_breakdown]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Work Items</h1>
            <p className="mt-2 text-sm text-slate-300">
              Create a shipment delay event, run orchestration, and inspect explainability trace.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">API</span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200">
              {process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="text-sm">
              <span className="font-semibold text-red-200">Error:</span>{" "}
              <span className="text-red-100">{error}</span>
            </div>
          </div>
        )}

        {/* Top status banner */}
        {(runResult || trace) && (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${decisionBadge(finalDecision)}`}
                >
                  {finalDecision || "NO_DECISION"}
                </span>

                {override && (
                  <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
                    Override: {override}
                  </span>
                )}

                {created?.id && (
                  <span className="text-xs text-slate-400">
                    WorkItem: <span className="text-slate-200">{created.id}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                {runResult?.new_status && (
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">
                    Status: <span className="text-slate-100">{runResult.new_status}</span>
                  </span>
                )}
                {typeof runResult?.confidence === "number" && (
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">
                    Confidence: <span className="text-slate-100">{fmtPct(runResult.confidence)}</span>
                  </span>
                )}
                {typeof finalSummary?.avg_score === "number" && (
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">
                    Avg score: <span className="text-slate-100">{finalSummary.avg_score.toFixed(3)}</span>
                  </span>
                )}
              </div>
            </div>

            {runResult?.reason && (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Reason</div>
                <div className="mt-1 text-sm text-slate-100">{runResult.reason}</div>
              </div>
            )}
          </div>
        )}

        {/* Create Work Item */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">1) Create Work Item</h2>

            <div className="flex gap-2">
              <button
                onClick={onCreate}
                disabled={busy}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Working..." : "Create"}
              </button>

              <button
                onClick={onRun}
                disabled={busy || !created?.id}
                className="rounded-xl border border-slate-700 bg-indigo-600/20 px-4 py-2 text-sm text-indigo-100 hover:bg-indigo-600/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Working..." : "Run Orchestration"}
              </button>

              <button
                onClick={onRefreshTrace}
                disabled={busy || !created?.id}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh Trace
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput label="shipment_id" value={event.shipment_id} onChange={(v) => setField("shipment_id", v)} />
            <TextInput label="supplier_id" value={event.supplier_id} onChange={(v) => setField("supplier_id", v)} />

            <TextInput label="original_eta" value={event.original_eta} onChange={(v) => setField("original_eta", v)} />
            <TextInput label="updated_eta" value={event.updated_eta} onChange={(v) => setField("updated_eta", v)} />

            <NumberInput label="delay_days" value={event.delay_days} onChange={(v) => setField("delay_days", v)} />
            <NumberInput
              label="inventory_days_of_supply"
              value={event.inventory_days_of_supply}
              onChange={(v) => setField("inventory_days_of_supply", v)}
            />

            <NumberInput label="order_value" value={event.order_value} onChange={(v) => setField("order_value", v)} />
            <TextInput label="region" value={event.region} onChange={(v) => setField("region", v)} />

            <div className="md:col-span-2">
              <Toggle
                label="priority_flag"
                checked={event.priority_flag}
                onChange={(v) => setField("priority_flag", v)}
              />
            </div>
          </div>

          {created?.id && (
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-slate-400">Created Work Item ID:</span>{" "}
                  <span className="font-medium text-slate-100">{created.id}</span>
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200">
                  Status: {created.status}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Executive Metrics */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Executive Metrics</h2>
              <p className="mt-1 text-sm text-slate-300">
                Business outcome view from simulation runs (auto-resolve rate, escalation rate, override mix).
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onRunSimulations}
                disabled={metricsBusy}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {metricsBusy ? "Working..." : "Run Simulations"}
              </button>

              <button
                onClick={onRefreshMetrics}
                disabled={metricsBusy}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh
              </button>

              <button
                onClick={onResetMetrics}
                disabled={metricsBusy}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset
              </button>
            </div>
          </div>

          {metricsError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
              <span className="font-semibold text-red-200">Metrics Error:</span>{" "}
              <span className="text-red-100">{metricsError}</span>
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-5">
            <MetricCard title="Total" value={metrics ? String(metrics.total) : "—"} />
            <MetricCard title="Auto Resolved" value={metrics ? String(metrics.auto_resolved) : "—"} />
            <MetricCard title="Escalated" value={metrics ? String(metrics.escalated) : "—"} />
            <MetricCard title="Auto Resolve Rate" value={metrics ? fmtPct(num(metrics.auto_resolve_rate)) : "—"} />
            <MetricCard title="Escalation Rate" value={metrics ? fmtPct(num(metrics.escalation_rate)) : "—"} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="text-sm font-semibold">Override Breakdown</div>
              <div className="mt-1 text-xs text-slate-400">How often overrides were used (NONE, PRIORITY_FLAG, etc.)</div>

              {!metrics ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
                  Run simulations or refresh to load metrics.
                </div>
              ) : overrideBreakdownEntries.length === 0 ? (
                <div className="mt-4 text-sm text-slate-300">No override breakdown returned.</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {overrideBreakdownEntries.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                      <span className="text-sm text-slate-200">{k}</span>
                      <span className="text-sm font-semibold text-slate-100">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="text-sm font-semibold">Notes</div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                <li>Simulations typically aggregate outcomes from created work items (or synthetic runs, depending on backend).</li>
                <li>If you reset metrics, it clears stored simulation artifacts, then report becomes zeros/empty.</li>
                <li>If buttons don’t appear, it usually means you’re not running this file or TS compile failed.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Explainability */}
        {trace && (
          <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Agent cards */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">2) Explainability</h2>
                <span className="text-xs text-slate-400">
                  {agentTrace?.length ? `${agentTrace.length} agents` : "No agent trace"}
                </span>
              </div>

              {!agentTrace?.length ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
                  No agent trace found in context.
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {agentTrace.map((a, idx) => {
                    const score = clamp01(Number(a.score ?? 0));
                    return (
                      <div
                        key={`${a.name}-${idx}`}
                        className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-100">{a.name}</div>
                            <div className="mt-1 text-xs text-slate-400">Recommendation</div>
                          </div>

                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${recBadge(a.recommendation)}`}
                          >
                            {String(a.recommendation || "UNKNOWN")}
                          </span>
                        </div>

                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Score</span>
                            <span className="text-slate-200">{fmtPct(score)}</span>
                          </div>

                          <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
                            <div
                              className={`h-2 rounded-full ${scoreBarColor(score)}`}
                              style={{ width: `${Math.round(score * 100)}%` }}
                            />
                          </div>

                          <div className="mt-4 text-xs text-slate-400">Reason</div>
                          <div className="mt-1 text-sm text-slate-200">{a.reason || "No reason provided."}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Decision summary + history */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
              <h2 className="text-base font-semibold">3) Audit</h2>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">Final summary</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Row k="Decision" v={finalSummary?.decision || runResult?.decision || "—"} />
                  <Row k="Override" v={finalSummary?.override || "NONE"} />
                  <Row
                    k="Avg score"
                    v={typeof finalSummary?.avg_score === "number" ? finalSummary.avg_score.toFixed(3) : "—"}
                  />
                  <Row
                    k="Votes escalate"
                    v={typeof finalSummary?.votes_escalate === "number" ? String(finalSummary.votes_escalate) : "—"}
                  />
                  <Row
                    k="Weighted score"
                    v={
                      typeof finalSummary?.weighted_escalate_score === "number"
                        ? String(finalSummary.weighted_escalate_score)
                        : "—"
                    }
                  />
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs uppercase tracking-wide text-slate-400">Decisions history</div>

                {!trace.decisions?.length ? (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
                    No decisions found.
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {trace.decisions.map((d) => {
                      const dec = (d.decision || "").toUpperCase();
                      return (
                        <div key={d.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${decisionBadge(dec)}`}>
                              {dec || "UNKNOWN"}
                            </span>

                            <div className="text-right text-xs text-slate-400">
                              <div>{new Date(d.created_at).toLocaleString()}</div>
                              <div>{d.created_by ? `by ${d.created_by}` : "system"}</div>
                            </div>
                          </div>

                          <div className="mt-3 text-xs text-slate-400">Reason</div>
                          <div className="mt-1 text-sm text-slate-200">{d.reason}</div>

                          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                            <span>Confidence</span>
                            <span className="text-slate-200">{fmtPct(Number(d.confidence || 0))}</span>
                          </div>
                          <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
                            <div
                              className={`h-2 rounded-full ${scoreBarColor(Number(d.confidence || 0))}`}
                              style={{ width: `${Math.round(clamp01(Number(d.confidence || 0)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{k}</span>
      <span className="font-medium text-slate-100">{v}</span>
    </div>
  );
}

function TextInput(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-400">{props.label}</div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500/60"
        placeholder={props.label}
      />
    </label>
  );
}

function NumberInput(props: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-400">{props.label}</div>
      <input
        type="number"
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500/60"
        placeholder={props.label}
      />
    </label>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-slate-100">{props.label}</div>
        <div className="text-xs text-slate-400">If true, priority override can force escalation.</div>
      </div>

      <button
        type="button"
        onClick={() => props.onChange(!props.checked)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
          props.checked ? "border-emerald-500/40 bg-emerald-500/20" : "border-slate-700 bg-slate-900"
        }`}
        aria-pressed={props.checked}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full transition ${
            props.checked ? "translate-x-6 bg-emerald-400" : "translate-x-1 bg-slate-400"
          }`}
        />
      </button>
    </div>
  );
}