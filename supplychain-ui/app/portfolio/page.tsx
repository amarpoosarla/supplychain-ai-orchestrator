"use client";

import { useMemo, useState } from "react";
import type { GradePortfolioRequest, GradePortfolioResponse } from "@/lib/api";
import { gradePortfolio } from "@/lib/api";

const defaultReq: GradePortfolioRequest = {
  candidate_name: "Suma",
  target_role: "AI Engineer",
  portfolio_url: "https://github.com/<your-handle>",
  notes: "Focus on GenAI + MLOps + AWS",
  content_text: "",
};

function clamp100(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function scoreColor(score: number) {
  const s = clamp100(score);
  if (s >= 80) return "bg-emerald-500";
  if (s >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function Bar({ label, value }: { label: string; value: number }) {
  const v = clamp100(value);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-100">{label}</div>
        <div className="text-sm text-slate-200">{v}</div>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-slate-800">
        <div className={`h-2 rounded-full ${scoreColor(v)}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [req, setReq] = useState<GradePortfolioRequest>(defaultReq);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<GradePortfolioResponse | null>(null);

  function setField<K extends keyof GradePortfolioRequest>(key: K, value: GradePortfolioRequest[K]) {
    setReq((prev) => ({ ...prev, [key]: value }));
  }

  const canGrade = useMemo(() => {
    const hasText = Boolean(req.content_text && req.content_text.trim().length > 20);
    const hasUrl = Boolean(req.portfolio_url && req.portfolio_url.trim().length > 5);
    return hasText || hasUrl;
  }, [req.content_text, req.portfolio_url]);

  async function onGrade() {
    setError(null);
    setBusy(true);
    try {
      const out = await gradePortfolio(req);
      setRes(out);
    } catch (e: any) {
      setError(e?.message || "Grade failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Portfolio Grader</h1>
            <p className="mt-2 text-sm text-slate-300">
              Paste portfolio/resume text or provide a URL. Get rubric scores + actionable feedback.
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
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
            <span className="font-semibold text-red-200">Error:</span>{" "}
            <span className="text-red-100">{error}</span>
          </div>
        )}

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Input */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
            <h2 className="text-base font-semibold">Input</h2>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextInput
                  label="candidate_name"
                  value={req.candidate_name || ""}
                  onChange={(v) => setField("candidate_name", v)}
                  placeholder="Your name"
                />
                <TextInput
                  label="target_role"
                  value={req.target_role || ""}
                  onChange={(v) => setField("target_role", v)}
                  placeholder="AI Engineer"
                />
              </div>

              <TextInput
                label="portfolio_url"
                value={req.portfolio_url || ""}
                onChange={(v) => setField("portfolio_url", v)}
                placeholder="https://github.com/..."
              />

              <TextArea
                label="notes"
                value={req.notes || ""}
                onChange={(v) => setField("notes", v)}
                placeholder="What should the grader focus on?"
              />

              <TextArea
                label="content_text"
                value={req.content_text || ""}
                onChange={(v) => setField("content_text", v)}
                placeholder="Paste portfolio / resume / project descriptions here..."
                rows={10}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onGrade}
                  disabled={busy || !canGrade}
                  className="rounded-xl border border-slate-700 bg-indigo-600/20 px-4 py-2 text-sm text-indigo-100 hover:bg-indigo-600/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Grading..." : "Grade"}
                </button>

                <button
                  onClick={() => setRes(null)}
                  disabled={busy}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear Results
                </button>
              </div>

              <div className="text-xs text-slate-400">
                Tip: For v1, paste text for best results. URL ingestion can be added next (GitHub README, website scraping).
              </div>
            </div>
          </div>

          {/* Output */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
            <h2 className="text-base font-semibold">Report</h2>

            {!res ? (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
                No report yet. Fill input and click <b>Grade</b>.
              </div>
            ) : (
              <div className="mt-5 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-300">
                    Report ID: <span className="text-slate-100">{res.report_id}</span>
                  </div>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200">
                    Overall: <span className="text-slate-100">{clamp100(res.rubric.overall)}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Bar label="Impact" value={res.rubric.impact} />
                  <Bar label="Clarity" value={res.rubric.clarity} />
                  <Bar label="Technical depth" value={res.rubric.technical_depth} />
                  <Bar label="Relevance" value={res.rubric.relevance} />
                  <Bar label="Presentation" value={res.rubric.presentation} />
                  <Bar label="Overall" value={res.rubric.overall} />
                </div>

                <ListCard title="Strengths" items={res.strengths} />
                <ListCard title="Gaps" items={res.gaps} />
                <ListCard title="Recommendations" items={res.recommendations} />

                {res.rewritten_bullets?.length ? (
                  <ListCard title="Rewritten bullets" items={res.rewritten_bullets} />
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function TextInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-400">{props.label}</div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500/60"
      />
    </label>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-400">{props.label}</div>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={props.rows || 6}
        className="mt-2 w-full resize-y rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500/60"
      />
    </label>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      {!items?.length ? (
        <div className="mt-2 text-sm text-slate-400">None</div>
      ) : (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-200">
          {items.map((x, i) => (
            <li key={`${title}-${i}`}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}