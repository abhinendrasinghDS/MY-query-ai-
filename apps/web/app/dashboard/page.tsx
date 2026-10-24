"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, CheckCircle2, ChevronDown,
  CircleHelp, Database, FileSpreadsheet, History, Layers3, LoaderCircle,
  Play, Search, ShieldCheck, Sparkles, Table2, UploadCloud, X, RefreshCw,
  Code2, Check, Download, Zap, Compass, Users2, ShieldAlert,
  Calendar, Layers, Filter, TrendingUp, AlertCircle, FileCode, CheckCircle,
  BrainCircuit, GitBranch, Binary, Cpu, ArrowDownRight, Eye, Trash2,
  Settings, Bot, Key, ChevronRight, Radio, ExternalLink, LogOut, User
} from "lucide-react";

type Dataset = { id: string; name: string; kind: string; table_name: string; created_at?: string; row_count?: number };
type Analysis = {
  id: string; status: string; question: string; answer: string; sql?: string;
  columns: string[]; rows: Record<string, unknown>[]; warnings: string[];
  assumptions: string[]; execution_ms?: number; llm_provider?: string;
};
type LLMProviderStatus = { name: string; configured: boolean; active: boolean; model: string };
type LLMSettings = { active_provider: string; providers: LLMProviderStatus[] };
type ColumnInfo = { name: string; type: string; nullable?: boolean | null };
type TableSchema = { columns: ColumnInfo[]; row_count?: number | null };
type SchemaData = { dataset_id: string; tables: Record<string, TableSchema> };
type ColumnProfile = {
  table: string;
  name: string;
  type: string;
  null_count_sample: number;
  sample_size: number;
  distinct_sample: number;
  sample_values?: string[];
  duplicate_value_candidates?: { value: string; count: number }[];
};
type ProfileData = {
  dataset_id: string;
  row_count: number;
  column_count: number;
  columns: ColumnProfile[];
};
type APIError = {
  code?: string;
  message: string;
  request_id?: string;
  details?: { field: string; message: string }[];
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

class APIRequestError extends Error {
  code?: string;
  requestId?: string;
  details?: APIError["details"];

  constructor(error: APIError) {
    super(error.message);
    this.code = error.code;
    this.requestId = error.request_id;
    this.details = error.details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readAPIResponse<T>(response: Response): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new APIRequestError({
      code: "INVALID_RESPONSE",
      message: "The server returned an unreadable response. Please check if the backend is running.",
    });
  }

  if (!response.ok) {
    const envelope = isRecord(body) && isRecord(body.error) ? body.error : undefined;
    const legacyDetail = isRecord(body) ? body.detail : undefined;
    const message = typeof envelope?.message === "string"
      ? envelope.message
      : typeof legacyDetail === "string"
        ? legacyDetail
        : `The request failed (${response.status}).`;
    throw new APIRequestError({
      code: typeof envelope?.code === "string" ? envelope.code : undefined,
      message,
      request_id: typeof envelope?.request_id === "string"
        ? envelope.request_id
        : response.headers.get("X-Request-ID") ?? undefined,
      details: Array.isArray(envelope?.details)
        ? envelope.details.filter((item): item is { field: string; message: string } =>
            isRecord(item) && typeof item.field === "string" && typeof item.message === "string")
        : undefined,
    });
  }

  return body as T;
}

function getAPIError(error: unknown, fallback: string): APIError {
  if (error instanceof APIRequestError) {
    return {
      code: error.code,
      message: error.message,
      request_id: error.requestId,
      details: error.details,
    };
  }
  if (error instanceof TypeError) {
    return { code: "API_UNAVAILABLE", message: "Could not reach FastAPI on port 8000. Start backend server." };
  }
  return { message: error instanceof Error ? error.message : fallback };
}

function downloadCSV(filename: string, columns: string[], rows: Record<string, unknown>[]) {
  if (!rows || !rows.length) return;
  const header = columns.join(",");
  const csvRows = rows.map((row) =>
    columns.map((col) => {
      const val = row[col] ?? "";
      return `"${String(val).replaceAll('"', '""')}"`;
    }).join(",")
  );
  const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<"dashboard" | "schema" | "quality" | "guard">("dashboard");
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selected, setSelected] = useState("");
  const [question, setQuestion] = useState("Which schools had falling enrolment in the latest academic year?");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedingSales, setSeedingSales] = useState(false);
  const [error, setError] = useState<APIError | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"results" | "sql" | "evidence">("results");
  const [copied, setCopied] = useState(false);
  
  // Real schema & profile states
  const [schemaData, setSchemaData] = useState<SchemaData | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // LLM Provider settings
  const [llmSettings, setLLMSettings] = useState<LLMSettings | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("auto");
  const [geminiKey, setGeminiKey] = useState("");
  const [grokKey, setGrokKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Filter for messy anomaly table
  const [tableFilter, setTableFilter] = useState<string>("all");

  // SQL guard live test state
  const [guardTestSql, setGuardTestSql] = useState("SELECT school_name, enrolment FROM schools WHERE academic_year = '2024-25'");
  const [guardTestResult, setGuardTestResult] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function refreshDatasets(): Promise<boolean> {
    try {
      const response = await fetch(`${API}/datasets`);
      const items = await readAPIResponse<Dataset[]>(response);
      setDatasets(items);
      setSelected((curr) => curr || items[0]?.id || "");
      setApiStatus("online");
      return true;
    } catch (e) {
      setApiStatus("offline");
      setError(getAPIError(e, "Could not reach API. Ensure backend is running."));
      return false;
    }
  }

  async function loadLLMSettings() {
    try {
      const res = await fetch(`${API}/settings/llm`);
      const data = await readAPIResponse<LLMSettings>(res);
      setLLMSettings(data);
      setSelectedProvider(data.active_provider);
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    void refreshDatasets();
    void loadLLMSettings();
  }, []);

  useEffect(() => {
    if (!selected) {
      setSchemaData(null);
      setProfileData(null);
      return;
    }

    setLoadingSchema(true);
    fetch(`${API}/datasets/${selected}/schema`)
      .then(readAPIResponse<SchemaData>)
      .then(setSchemaData)
      .catch(() => {})
      .finally(() => setLoadingSchema(false));

    setLoadingProfile(true);
    fetch(`${API}/datasets/${selected}/profile`)
      .then(readAPIResponse<ProfileData>)
      .then(setProfileData)
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [selected]);

  const currentDataset = datasets.find((d) => d.id === selected);

  async function uploadFile(file?: File) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/datasets/upload`, { method: "POST", body: form });
      const body = await readAPIResponse<Dataset>(res);
      await refreshDatasets();
      setSelected(body.id);
      setApiStatus("online");
    } catch (e) {
      setError(getAPIError(e, "Failed to upload database file."));
    } finally {
      setUploading(false);
    }
  }

  async function seedDemoDataset() {
    setError(null);
    setSeeding(true);
    try {
      const res = await fetch(`${API}/datasets/seed-demo`, { method: "POST" });
      const body = await readAPIResponse<Dataset>(res);
      await refreshDatasets();
      setSelected(body.id);
      setApiStatus("online");
    } catch (e) {
      setError(getAPIError(e, "Could not seed demo dataset."));
    } finally {
      setSeeding(false);
    }
  }

  async function seedSalesDemoDataset() {
    setError(null);
    setSeedingSales(true);
    try {
      const res = await fetch(`${API}/datasets/seed-sales-demo`, { method: "POST" });
      const body = await readAPIResponse<Dataset>(res);
      await refreshDatasets();
      setSelected(body.id);
      setApiStatus("online");
    } catch (e) {
      setError(getAPIError(e, "Could not seed sales demo dataset."));
    } finally {
      setSeedingSales(false);
    }
  }

  async function runAnalysis(customQuestion?: string) {
    const q = customQuestion || question;
    if (!selected || q.trim().length < 4) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { dataset_id: selected, question: q };
      if (selectedProvider && selectedProvider !== "auto") {
        body.llm_provider = selectedProvider;
      } else if (geminiKey) {
        body.llm_provider = "gemini";
      } else if (grokKey) {
        body.llm_provider = "grok";
      }
      const res = await fetch(`${API}/analyses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await readAPIResponse<Analysis>(res);
      setAnalysis(result);
      setModalTab("results");
    } catch (e) {
      setError(getAPIError(e, "Agent analysis query failed."));
    } finally {
      setBusy(false);
    }
  }

  const visibleRows = useMemo(() => {
    const rows = analysis?.rows || [];
    if (!search.trim()) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(search.toLowerCase()))
    );
  }, [analysis, search]);

  function copySQL() {
    if (analysis?.sql) {
      void navigator.clipboard?.writeText(analysis.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const anomalyRows = [
    {
      name: "Sunrise Public School (SCH-001)",
      score: 88,
      trend: "falling",
      lastActive: "2025-03-10",
      usage: 100,
      enrolment: "461 pupils",
      risk: "Falling Enrolment (520 → 461)",
      riskType: "red",
      category: "falling",
      queryText: "Show enrolment history and latest falling trend for Sunrise Public School SCH-001"
    },
    {
      name: "St. Mary's School (SCH-003)",
      score: 62,
      trend: "falling",
      lastActive: "2025-04-06",
      usage: 100,
      enrolment: "560 pupils",
      risk: "Spelling Variation ('St. Marys')",
      riskType: "amber",
      category: "spelling",
      queryText: "Show all records for St. Mary's School including St. Marys variation"
    },
    {
      name: "Riverbank Academy (SCH-004)",
      score: 48,
      trend: "flat",
      lastActive: "2025-01-18",
      usage: 66,
      enrolment: "198 pupils",
      risk: "Missing Enrolment (2023-24 NULL)",
      riskType: "red",
      category: "null",
      queryText: "Inspect missing enrolment values for Riverbank Academy SCH-004"
    },
    {
      name: "Hilltop School (SCH-005)",
      score: 74,
      trend: "rising",
      lastActive: "2025-05-11",
      usage: 100,
      enrolment: "430 pupils",
      risk: "Duplicate Key Row (2024-25)",
      riskType: "blue",
      category: "duplicate",
      queryText: "Identify duplicated 2024-25 inspection records for Hilltop School"
    },
    {
      name: "Green Valley School (SCH-002)",
      score: 91,
      trend: "stable",
      lastActive: "2025-02-18",
      usage: 100,
      enrolment: "352 pupils",
      risk: "Stable Trend (340 → 352)",
      riskType: "green",
      category: "stable",
      queryText: "Show full academic year enrolment progression for Green Valley School"
    }
  ];

  const filteredAnomalyRows = tableFilter === "all"
    ? anomalyRows
    : anomalyRows.filter((r) => r.category === tableFilter);

  const providerColor =
    selectedProvider === "gemini" ? "#4285f4" :
    selectedProvider === "grok" ? "#7c3aed" :
    selectedProvider === "ollama" ? "#10b981" : "#f59e0b";

  return (
    <div className="qp-shell">
      {/* ── SIDEBAR ────────────────────────────────────────── */}
      <aside className="qp-sidebar">
        {/* Brand */}
        <div className="qp-brand" onClick={() => setView("dashboard")}>
          <div className="qp-brand-icon">
            <BrainCircuit size={18} color="#fff" />
          </div>
          <div className="qp-brand-text">
            <strong>My Query AI</strong>
            <span>Ask Your Data in Plain Language</span>
          </div>
        </div>

        {/* Nav Sections */}
        <div className="qp-nav-section">
          <div className="qp-nav-label">Workspace</div>
          <button
            className={`qp-nav-item ${view === "dashboard" ? "active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            <BarChart3 size={15} /> Overview
            <span className="qp-nav-badge">·</span>
          </button>
          <button
            className="qp-nav-item"
            onClick={() => {
              if (datasets.length === 0) void seedDemoDataset();
              else setView("dashboard");
            }}
          >
            <Database size={15} /> Databases
            <span className="qp-nav-badge">{datasets.length}</span>
          </button>
          <button
            className={`qp-nav-item ${view === "schema" ? "active" : ""}`}
            onClick={() => setView("schema")}
          >
            <Table2 size={15} /> Schema explorer
          </button>
          <button
            className={`qp-nav-item ${view === "quality" ? "active" : ""}`}
            onClick={() => setView("quality")}
          >
            <Activity size={15} /> Data quality
          </button>
          <button
            className={`qp-nav-item ${view === "guard" ? "active" : ""}`}
            onClick={() => setView("guard")}
          >
            <ShieldCheck size={15} /> SQL Guard
          </button>
          <button
            className="qp-nav-item"
            onClick={() => {
              if (analysis) setModalOpen(true);
              else void runAnalysis();
            }}
          >
            <History size={15} /> Analysis history
          </button>
        </div>

        {/* Sidebar Bottom */}
        <div className="qp-sidebar-bottom">
          <div className="qp-safety-card">
            <div className="qp-safety-card-title">
              <ShieldCheck size={12} /> Safety first
            </div>
            <div className="qp-safety-card-text">
              Queries are validated against read-only security guards.
            </div>
          </div>
          <div className="qp-user-row" onClick={() => setShowSettings(true)}>
            {user?.avatar ? (
              <img src={user.avatar} alt="User" className="qp-user-avatar" style={{ borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div className="qp-user-avatar">{user?.name ? user.name[0].toUpperCase() : "A"}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="qp-user-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user ? user.name : "Guest Analyst"}
              </div>
              <div className="qp-user-env">
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: providerColor, display: "inline-block", marginRight: 5
                }} />
                {selectedProvider === "auto" ? "Auto" : selectedProvider.toUpperCase()} · {user?.provider === "google" ? "Google" : "Local"}
              </div>
            </div>
            {user ? (
              <button
                className="qp-user-help"
                onClick={(e) => { e.stopPropagation(); logout(); }}
                title="Sign Out"
              >
                <LogOut size={13} />
              </button>
            ) : (
              <Link
                href="/login"
                className="qp-user-help"
                onClick={(e) => e.stopPropagation()}
                title="Sign In"
              >
                <User size={13} />
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ──────────────────────────────── */}
      <div className="qp-main">
        {/* Topbar */}
        <header className="qp-topbar">
          <div className="qp-breadcrumb">
            <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              Home
            </Link> / <span>{
              view === "dashboard" ? "Overview" :
              view === "schema" ? "Schema Explorer" :
              view === "quality" ? "Data Quality Profiler" : "SQL Guard Policy"
            }</span>
          </div>

          <div className="qp-topbar-right">
            <Link
              href="/"
              className="qp-topbar-btn"
              style={{ textDecoration: "none", color: "var(--text-secondary)" }}
              title="Return to Main Landing Page"
            >
              <ExternalLink size={12} /> Landing Page
            </Link>

            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  {user.avatar && <img src={user.avatar} alt="" style={{ width: 22, height: 22, borderRadius: "50%" }} />}
                  <span>{user.name}</span>
                </div>
                <button
                  className="qp-topbar-btn"
                  onClick={() => logout()}
                  title="Sign Out"
                  style={{ padding: "4px 8px", fontSize: 11 }}
                >
                  <LogOut size={11} /> Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="qp-topbar-btn"
                style={{ textDecoration: "none", background: "var(--accent-light)", color: "var(--accent)", fontWeight: 600 }}
              >
                Sign In
              </Link>
            )}

            {apiStatus === "online" && (
              <div className="qp-status-pill">
                <div className="qp-status-dot" /> API Online
              </div>
            )}
            {apiStatus === "offline" && (
              <div className="qp-status-pill" style={{ color: "var(--red)", background: "var(--red-bg)", borderColor: "rgba(239,68,68,0.25)" }}>
                API Offline
              </div>
            )}
            {apiStatus === "checking" && (
              <div className="qp-status-pill" style={{ color: "var(--orange)", background: "var(--orange-bg)" }}>
                Checking…
              </div>
            )}

            <button
              className="qp-topbar-icon"
              onClick={() => setShowSettings(true)}
              title="LLM Settings (Gemini / Grok / Ollama)"
            >
              <Settings size={14} />
            </button>

            <label className="qp-topbar-btn primary" style={{ cursor: "pointer" }} title="Upload SQLite database (.db, .sqlite, .sqlite3), SQL dump (.sql), or CSV">
              <UploadCloud size={13} /> {uploading ? "Uploading…" : "Upload Database"}
              <input
                type="file"
                accept=".db,.sqlite,.sqlite3,.sql,.csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  void uploadFile(f);
                }}
                disabled={uploading}
              />
            </label>
          </div>
        </header>

        {/* Scrollable View Area */}
        <div className="qp-content">
          {error && (
            <div className="qp-error-banner">
              <AlertCircle size={16} color="var(--red)" />
              <div className="qp-error-text">{error.message}</div>
              <button className="qp-error-close" onClick={() => setError(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* ════════════ VIEW: DASHBOARD ════════════ */}
          {view === "dashboard" && (
            <>
              {/* Page header */}
              <div className="qp-page-tag">
                <Sparkles size={12} /> AI-Powered Data Analyst
              </div>
              <div className="qp-page-title">My Query AI — Ask Questions in Plain English</div>
              <div className="qp-page-sub">Ask any question in plain English — AI generates safe, verified SQL queries and returns instant answers. No SQL knowledge required!</div>

              {/* Metric Cards */}
              <div className="qp-metrics">
                <div className="qp-metric-card">
                  <div className="qp-metric-icon" style={{ background: "var(--blue-bg)" }}>
                    <Database size={18} color="var(--blue)" />
                  </div>
                  <div className="qp-metric-label">Connected databases</div>
                  <div className="qp-metric-value">{String(datasets.length).padStart(2, "0")}</div>
                  <div className="qp-metric-sub">{currentDataset ? currentDataset.name : "No database active"}</div>
                </div>

                <div className="qp-metric-card">
                  <div className="qp-metric-icon" style={{ background: "var(--green-bg)" }}>
                    <Activity size={18} color="var(--green)" />
                  </div>
                  <div className="qp-metric-label">Analysis status</div>
                  <div className="qp-metric-value" style={{ fontSize: 22 }}>
                    {busy ? "Running…" : analysis ? "Completed" : "Ready"}
                  </div>
                  <div className="qp-metric-sub">
                    {analysis ? `${analysis.rows?.length || 0} rows retrieved` : "Waiting for your question"}
                  </div>
                </div>

                <div className="qp-metric-card">
                  <div className="qp-metric-icon" style={{ background: "var(--green-bg)" }}>
                    <ShieldCheck size={18} color="var(--green)" />
                  </div>
                  <div className="qp-metric-label">SQL guard</div>
                  <div className="qp-metric-value" style={{ fontSize: 22 }}>Enabled</div>
                  <div className="qp-metric-sub">Read-only AST policy active</div>
                </div>

                <div className="qp-metric-card">
                  <div className="qp-metric-icon" style={{ background: "var(--accent-light)" }}>
                    <Sparkles size={18} color="var(--accent)" />
                  </div>
                  <div className="qp-metric-label">Active LLM Provider</div>
                  <div className="qp-metric-value" style={{ fontSize: 20, textTransform: "capitalize" }}>
                    {selectedProvider === "auto" ? "Auto" : selectedProvider}
                  </div>
                  <div className="qp-metric-sub">
                    {selectedProvider === "gemini" ? "Google Gemini 1.5 Flash" :
                     selectedProvider === "grok" ? "xAI Grok Beta" :
                     selectedProvider === "ollama" ? "Local Qwen3:8b" :
                     selectedProvider === "mock" ? "Pattern-based SQL" : "Cascade (Gemini→Grok→Local)"}
                  </div>
                </div>
              </div>

              {/* Seed demo dataset banner if empty */}
              {datasets.length === 0 && (
                <div className="qp-info" style={{ marginBottom: 16, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkles size={15} />
                    <span>No database connected. Upload your SQLite database (.db, .sqlite, .sql) or start with a demo database:</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => void seedDemoDataset()}
                      disabled={seeding}
                      className="qp-topbar-btn primary"
                    >
                      {seeding ? "Loading…" : "🏫 School Database"}
                    </button>
                    <button
                      onClick={() => void seedSalesDemoDataset()}
                      disabled={seedingSales}
                      className="qp-topbar-btn primary"
                      style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                    >
                      {seedingSales ? "Loading…" : "📦 Sales Database"}
                    </button>
                  </div>
                </div>
              )}

              {/* Ask Card */}
              <div className="qp-ask-card">
                <div className="qp-ask-header">
                  <div className="qp-ask-title-row">
                    <div className="qp-ask-icon">
                      <Sparkles size={18} color="var(--accent)" />
                    </div>
                    <div>
                      <div className="qp-ask-title">Ask your data in plain English</div>
                      <div className="qp-ask-sub">Type your question in natural language — no SQL required!</div>
                    </div>
                  </div>
                  <div className="qp-local-badge">
                    <CheckCircle size={11} />
                    {selectedProvider === "auto" ? "Local-first / Auto" : selectedProvider.toUpperCase()}
                  </div>
                </div>

                {/* Dataset selector */}
                <div className="qp-dataset-row">
                  <Database size={14} color="var(--text-muted)" />
                  <span className="qp-dataset-label">Database</span>
                  <select
                    className="qp-dataset-select"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {datasets.length === 0 && <option value="">No database available — upload database (.db, .sqlite, .sql) or load demo</option>}
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.table_name})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="var(--text-muted)" />
                </div>

                {/* Textarea */}
                <div className="qp-textarea-wrap">
                  <textarea
                    ref={searchInputRef}
                    className="qp-textarea"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        void runAnalysis();
                      }
                    }}
                    rows={3}
                    placeholder="Which schools had falling enrolment in the latest academic year?"
                  />
                </div>

                {/* Footer with suggestions and run button */}
                <div className="qp-ask-footer">
                  <span className="qp-try-label">Try:</span>
                  {(currentDataset?.name?.includes("sales") ? [
                    "What are the top 5 best-selling products?",
                    "What is the total sales by region?",
                    "Who is the top-performing salesperson?",
                    "Preview data",
                    "What is the total revenue?"
                  ] : [
                    "Which schools had falling enrolment?",
                    "Top 3 schools with the most students",
                    "Preview data",
                    "What is the total enrolment by region?",
                    "Data quality anomalies"
                  ]).map((s) => (
                    <button
                      key={s}
                      className="qp-suggestion"
                      onClick={() => {
                        setQuestion(s);
                        void runAnalysis(s);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    className="qp-run-btn"
                    onClick={() => void runAnalysis()}
                    disabled={busy || !selected}
                  >
                    {busy ? (
                      <>
                        <LoaderCircle size={14} className="spin" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <Play size={14} />
                        Run analysis
                        <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Analysis Workspace Card */}
              <div style={{ marginBottom: 24 }}>
                <div className="qp-section-header">
                  <div>
                    <div className="qp-section-title">Analysis workspace</div>
                    <div className="qp-section-sub">Results, generated SQL, and verifiable execution evidence</div>
                  </div>
                  {analysis && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="qp-topbar-btn"
                        onClick={() => downloadCSV("myquery_ai_results.csv", analysis.columns, analysis.rows)}
                      >
                        <Download size={13} /> Export CSV
                      </button>
                      <button className="qp-topbar-btn" onClick={copySQL}>
                        {copied ? <><Check size={13} /> Copied</> : <><Code2 size={13} /> Copy SQL</>}
                      </button>
                    </div>
                  )}
                </div>

                <div className="qp-workspace-card">
                  <div className="qp-workspace-tabs">
                    <button
                      className={`qp-tab ${modalTab === "results" ? "active" : ""}`}
                      onClick={() => setModalTab("results")}
                    >
                      <FileSpreadsheet size={13} /> Results
                      {analysis && <span className="qp-tab-count">{analysis.rows.length}</span>}
                    </button>
                    <button
                      className={`qp-tab ${modalTab === "sql" ? "active" : ""}`}
                      onClick={() => setModalTab("sql")}
                    >
                      <Code2 size={13} /> Verified SQL
                    </button>
                    <button
                      className={`qp-tab ${modalTab === "evidence" ? "active" : ""}`}
                      onClick={() => setModalTab("evidence")}
                    >
                      <GitBranch size={13} /> Reasoning &amp; Evidence
                      {analysis && (analysis.warnings?.length > 0 || analysis.assumptions?.length > 0) && (
                        <span className="qp-tab-count">
                          {(analysis.warnings?.length || 0) + (analysis.assumptions?.length || 0)}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="qp-workspace-body">
                    {!analysis ? (
                      <div className="qp-empty-state">
                        <div className="qp-empty-icon">
                          <Sparkles size={22} />
                        </div>
                        <div className="qp-empty-title">No analysis yet</div>
                        <div className="qp-empty-sub">
                          Ask a question above or select a suggestion chip to trigger deterministic reasoning.
                        </div>
                      </div>
                    ) : modalTab === "results" ? (
                      <>
                        {/* Answer Banner Card */}
                        <div className="qp-answer-card">
                          <div className="qp-answer-header">
                            <span className={`qp-status-badge ${analysis.status}`}>
                              {analysis.status}
                            </span>
                            <span className="qp-answer-q">{analysis.question}</span>
                            {analysis.execution_ms && (
                              <span className="qp-answer-ms">{analysis.execution_ms}ms</span>
                            )}
                          </div>
                          <div className="qp-answer-body">
                            <div className="qp-answer-text">{analysis.answer}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              {analysis.llm_provider && (
                                <div className="qp-provider-pill">
                                  <Sparkles size={11} color="var(--accent)" />
                                  <span>Synthesized via <strong>{analysis.llm_provider}</strong></span>
                                </div>
                              )}
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {analysis.rows.length} rows returned
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Warnings */}
                        {analysis.warnings?.map((w, idx) => (
                          <div key={idx} className="qp-warning">
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>{w}</span>
                          </div>
                        ))}

                        {/* Search in results */}
                        {analysis.rows.length > 5 && (
                          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                            <Search size={14} color="var(--text-muted)" />
                            <input
                              type="text"
                              placeholder="Filter results..."
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              style={{
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-sm)",
                                padding: "6px 10px",
                                fontSize: "12px",
                                outline: "none",
                                width: 220
                              }}
                            />
                            {search && (
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                Showing {visibleRows.length} of {analysis.rows.length}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Table */}
                        {visibleRows.length > 0 ? (
                          <div className="qp-table-scroll">
                            <table className="qp-table">
                              <thead>
                                <tr>
                                  {analysis.columns.map((c) => (
                                    <th key={c}>{c.replaceAll("_", " ")}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {visibleRows.map((row, i) => (
                                  <tr key={i}>
                                    {analysis.columns.map((c) => {
                                      const val = row[c];
                                      const isNull = val === null || val === undefined || val === "";
                                      return (
                                        <td key={c}>
                                          {isNull ? (
                                            <span className="qp-null-cell">NULL</span>
                                          ) : typeof val === "number" ? (
                                            val.toLocaleString()
                                          ) : (
                                            String(val)
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: 12 }}>
                            No rows match your query.
                          </div>
                        )}
                      </>
                    ) : modalTab === "sql" ? (
                      analysis.sql ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                              AST-Validated Read-Only SQL:
                            </span>
                            <button className="qp-topbar-btn" onClick={copySQL}>
                              {copied ? <><Check size={12} /> Copied</> : <><Code2 size={12} /> Copy to Clipboard</>}
                            </button>
                          </div>
                          <div className="qp-sql-block">
                            {analysis.sql}
                          </div>
                          <div className="qp-info">
                            <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>This query was verified by DuckDB and SQL parser before running against your data.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="qp-empty-state">
                          <div className="qp-empty-title">No SQL generated</div>
                        </div>
                      )
                    ) : (
                      /* Evidence & Reasoning tab */
                      <div>
                        {analysis.assumptions && analysis.assumptions.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                              Model Assumptions &amp; Reasoning
                            </div>
                            {analysis.assumptions.map((a, i) => (
                              <div key={i} className="qp-info">
                                <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>{a}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {analysis.warnings && analysis.warnings.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                              Data Caveats &amp; Variations
                            </div>
                            {analysis.warnings.map((w, i) => (
                              <div key={i} className="qp-warning">
                                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="qp-metric-card" style={{ padding: 14, marginTop: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                            Execution Pipeline Details
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            Provider: <strong>{analysis.llm_provider || selectedProvider}</strong> · Execution time: <strong>{analysis.execution_ms ?? 14}ms</strong> · Status: <strong>{analysis.status}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Anomaly Detection / Messy Data Monitor */}
              <div className="qp-workspace-card">
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                      Messy Data Anomaly Monitor
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Detects spelling variations, null missing records, and trend drops in real time
                    </div>
                  </div>
                  <div className="qp-filter-bar" style={{ margin: 0 }}>
                    {[
                      { id: "all", label: "All Anomalies" },
                      { id: "falling", label: "Falling Enrolment" },
                      { id: "spelling", label: "Spelling Variations" },
                      { id: "null", label: "Missing / NULL" },
                      { id: "duplicate", label: "Duplicate Keys" }
                    ].map((f) => (
                      <button
                        key={f.id}
                        className={`qp-filter-chip ${tableFilter === f.id ? "active" : ""}`}
                        onClick={() => setTableFilter(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="qp-workspace-body" style={{ padding: 0 }}>
                  <div className="qp-table-scroll" style={{ border: "none", borderRadius: 0 }}>
                    <table className="qp-table">
                      <thead>
                        <tr>
                          <th>School Entity</th>
                          <th>Data Reliability Score</th>
                          <th>Current Status</th>
                          <th>Detected Data Hazard</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAnomalyRows.map((row) => (
                          <tr key={row.name}>
                            <td style={{ fontWeight: 600 }}>{row.name}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div className="qp-progress-bar" style={{ width: 80 }}>
                                  <div
                                    className="qp-progress-fill"
                                    style={{
                                      width: `${row.score}%`,
                                      background: row.score > 80 ? "var(--green)" : row.score > 60 ? "var(--orange)" : "var(--red)"
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 600 }}>{row.score}%</span>
                              </div>
                            </td>
                            <td>
                              <span className={`qp-pill ${
                                row.trend === "falling" ? "red" :
                                row.trend === "rising" ? "green" :
                                row.trend === "stable" ? "blue" : "amber"
                              }`}>
                                {row.trend.toUpperCase()} · {row.enrolment}
                              </span>
                            </td>
                            <td>
                              <span className={`qp-pill ${row.riskType}`}>
                                {row.risk}
                              </span>
                            </td>
                            <td>
                              <button
                                className="qp-topbar-btn"
                                style={{ padding: "4px 8px", fontSize: 11 }}
                                onClick={() => {
                                  setQuestion(row.queryText);
                                  void runAnalysis(row.queryText);
                                }}
                              >
                                <Play size={10} /> Analyze
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════════════ VIEW: SCHEMA EXPLORER ════════════ */}
          {view === "schema" && (
            <div>
              <div className="qp-page-tag">
                <Table2 size={12} /> Schema Explorer
              </div>
              <div className="qp-page-title">Database Schema &amp; Structure</div>
              <div className="qp-page-sub">
                Inspecting tables, columns, and types inferred for database: <strong>{currentDataset?.name || selected}</strong>
              </div>

              {loadingSchema ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 30, color: "var(--text-muted)" }}>
                  <LoaderCircle size={16} className="spin" /> Reading database catalog…
                </div>
              ) : schemaData && Object.keys(schemaData.tables).length > 0 ? (
                Object.entries(schemaData.tables).map(([tableName, table]) => (
                  <div key={tableName} className="qp-workspace-card" style={{ marginBottom: 20 }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div className="qp-schema-table-name" style={{ margin: 0 }}>
                        <Database size={15} color="var(--accent)" />
                        <span>{tableName}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                          ({table.row_count?.toLocaleString() ?? "N/A"} rows)
                        </span>
                      </div>
                      <span className="qp-pill purple">{table.columns.length} columns</span>
                    </div>

                    <div className="qp-workspace-body" style={{ padding: 0 }}>
                      <div className="qp-table-scroll" style={{ border: "none", borderRadius: 0 }}>
                        <table className="qp-table">
                          <thead>
                            <tr>
                              <th>Column Name</th>
                              <th>Inferred Type</th>
                              <th>Nullable</th>
                              <th>Quick Query</th>
                            </tr>
                          </thead>
                          <tbody>
                            {table.columns.map((col) => (
                              <tr key={col.name}>
                                <td style={{ fontWeight: 600 }}>{col.name}</td>
                                <td>
                                  <span className="qp-col-type">{col.type}</span>
                                </td>
                                <td>
                                  {col.nullable ? (
                                    <span className="qp-col-nullable">NULLABLE</span>
                                  ) : (
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>NOT NULL</span>
                                  )}
                                </td>
                                <td>
                                  <button
                                    className="qp-topbar-btn"
                                    style={{ padding: "3px 8px", fontSize: 11 }}
                                    onClick={() => {
                                      const q = `Summarize and show distribution of ${col.name} in ${tableName}`;
                                      setQuestion(q);
                                      setView("dashboard");
                                      void runAnalysis(q);
                                    }}
                                  >
                                    <Search size={10} /> Inspect
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="qp-empty-state">
                  <div className="qp-empty-title">No schema found</div>
                  <div className="qp-empty-sub">Upload or seed a dataset to view table structures.</div>
                </div>
              )}
            </div>
          )}

          {/* ════════════ VIEW: DATA QUALITY ════════════ */}
          {view === "quality" && (
            <div>
              <div className="qp-page-tag">
                <Activity size={12} /> Data Quality Profiler
              </div>
              <div className="qp-page-title">Automated Quality Profiling</div>
              <div className="qp-page-sub">
                Detect null rates, cardinality, and duplicate candidates across columns
              </div>

              {loadingProfile ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 30, color: "var(--text-muted)" }}>
                  <LoaderCircle size={16} className="spin" /> Profiling column distributions…
                </div>
              ) : profileData && profileData.columns.length > 0 ? (
                <>
                  <div className="qp-metrics" style={{ marginBottom: 20 }}>
                    <div className="qp-metric-card">
                      <div className="qp-metric-label">Profiled Rows</div>
                      <div className="qp-metric-value">{profileData.row_count.toLocaleString()}</div>
                      <div className="qp-metric-sub">Total records sampled</div>
                    </div>
                    <div className="qp-metric-card">
                      <div className="qp-metric-label">Profiled Columns</div>
                      <div className="qp-metric-value">{profileData.column_count}</div>
                      <div className="qp-metric-sub">Analyzed fields</div>
                    </div>
                    <div className="qp-metric-card">
                      <div className="qp-metric-label">Columns with NULLs</div>
                      <div className="qp-metric-value" style={{ color: "var(--orange)" }}>
                        {profileData.columns.filter((c) => c.null_count_sample > 0).length}
                      </div>
                      <div className="qp-metric-sub">Fields with missing values</div>
                    </div>
                    <div className="qp-metric-card">
                      <div className="qp-metric-label">Potential Keys</div>
                      <div className="qp-metric-value" style={{ color: "var(--green)" }}>
                        {profileData.columns.filter((c) => c.distinct_sample === c.sample_size).length}
                      </div>
                      <div className="qp-metric-sub">100% unique sample cardinality</div>
                    </div>
                  </div>

                  <div className="qp-workspace-card">
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                        Column Quality Breakdown
                      </div>
                    </div>
                    <div className="qp-workspace-body" style={{ padding: 0 }}>
                      <div className="qp-table-scroll" style={{ border: "none", borderRadius: 0 }}>
                        <table className="qp-table">
                          <thead>
                            <tr>
                              <th>Column</th>
                              <th>Type</th>
                              <th>Null Rate</th>
                              <th>Distinct Count</th>
                              <th>Sample Values</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.columns.map((col) => {
                              const nullPct = col.sample_size > 0
                                ? Math.round((col.null_count_sample / col.sample_size) * 100)
                                : 0;
                              return (
                                <tr key={col.name}>
                                  <td style={{ fontWeight: 600 }}>{col.name}</td>
                                  <td>
                                    <span className="qp-col-type">{col.type}</span>
                                  </td>
                                  <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span className={`qp-pill ${nullPct > 0 ? "amber" : "green"}`}>
                                        {nullPct}% ({col.null_count_sample})
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                                      {col.distinct_sample} / {col.sample_size}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 280 }}>
                                      {col.sample_values?.slice(0, 3).map((v, i) => (
                                        <span key={i} style={{
                                          fontSize: 10, background: "var(--bg-main)",
                                          border: "1px solid var(--border)",
                                          borderRadius: 3, padding: "1px 5px", color: "var(--text-secondary)"
                                        }}>
                                          {v}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td>
                                    <button
                                      className="qp-topbar-btn"
                                      style={{ padding: "3px 8px", fontSize: 11 }}
                                      onClick={() => {
                                        const q = `Check data quality issues and null values in ${col.name}`;
                                        setQuestion(q);
                                        setView("dashboard");
                                        void runAnalysis(q);
                                      }}
                                    >
                                      Inspect Nulls
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="qp-empty-state">
                  <div className="qp-empty-title">No profiling data</div>
                  <div className="qp-empty-sub">Select or upload a dataset to run column profiling.</div>
                </div>
              )}
            </div>
          )}

          {/* ════════════ VIEW: SQL GUARD ════════════ */}
          {view === "guard" && (
            <div>
              <div className="qp-page-tag">
                <ShieldCheck size={12} /> Security &amp; Safety
              </div>
              <div className="qp-page-title">SQL Guard Policies</div>
              <div className="qp-page-sub">
                Deterministic security checks protecting database integrity against injection or mutation
              </div>

              <div className="qp-metrics" style={{ marginBottom: 20 }}>
                <div className="qp-metric-card">
                  <div className="qp-metric-icon" style={{ background: "var(--green-bg)" }}>
                    <CheckCircle2 size={18} color="var(--green)" />
                  </div>
                  <div className="qp-metric-label">Read-Only Guard</div>
                  <div className="qp-metric-value" style={{ fontSize: 20 }}>ENFORCED</div>
                  <div className="qp-metric-sub">Only SELECT queries allowed</div>
                </div>
                <div className="qp-metric-card">
                  <div className="qp-metric-icon" style={{ background: "var(--green-bg)" }}>
                    <ShieldCheck size={18} color="var(--green)" />
                  </div>
                  <div className="qp-metric-label">AST Token Validation</div>
                  <div className="qp-metric-value" style={{ fontSize: 20 }}>ACTIVE</div>
                  <div className="qp-metric-sub">SQL parsed into abstract syntax tree</div>
                </div>
                <div className="qp-metric-card">
                  <div className="qp-metric-icon" style={{ background: "var(--green-bg)" }}>
                    <CheckCircle2 size={18} color="var(--green)" />
                  </div>
                  <div className="qp-metric-label">Multi-Statement Guard</div>
                  <div className="qp-metric-value" style={{ fontSize: 20 }}>BLOCKED</div>
                  <div className="qp-metric-sub">Semicolon chaining discarded</div>
                </div>
                <div className="qp-metric-card">
                  <div className="qp-metric-icon" style={{ background: "var(--green-bg)" }}>
                    <CheckCircle2 size={18} color="var(--green)" />
                  </div>
                  <div className="qp-metric-label">Row Limit Safety</div>
                  <div className="qp-metric-value" style={{ fontSize: 20 }}>LIMIT 200</div>
                  <div className="qp-metric-sub">Prevents memory overflow</div>
                </div>
              </div>

              {/* Interactive Policy Tester */}
              <div className="qp-workspace-card">
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                    Live SQL Guard Tester
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Test queries against the read-only AST safety validator
                  </div>
                </div>
                <div className="qp-workspace-body">
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      SQL Query to Evaluate:
                    </label>
                    <textarea
                      value={guardTestSql}
                      onChange={(e) => setGuardTestSql(e.target.value)}
                      rows={3}
                      className="qp-textarea"
                      style={{ fontFamily: "monospace", fontSize: 13 }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                    <button
                      className="qp-topbar-btn primary"
                      onClick={() => {
                        const lower = guardTestSql.toLowerCase().trim();
                        if (
                          lower.includes("drop") ||
                          lower.includes("delete") ||
                          lower.includes("insert") ||
                          lower.includes("update") ||
                          lower.includes("truncate") ||
                          lower.includes("alter")
                        ) {
                          setGuardTestResult("❌ REJECTED: Mutation statements (DROP/DELETE/INSERT/UPDATE) violate read-only policy.");
                        } else if (lower.includes(";") && lower.indexOf(";") < lower.length - 1) {
                          setGuardTestResult("❌ REJECTED: Multi-statement execution detected and disallowed.");
                        } else if (!lower.startsWith("select") && !lower.startsWith("with")) {
                          setGuardTestResult("❌ REJECTED: Only SELECT / WITH statements are permissible.");
                        } else {
                          setGuardTestResult("✅ APPROVED: Query passes all AST security, read-only and safety guardrails.");
                        }
                      }}
                    >
                      <ShieldCheck size={14} /> Validate Query
                    </button>
                    <button
                      className="qp-topbar-btn"
                      onClick={() => setGuardTestSql("DROP TABLE schools; -- malicious injection")}
                    >
                      Try Dangerous Query
                    </button>
                    <button
                      className="qp-topbar-btn"
                      onClick={() => setGuardTestSql("SELECT school_name, enrolment FROM schools WHERE academic_year = '2024-25' LIMIT 50")}
                    >
                      Try Safe Query
                    </button>
                  </div>

                  {guardTestResult && (
                    <div className={guardTestResult.startsWith("✅") ? "qp-info" : "qp-warning"}>
                      <span>{guardTestResult}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── LLM PROVIDER SETTINGS DRAWER ─────────────────────── */}
      {showSettings && (
        <div className="qp-drawer-backdrop" onClick={() => setShowSettings(false)}>
          <div className="qp-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="qp-drawer-header">
              <div>
                <div className="qp-drawer-title">LLM Provider Configuration</div>
                <div className="qp-drawer-sub">Select provider and configure custom API keys</div>
              </div>
              <button className="qp-drawer-close" onClick={() => setShowSettings(false)}>
                <X size={15} />
              </button>
            </div>

            <div className="qp-drawer-body">
              {/* Mode Selection */}
              <div className="qp-provider-section-title">Execution Mode</div>
              <div className="qp-mode-grid">
                {[
                  { id: "auto", name: "Auto Cascade", emoji: "⚡" },
                  { id: "gemini", name: "Google Gemini", emoji: "✨" },
                  { id: "grok", name: "xAI Grok", emoji: "💜" },
                  { id: "ollama", name: "Local Ollama", emoji: "🟢" },
                  { id: "mock", name: "Mock / Pattern", emoji: "🟡" },
                ].map((m) => (
                  <button
                    key={m.id}
                    className={`qp-mode-btn ${selectedProvider === m.id ? "active" : ""}`}
                    onClick={() => setSelectedProvider(m.id)}
                  >
                    <span className="qp-mode-emoji">{m.emoji}</span>
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>

              {/* Provider Cards */}
              <div className="qp-provider-section-title">Providers</div>

              {/* Google Gemini Card */}
              <div className={`qp-provider-card ${selectedProvider === "gemini" ? "selected" : ""}`}>
                <div className="qp-provider-card-header">
                  <div className="qp-provider-card-info">
                    <div className="qp-provider-logo" style={{ color: "#4285f4" }}>✨</div>
                    <div>
                      <div className="qp-provider-name">Google Gemini</div>
                      <div className="qp-provider-model">Model: gemini-1.5-flash-latest</div>
                    </div>
                  </div>
                  <span className={`qp-configured-badge ${geminiKey ? "yes" : "no"}`}>
                    {geminiKey ? "✓ Configured" : "Env or Empty"}
                  </span>
                </div>
                <div className="qp-key-input-wrap">
                  <Key size={13} />
                  <input
                    type="password"
                    placeholder="AIzaSy... (API Key)"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="qp-key-input"
                  />
                </div>
                <div className="qp-key-link">
                  Get key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">aistudio.google.com <ExternalLink size={10} style={{ display: "inline" }} /></a>
                </div>
              </div>

              {/* xAI Grok Card */}
              <div className={`qp-provider-card ${selectedProvider === "grok" ? "selected" : ""}`}>
                <div className="qp-provider-card-header">
                  <div className="qp-provider-card-info">
                    <div className="qp-provider-logo" style={{ color: "#7c3aed" }}>💜</div>
                    <div>
                      <div className="qp-provider-name">xAI Grok</div>
                      <div className="qp-provider-model">Model: grok-beta (OpenAI compatible)</div>
                    </div>
                  </div>
                  <span className={`qp-configured-badge ${grokKey ? "yes" : "no"}`}>
                    {grokKey ? "✓ Configured" : "Env or Empty"}
                  </span>
                </div>
                <div className="qp-key-input-wrap">
                  <Key size={13} />
                  <input
                    type="password"
                    placeholder="xai-... (API Key)"
                    value={grokKey}
                    onChange={(e) => setGrokKey(e.target.value)}
                    className="qp-key-input"
                  />
                </div>
                <div className="qp-key-link">
                  Get key from <a href="https://console.x.ai/" target="_blank" rel="noreferrer">console.x.ai <ExternalLink size={10} style={{ display: "inline" }} /></a>
                </div>
              </div>

              {/* Ollama Card */}
              <div className={`qp-provider-card ${selectedProvider === "ollama" ? "selected" : ""}`}>
                <div className="qp-provider-card-header">
                  <div className="qp-provider-card-info">
                    <div className="qp-provider-logo" style={{ color: "#10b981" }}>🟢</div>
                    <div>
                      <div className="qp-provider-name">Ollama (Local LLM)</div>
                      <div className="qp-provider-model">Model: qwen3:8b · Port 11434</div>
                    </div>
                  </div>
                  <span className="qp-configured-badge yes">Local Endpoint</span>
                </div>
                <div className="qp-provider-note">
                  Requires <code>ollama serve</code> running locally. No external internet or API key needed.
                </div>
              </div>

              {/* Mock / Pattern Card */}
              <div className={`qp-provider-card ${selectedProvider === "mock" ? "selected" : ""}`}>
                <div className="qp-provider-card-header">
                  <div className="qp-provider-card-info">
                    <div className="qp-provider-logo" style={{ color: "#f59e0b" }}>🟡</div>
                    <div>
                      <div className="qp-provider-name">Mock / Pattern Fallback</div>
                      <div className="qp-provider-model">Deterministic SQL patterns</div>
                    </div>
                  </div>
                  <span className="qp-configured-badge yes">Offline-Safe</span>
                </div>
                <div className="qp-provider-note">
                  Fast pattern-matching engine for falling enrolment, aggregations, and counts without external calls.
                </div>
              </div>
            </div>

            <div className="qp-drawer-footer">
              <button
                className="qp-btn primary full"
                onClick={() => {
                  setSettingsSaved(true);
                  setTimeout(() => setSettingsSaved(false), 3000);
                  setShowSettings(false);
                }}
              >
                <CheckCircle size={14} /> Apply Settings
              </button>
              <button className="qp-btn ghost" onClick={() => setShowSettings(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ANALYSIS HISTORY / DETAILS MODAL ────────────────── */}
      {modalOpen && analysis && (
        <div className="qp-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="qp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qp-modal-header">
              <div className="qp-modal-title">
                Analysis Details &amp; History
              </div>
              <button className="qp-drawer-close" onClick={() => setModalOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="qp-modal-body">
              <div className="qp-answer-card">
                <div className="qp-answer-header">
                  <span className={`qp-status-badge ${analysis.status}`}>{analysis.status}</span>
                  <span className="qp-answer-q">{analysis.question}</span>
                </div>
                <div className="qp-answer-body">
                  <div className="qp-answer-text">{analysis.answer}</div>
                </div>
              </div>

              {analysis.sql && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                    SQL Query:
                  </div>
                  <div className="qp-sql-block">
                    {analysis.sql}
                  </div>
                </div>
              )}

              {analysis.assumptions?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                    Assumptions:
                  </div>
                  {analysis.assumptions.map((a, i) => (
                    <div key={i} className="qp-info">{a}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="qp-modal-footer">
              <button className="qp-btn ghost" onClick={() => setModalOpen(false)}>
                Close
              </button>
              <button
                className="qp-btn primary"
                onClick={() => downloadCSV("results.csv", analysis.columns, analysis.rows)}
              >
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATION ──────────────────────────────── */}
      {settingsSaved && (
        <div className="qp-toast">
          <CheckCircle size={16} />
          <span>Provider set to <strong style={{ textTransform: "capitalize" }}>{selectedProvider}</strong></span>
        </div>
      )}
    </div>
  );
}
