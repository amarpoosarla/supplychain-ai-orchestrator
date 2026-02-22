import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Supply Chain AI Orchestrator</h1>
      <p style={{ marginTop: 8 }}>
        Minimal UI to create a Work Item, run orchestration, and view trace.
      </p>

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <Link
          href="/work-items"
          style={{
            padding: "10px 14px",
            border: "1px solid #ddd",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          Work Items
        </Link>
      </div>
    </main>
  );
}