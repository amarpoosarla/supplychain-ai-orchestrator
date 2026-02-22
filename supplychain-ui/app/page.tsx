import Link from "next/link";

export default function Home() {
  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      padding: "48px 20px",
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      color: "#EAF0FF",
      background:
        "radial-gradient(1200px 600px at 10% 10%, rgba(99,102,241,0.35), rgba(0,0,0,0) 60%)," +
        "radial-gradient(900px 500px at 90% 30%, rgba(16,185,129,0.22), rgba(0,0,0,0) 55%)," +
        "linear-gradient(135deg, #070A13 0%, #0B1020 50%, #070A13 100%)",
    },
    container: {
      maxWidth: 1100,
      margin: "0 auto",
    },
    nav: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "12px 14px",
      borderRadius: 16,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(10px)",
    },
    brand: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontWeight: 700,
      letterSpacing: 0.3,
    },
    logo: {
      width: 34,
      height: 34,
      borderRadius: 10,
      background:
        "linear-gradient(135deg, rgba(99,102,241,1) 0%, rgba(16,185,129,1) 100%)",
      boxShadow: "0 10px 30px rgba(99,102,241,0.25)",
    },
    pill: {
      fontSize: 12,
      padding: "6px 10px",
      borderRadius: 999,
      background: "rgba(99,102,241,0.14)",
      border: "1px solid rgba(99,102,241,0.35)",
      color: "#C7D2FE",
      whiteSpace: "nowrap",
    },
    hero: {
      marginTop: 34,
      padding: "34px 22px",
      borderRadius: 22,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(12px)",
      boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    },
    headline: {
      fontSize: 44,
      lineHeight: 1.1,
      margin: 0,
      fontWeight: 800,
      letterSpacing: -0.6,
    },
    subhead: {
      marginTop: 12,
      marginBottom: 0,
      fontSize: 16,
      lineHeight: 1.6,
      color: "rgba(234,240,255,0.75)",
      maxWidth: 780,
    },
    ctaRow: {
      marginTop: 22,
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      alignItems: "center",
    },
    primaryBtn: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: "12px 16px",
      borderRadius: 12,
      textDecoration: "none",
      fontWeight: 700,
      color: "#0B1020",
      background:
        "linear-gradient(135deg, rgba(99,102,241,1) 0%, rgba(16,185,129,1) 100%)",
      boxShadow: "0 14px 40px rgba(99,102,241,0.25)",
      border: "1px solid rgba(255,255,255,0.15)",
    },
    secondaryBtn: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: "12px 16px",
      borderRadius: 12,
      textDecoration: "none",
      fontWeight: 700,
      color: "#EAF0FF",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.14)",
    },
    smallLinkRow: {
      marginTop: 10,
      display: "flex",
      flexWrap: "wrap",
      gap: 14,
      fontSize: 13,
      color: "rgba(234,240,255,0.7)",
    },
    smallLink: {
      color: "rgba(234,240,255,0.85)",
      textDecoration: "none",
      borderBottom: "1px solid rgba(234,240,255,0.25)",
      paddingBottom: 2,
    },
    grid: {
      marginTop: 22,
      display: "grid",
      gridTemplateColumns: "repeat(12, 1fr)",
      gap: 14,
    },
    card: {
      gridColumn: "span 4",
      padding: "16px 16px",
      borderRadius: 16,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(10px)",
      boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
      minHeight: 120,
    },
    cardTitle: {
      margin: 0,
      fontSize: 15,
      fontWeight: 800,
      letterSpacing: 0.1,
    },
    cardBody: {
      marginTop: 8,
      marginBottom: 0,
      fontSize: 13,
      lineHeight: 1.6,
      color: "rgba(234,240,255,0.72)",
    },
    statusStrip: {
      marginTop: 18,
      padding: "14px 16px",
      borderRadius: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      flexWrap: "wrap",
    },
    statusLeft: {
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      background: "rgba(16,185,129,1)",
      boxShadow: "0 0 0 4px rgba(16,185,129,0.18)",
    },
    statusText: {
      fontSize: 13,
      color: "rgba(234,240,255,0.75)",
      margin: 0,
    },
    tech: {
      fontSize: 12,
      color: "rgba(234,240,255,0.65)",
      margin: 0,
      padding: "6px 10px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
    footer: {
      marginTop: 26,
      fontSize: 12,
      color: "rgba(234,240,255,0.55)",
      textAlign: "center",
    },
  };

  // Responsive tweak without Tailwind: collapse cards on smaller screens
  // Next.js renders server-side; keep it simple and let grid wrap naturally.
  // Most browsers will stack because of limited width; if you want perfect mobile,
  // we can switch to CSS module later.

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* Top Nav */}
        <header style={styles.nav}>
          <div style={styles.brand}>
            <div style={styles.logo} />
            <div>
              <div>Supply Chain AI Orchestrator</div>
              <div style={{ fontSize: 12, color: "rgba(234,240,255,0.6)" }}>
                Decision automation + human-in-the-loop escalation
              </div>
            </div>
          </div>
          <div style={styles.pill}>Production Ready</div>
        </header>

        {/* Hero */}
        <section style={styles.hero}>
          <h1 style={styles.headline}>
            AI-powered decision engine for supply chain exceptions
          </h1>
          <p style={styles.subhead}>
            Create work items, retrieve SLA and SOP knowledge, and run an
            explainable orchestration flow that recommends <b>ESCALATE</b> or{" "}
            <b>AUTO_RESOLVE</b> with confidence and traceability.
          </p>

          <div style={styles.ctaRow}>
            <Link href="/work-items" style={styles.primaryBtn}>
              🚀 Launch Work Items
            </Link>

            <Link href="/portfolio" style={styles.secondaryBtn}>
              📊 Executive Metrics
            </Link>
          </div>

          <div style={styles.smallLinkRow}>
            <a href="/docs" style={styles.smallLink} target="_blank" rel="noreferrer">
              API Docs
            </a>
            <a href="/healthz" style={styles.smallLink} target="_blank" rel="noreferrer">
              Health Check
            </a>
            <a href="/version" style={styles.smallLink} target="_blank" rel="noreferrer">
              Version
            </a>
          </div>

          {/* Feature Grid */}
          <div style={styles.grid}>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>⚡ Real-time orchestration</h3>
              <p style={styles.cardBody}>
                Trigger decision flows for shipment delays, inventory risk, and
                high-value orders with clear, auditable outcomes.
              </p>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🧠 LLM + RAG intelligence</h3>
              <p style={styles.cardBody}>
                Retrieve relevant SLA/SOP rules from pgvector and use an LLM
                agent to generate structured recommendations and confidence.
              </p>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🔎 Explainability trace</h3>
              <p style={styles.cardBody}>
                Every decision is stored with reason, confidence, and history,
                enabling executive review and continuous improvement.
              </p>
            </div>
          </div>

          {/* Status strip */}
          <div style={styles.statusStrip}>
            <div style={styles.statusLeft}>
              <div style={styles.dot} />
              <p style={styles.statusText}>
                System status: <b>Online</b> (API + DB connected)
              </p>
            </div>

            <p style={styles.tech}>
              FastAPI • PostgreSQL • pgvector • OpenAI • Render • GitHub Actions
            </p>
          </div>
        </section>

        <div style={styles.footer}>
          © {new Date().getFullYear()} Supply Chain AI Orchestrator • Built for
          production demos and portfolio-grade deployments
        </div>
      </div>
    </main>
  );
}