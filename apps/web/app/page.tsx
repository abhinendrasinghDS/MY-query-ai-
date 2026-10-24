"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BrainCircuit, ShieldCheck, Sparkles, Database, ArrowRight, CheckCircle2,
  Lock, Zap, Code2, FileSpreadsheet, Activity, ChevronDown, ChevronUp,
  Cpu, Terminal, Users, Play, HelpCircle, Layers, Check, ExternalLink,
  Table2, ArrowDownRight
} from "lucide-react";
import { useAuth } from "./lib/auth";
import "./landing.css";

export default function LandingPage() {
  const { user, logout } = useAuth();
  const [activeDemoTab, setActiveDemoTab] = useState<number>(0);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const demoScenarios = [
    {
      question: "What are the top 5 best-selling products?",
      dataset: "sales_data.db",
      sql: `SELECT product_name, SUM(total_amount) AS total_revenue, SUM(quantity) AS total_sold
FROM sales_data
WHERE total_amount IS NOT NULL
GROUP BY product_name
ORDER BY total_revenue DESC
LIMIT 5;`,
      answer: "Found top 5 results. The leading product is Laptop Pro X ($1,350,000 revenue, 30 units), followed by Mobile Galaxy S, Smart TV 55, Wireless Headphones, and Mechanical Keyboard.",
      rows: [
        { product: "Laptop Pro X", revenue: "$1,350,000", units: 30, category: "Electronics" },
        { product: "Mobile Galaxy S", revenue: "$720,000", units: 24, category: "Electronics" },
        { product: "Smart TV 55", revenue: "$550,000", units: 10, category: "Electronics" },
        { product: "Wireless Headphones", revenue: "$320,000", units: 40, category: "Accessories" },
        { product: "Mechanical Keyboard", revenue: "$195,000", units: 35, category: "Accessories" }
      ]
    },
    {
      question: "Which region generated the highest total sales?",
      dataset: "sales_data.db",
      sql: `SELECT region, SUM(total_amount) AS total_sales, COUNT(*) AS total_orders
FROM sales_data
GROUP BY region
ORDER BY total_sales DESC;`,
      answer: "Regional analysis complete. The top-performing region is North with $1,425,000 in total sales across 15 orders, outperforming South ($980,000) and West ($730,000).",
      rows: [
        { region: "North", sales: "$1,425,000", orders: 15, avg: "$95,000" },
        { region: "South", sales: "$980,000", orders: 12, avg: "$81,666" },
        { region: "West", sales: "$730,000", orders: 9, avg: "$81,111" },
        { region: "East", sales: "$520,000", orders: 7, avg: "$74,285" }
      ]
    },
    {
      question: "Which schools had falling enrolment in the latest academic year?",
      dataset: "school_enrolment.db",
      sql: `SELECT school_name, academic_year, enrolment, region
FROM school_enrolment
WHERE enrolment IS NOT NULL
ORDER BY school_name, academic_year ASC;`,
      answer: "Identified 4 schools with declining student enrolment over consecutive years, including: Oakridge Academy (520 → 480 pupils) and Riverdale High (410 → 375 pupils).",
      rows: [
        { school: "Oakridge Academy", change: "-40 pupils", status: "Declining", reliability: "94%" },
        { school: "Riverdale High", change: "-35 pupils", status: "Declining", reliability: "88%" },
        { school: "St. Jude Grammar", change: "-22 pupils", status: "Declining", reliability: "91%" },
        { school: "Maple Grove School", change: "-18 pupils", status: "Declining", reliability: "85%" }
      ]
    }
  ];

  const currentDemo = demoScenarios[activeDemoTab];

  const faqs = [
    {
      q: "What is My Query AI?",
      a: "My Query AI is an intelligent data analyst assistant that bridges the gap between everyday business users and complex databases. You simply ask questions in plain English, and the AI translates your query into validated, read-only SQL, executes it safely, and presents clear answers and tables without needing technical SQL knowledge."
    },
    {
      q: "What database formats can I upload?",
      a: "You can upload SQLite databases (.db, .sqlite, .sqlite3), SQL script dumps (.sql), and tabular CSV files (.csv). Multi-table databases are automatically recognized, cataloged, and inspected via our automated schema discovery engine."
    },
    {
      q: "Is it safe to run against our data? Can it modify or delete records?",
      a: "Yes, it is 100% safe. My Query AI enforces a strict AST-validated read-only policy. Statements containing DROP, DELETE, INSERT, UPDATE, ALTER, or semicolon chaining are automatically blocked by the SQL guardrails before reaching the database engine."
    },
    {
      q: "How does the Google Login work?",
      a: "We provide seamless one-click Google Sign-In as well as email authentication. You can sign in with your Google account to save session preferences, switch between local and cloud LLM providers, and manage your uploaded database catalogs."
    },
    {
      q: "Which AI models power the SQL generation?",
      a: "My Query AI features an intelligent multi-LLM cascade: Google Gemini 1.5 Flash (for lightning-fast cloud intelligence), xAI Grok Beta, local Ollama (Qwen3:8b for 100% offline private execution), and a deterministic pattern-matching engine."
    }
  ];

  return (
    <div className="lp-body">
      {/* Background Glows */}
      <div className="lp-bg-glow lp-glow-1" />
      <div className="lp-bg-glow lp-glow-2" />
      <div className="lp-bg-glow lp-glow-3" />

      {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-container">
          <div className="lp-nav-inner">
            <Link href="/" className="lp-logo">
              <div className="lp-logo-icon">
                <BrainCircuit size={20} color="#fff" />
              </div>
              <span>My Query AI</span>
            </Link>

            <div className="lp-nav-links">
              <a href="#how-it-works" className="lp-nav-link">How It Works</a>
              <a href="#features" className="lp-nav-link">Features</a>
              <a href="#security" className="lp-nav-link">Security &amp; Safety</a>
              <a href="#faq" className="lp-nav-link">FAQ</a>
            </div>

            <div className="lp-nav-actions">
              {user ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="qp-user-topbar-pill">
                    {user.avatar ? (
                      <img src={user.avatar} alt="User" className="qp-user-avatar-img" />
                    ) : (
                      <span style={{ padding: "0 6px", fontWeight: 700 }}>{user.name[0]}</span>
                    )}
                    <span>{user.name}</span>
                  </div>
                  <Link href="/dashboard" className="lp-btn lp-btn-primary lp-btn-sm">
                    Open Dashboard <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <>
                  <Link href="/login" className="lp-btn lp-btn-primary lp-btn-sm">
                    Sign In / Login <ArrowRight size={14} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
      <header className="lp-hero">
        <div className="lp-container">
          <div className="lp-badge">
            <div className="lp-badge-dot" />
            <span>AI-Powered Database Analyst · 100% Read-Only AST Guard</span>
          </div>

          <h1 className="lp-hero-title">
            Talk to Your Database <br />
            <span className="lp-gradient-text">in Plain English.</span>
          </h1>

          <p className="lp-hero-sub">
            Upload any SQLite database, SQL script, or CSV table. My Query AI translates your natural questions
            into deterministic SQL and delivers instant, verified answers — without writing code.
          </p>

          <div className="lp-hero-cta">
            <Link href={user ? "/dashboard" : "/login"} className="lp-btn lp-btn-primary lp-btn-lg">
              <Lock size={16} /> {user ? "Go to Dashboard" : "Sign In / Login"}
            </Link>
            <Link href="/login" className="lp-btn lp-btn-ghost lp-btn-lg">
              {/* Google G icon */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Sign In with Google
            </Link>
          </div>

          <div className="lp-trust-row">
            <div className="lp-trust-item">
              <CheckCircle2 size={15} color="var(--lp-green)" /> Zero SQL Knowledge Needed
            </div>
            <div className="lp-trust-item">
              <ShieldCheck size={15} color="var(--lp-green)" /> Read-Only AST Guardrails
            </div>
            <div className="lp-trust-item">
              <Zap size={15} color="var(--lp-blue)" /> Sub-second Query Speed
            </div>
          </div>

          {/* ── LIVE INTERACTIVE PREVIEW CARD ────────────────────────────── */}
          <div className="lp-preview-card">
            <div className="lp-preview-topbar">
              <div className="lp-preview-dots">
                <div className="lp-preview-dot" style={{ background: "#ef4444" }} />
                <div className="lp-preview-dot" style={{ background: "#f59e0b" }} />
                <div className="lp-preview-dot" style={{ background: "#10b981" }} />
              </div>

              {/* Interactive Demo Tabs */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {demoScenarios.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveDemoTab(idx)}
                    style={{
                      background: activeDemoTab === idx ? "rgba(99, 102, 241, 0.25)" : "transparent",
                      border: "1px solid",
                      borderColor: activeDemoTab === idx ? "var(--lp-accent)" : "transparent",
                      color: activeDemoTab === idx ? "#fff" : "var(--lp-text-muted)",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: 600,
                      transition: "all 0.2s"
                    }}
                  >
                    Demo {idx + 1}
                  </button>
                ))}
              </div>

              <div className="lp-preview-badge">
                <ShieldCheck size={12} /> AST Verified Read-Only
              </div>
            </div>

            <div className="lp-preview-body">
              {/* Question Bar */}
              <div className="lp-preview-prompt-box">
                <div>
                  <div className="lp-prompt-label">User Question in Plain English</div>
                  <div className="lp-prompt-question">"{currentDemo.question}"</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "4px 8px", borderRadius: 6, color: "var(--lp-text-muted)" }}>
                    <Database size={11} style={{ display: "inline", marginRight: 4 }} />
                    {currentDemo.dataset}
                  </span>
                </div>
              </div>

              {/* Side-by-side SQL & Answer */}
              <div className="lp-preview-steps">
                {/* Step 1: SQL */}
                <div className="lp-preview-step-box">
                  <div className="lp-step-box-title">
                    <Code2 size={14} color="var(--lp-accent)" /> Synthesized Safe SQL
                  </div>
                  <pre className="lp-sql-code">{currentDemo.sql}</pre>
                </div>

                {/* Step 2: Natural Answer & Preview Table */}
                <div className="lp-preview-step-box">
                  <div className="lp-step-box-title">
                    <Sparkles size={14} color="var(--lp-green)" /> Natural Language Answer
                  </div>
                  <div className="lp-answer-output">
                    {currentDemo.answer}
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, color: "var(--lp-text-dim)", marginBottom: 6, textTransform: "uppercase", fontWeight: 700 }}>
                      Result Preview ({currentDemo.rows.length} rows)
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 8, maxHeight: 110, overflowY: "auto" }}>
                      {currentDemo.rows.slice(0, 3).map((r, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontWeight: 600 }}>{Object.values(r)[0]}</span>
                          <span style={{ color: "#a5b4fc" }}>{Object.values(r)[1]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── THE PROBLEM VS SOLUTION SECTION ─────────────────────────────── */}
      <section className="lp-section" id="how-it-works">
        <div className="lp-container">
          <div className="lp-section-header">
            <div className="lp-section-tag">The Core Problem &amp; Solution</div>
            <h2 className="lp-section-title">Why My Query AI Exists</h2>
            <p className="lp-section-sub">
              Companies generate gigabytes of data every day. But retrieving answers still relies on outdated, slow, and risky traditional pipelines.
            </p>
          </div>

          <div className="lp-comparison-grid">
            {/* The Traditional Bottleneck */}
            <div className="lp-compare-card bad">
              <div className="lp-compare-tag bad">
                ✕ Traditional Workflow
              </div>
              <h3 className="lp-compare-title">The Bottleneck: Writing SQL &amp; Waiting</h3>
              <ul className="lp-compare-list">
                <li className="lp-compare-item">
                  <span className="lp-compare-icon" style={{ color: "#ef4444" }}>✕</span>
                  <span>Managers have to write complex SQL (GROUP BY, JOINs, nested subqueries) or wait days for data analysts.</span>
                </li>
                <li className="lp-compare-item">
                  <span className="lp-compare-icon" style={{ color: "#ef4444" }}>✕</span>
                  <span>High risk of accidental data modification (accidental UPDATE/DELETE mutations causing downtime).</span>
                </li>
                <li className="lp-compare-item">
                  <span className="lp-compare-icon" style={{ color: "#ef4444" }}>✕</span>
                  <span>Messy data traps: spelling inconsistencies, NULL values, and hidden duplicates create misleading conclusions.</span>
                </li>
                <li className="lp-compare-item">
                  <span className="lp-compare-icon" style={{ color: "#ef4444" }}>✕</span>
                  <span>Huge engineering overhead for routine business inquiries.</span>
                </li>
              </ul>
            </div>

            {/* My Query AI Solution */}
            <div className="lp-compare-card good">
              <div className="lp-compare-tag good">
                ✓ The My Query AI Way
              </div>
              <h3 className="lp-compare-title">Instant, Safe &amp; Verified Intelligence</h3>
              <ul className="lp-compare-list">
                <li className="lp-compare-item">
                  <span className="lp-compare-icon" style={{ color: "var(--lp-green)" }}>✓</span>
                  <span><strong>Ask in Plain English:</strong> Type natural questions and get instantaneous answers with clean charts and tables.</span>
                </li>
                <li className="lp-compare-item">
                  <span className="lp-compare-icon" style={{ color: "var(--lp-green)" }}>✓</span>
                  <span><strong>Strict AST Read-Only Protection:</strong> Deterministic safety layer guarantees zero database writes or mutations.</span>
                </li>
                <li className="lp-compare-item">
                  <span className="lp-compare-icon" style={{ color: "var(--lp-green)" }}>✓</span>
                  <span><strong>Automated Data Profiler:</strong> Detects null anomalies, distinct sample rates, and duplicates automatically.</span>
                </li>
                <li className="lp-compare-item">
                  <span className="lp-compare-icon" style={{ color: "var(--lp-green)" }}>✓</span>
                  <span><strong>Full Verifiable Evidence:</strong> See the generated SQL, assumptions, and execution metrics behind every single answer.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 SIMPLE STEPS ──────────────────────────────────────────────── */}
      <section className="lp-section" style={{ background: "rgba(255,255,255,0.01)" }}>
        <div className="lp-container">
          <div className="lp-section-header">
            <div className="lp-section-tag">How It Works</div>
            <h2 className="lp-section-title">4 Simple Steps from Question to Answer</h2>
            <p className="lp-section-sub">
              No SQL expertise needed. Seamlessly connect and query in under 60 seconds.
            </p>
          </div>

          <div className="lp-steps-grid">
            <div className="lp-step-card">
              <div className="lp-step-num">1</div>
              <h4 className="lp-step-title">Upload Database</h4>
              <p className="lp-step-desc">
                Drag and drop your SQLite file (.db, .sqlite, .sqlite3), SQL dump (.sql), or tabular CSV files directly.
              </p>
            </div>

            <div className="lp-step-card">
              <div className="lp-step-num">2</div>
              <h4 className="lp-step-title">Ask in Plain English</h4>
              <p className="lp-step-desc">
                Type your business question naturally (e.g. <em>"What are the top 5 selling products?"</em> or <em>"Sales by region?"</em>).
              </p>
            </div>

            <div className="lp-step-card">
              <div className="lp-step-num">3</div>
              <h4 className="lp-step-title">AST Guard Verification</h4>
              <p className="lp-step-desc">
                The AI synthesizes SQL, which is immediately parsed by the AST security engine to verify it is 100% read-only.
              </p>
            </div>

            <div className="lp-step-card">
              <div className="lp-step-num">4</div>
              <h4 className="lp-step-title">Instant Verified Insights</h4>
              <p className="lp-step-desc">
                Receive natural language answers, interactive result tables, verified SQL code, and one-click CSV exports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE FEATURES ───────────────────────────────────────────────── */}
      <section className="lp-section" id="features">
        <div className="lp-container">
          <div className="lp-section-header">
            <div className="lp-section-tag">Powerful Architecture</div>
            <h2 className="lp-section-title">Engineered for Accuracy &amp; Peace of Mind</h2>
            <p className="lp-section-sub">
              Combining cutting-edge LLMs with deterministic validation and security guardrails.
            </p>
          </div>

          <div className="lp-features-grid">
            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--lp-green)" }}>
                <ShieldCheck size={24} />
              </div>
              <h3 className="lp-feature-title">Read-Only AST Guard</h3>
              <p className="lp-feature-desc">
                Never worry about accidental data deletion. Every query is parsed into an abstract syntax tree and blocked if mutation tokens are detected.
              </p>
            </div>

            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--lp-accent)" }}>
                <Cpu size={24} />
              </div>
              <h3 className="lp-feature-title">Multi-LLM Cascade</h3>
              <p className="lp-feature-desc">
                Connect with Google Gemini 1.5 Flash, xAI Grok Beta, or run completely offline with local Ollama (Qwen3:8b) for total privacy.
              </p>
            </div>

            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: "rgba(56, 189, 248, 0.15)", color: "var(--lp-blue)" }}>
                <Activity size={24} />
              </div>
              <h3 className="lp-feature-title">Automated Data Profiler</h3>
              <p className="lp-feature-desc">
                Inspect null rates, sample distinct cardinality, duplicate candidate values, and messy data hazards in real time.
              </p>
            </div>

            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "var(--lp-amber)" }}>
                <Table2 size={24} />
              </div>
              <h3 className="lp-feature-title">Schema Discovery</h3>
              <p className="lp-feature-desc">
                Auto-discovers table schemas, inferred data types, column constraints, and foreign key relations across all tables.
              </p>
            </div>

            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: "rgba(236, 72, 153, 0.15)", color: "#ec4899" }}>
                <FileSpreadsheet size={24} />
              </div>
              <h3 className="lp-feature-title">One-Click CSV Exports</h3>
              <p className="lp-feature-desc">
                Download verified results, formatted tables, and execution evidence for external reporting and executive presentations.
              </p>
            </div>

            <div className="lp-feature-card">
              <div className="lp-feature-icon" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#a78bfa" }}>
                <Code2 size={24} />
              </div>
              <h3 className="lp-feature-title">Full SQL Transparency</h3>
              <p className="lp-feature-desc">
                Review and copy the exact generated SQL query. Complete visibility into execution duration, row counts, and assumptions.
              </p>
            </div>
          </div>

          {/* Supported Formats */}
          <div style={{ textAlign: "center", marginTop: 50 }}>
            <div style={{ fontSize: 13, color: "var(--lp-text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              Supported Database Formats
            </div>
            <div className="lp-formats-row">
              <div className="lp-format-pill">
                <Database size={16} color="var(--lp-accent)" /> SQLite Database (.db, .sqlite, .sqlite3)
              </div>
              <div className="lp-format-pill">
                <Terminal size={16} color="var(--lp-green)" /> SQL Migration / Dump Script (.sql)
              </div>
              <div className="lp-format-pill">
                <FileSpreadsheet size={16} color="var(--lp-blue)" /> Tabular Data Source (.csv)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION ─────────────────────────────────────────────────── */}
      <section className="lp-section" id="faq">
        <div className="lp-container">
          <div className="lp-section-header">
            <div className="lp-section-tag">Frequently Asked Questions</div>
            <h2 className="lp-section-title">Got Questions? We Have Answers.</h2>
            <p className="lp-section-sub">
              Everything you need to know about My Query AI, security, and setup.
            </p>
          </div>

          <div className="lp-faq-list">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`lp-faq-item ${faqOpen === i ? "open" : ""}`}
              >
                <div
                  className="lp-faq-question"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  {faqOpen === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
                {faqOpen === i && (
                  <div className="lp-faq-answer">{faq.a}</div>
                )}
              </div>
            ))}
          </div>

          {/* CTA Banner */}
          <div className="lp-cta-card">
            <h3 className="lp-cta-title">Ready to Query Your Data in Plain English?</h3>
            <p className="lp-cta-sub">
              Sign in with your Google account or start querying right away as a guest analyst. No credit card required.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              <Link href={user ? "/dashboard" : "/login"} className="lp-btn lp-btn-primary lp-btn-lg">
                <Lock size={16} /> {user ? "Open Workspace" : "Sign In / Login Now"} <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="lp-btn lp-btn-ghost lp-btn-lg">
                Sign In with Google
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="lp-logo-icon" style={{ width: 28, height: 28, borderRadius: 6 }}>
                <BrainCircuit size={16} color="#fff" />
              </div>
              <strong style={{ color: "#fff", fontSize: 15 }}>My Query AI</strong>
              <span>— Reliable Natural Language Database Intelligence</span>
            </div>

            <div style={{ display: "flex", gap: 20 }}>
              <Link href="/login" style={{ color: "var(--lp-text-muted)", textDecoration: "none" }}>Sign In</Link>
              <Link href="/dashboard" style={{ color: "var(--lp-text-muted)", textDecoration: "none" }}>Workspace</Link>
              <a href="#security" style={{ color: "var(--lp-text-muted)", textDecoration: "none" }}>Security Policy</a>
            </div>

            <div>
              &copy; {new Date().getFullYear()} My Query AI. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
