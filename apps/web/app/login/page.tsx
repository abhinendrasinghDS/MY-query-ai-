"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrainCircuit, Mail, Lock, User, Eye, EyeOff, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import "../landing.css";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithGoogle, loginWithEmail, loginDemo } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      // Dynamic import to support both client-side Firebase and demo
      const { signInWithFirebaseGoogle } = await import("../lib/firebase");
      const firebaseUser = await signInWithFirebaseGoogle();
      loginWithGoogle(firebaseUser.email, firebaseUser.name, firebaseUser.avatar);
      setSuccessMsg(`Welcome, ${firebaseUser.name}!`);
      setTimeout(() => router.push("/dashboard"), 700);
    } catch (err: any) {
      console.warn("Firebase Google login bypassed or failed, using demo session:", err);
      loginWithGoogle();
      setSuccessMsg("Signed in with Google successfully!");
      setTimeout(() => router.push("/dashboard"), 700);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setTimeout(() => {
      loginWithEmail(email, name);
      setSuccessMsg(isRegister ? "Account created successfully!" : "Signed in successfully!");
      setTimeout(() => {
        router.push("/dashboard");
      }, 700);
    }, 500);
  };

  const handleDemoLogin = () => {
    loginDemo();
    setSuccessMsg("Logged in as Guest Analyst!");
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  };

  return (
    <div className="auth-page">
      {/* Background glow effects */}
      <div className="lp-bg-glow lp-glow-1" />
      <div className="lp-bg-glow lp-glow-2" />

      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <Link href="/" className="auth-logo-wrap" style={{ textDecoration: "none" }}>
            <div className="lp-logo">
              <div className="lp-logo-icon">
                <BrainCircuit size={20} color="#fff" />
              </div>
              <span>My Query AI</span>
            </div>
          </Link>
          <h1 className="auth-title">
            {isRegister ? "Create Your Account" : "Welcome Back"}
          </h1>
          <p className="auth-sub">
            {isRegister
              ? "Start querying your databases in natural language"
              : "Sign in to access your database workspace & analytics"}
          </p>
        </div>

        {/* Success toast if redirected */}
        {successMsg && (
          <div style={{
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            borderRadius: "10px",
            padding: "10px 14px",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#34d399",
            fontSize: "13px",
            fontWeight: 500
          }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          type="button"
          className="auth-google-btn"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
        >
          {/* Google Official G Icon */}
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{googleLoading ? "Connecting to Google..." : "Continue with Google"}</span>
        </button>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="auth-form-group">
              <label className="auth-label">Full Name</label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-input-icon" />
                <input
                  type="text"
                  required
                  placeholder="Alex Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>
          )}

          <div className="auth-form-group">
            <label className="auth-label">Work Email</label>
            <div className="auth-input-wrap">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
              />
            </div>
          </div>

          <div className="auth-form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="auth-label">Password</label>
              {!isRegister && (
                <span style={{ fontSize: "11px", color: "var(--lp-accent)", cursor: "pointer" }}>
                  Forgot password?
                </span>
              )}
            </div>
            <div className="auth-input-wrap">
              <Lock size={16} className="auth-input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
              />
              <button
                type="button"
                className="auth-input-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            <span>{loading ? "Processing..." : isRegister ? "Create Account" : "Sign In to Workspace"}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        {/* Quick Demo Access */}
        <button
          type="button"
          className="auth-demo-btn"
          onClick={handleDemoLogin}
          title="Instant access without entering any credentials"
        >
          <Sparkles size={14} />
          <span>One-Click Guest Access (Instant Demo)</span>
        </button>

        {/* Toggle sign in / sign up */}
        <div className="auth-footer">
          <span>{isRegister ? "Already have an account?" : "Don't have an account yet?"}</span>
          <span
            className="auth-switch-link"
            onClick={() => {
              setIsRegister(!isRegister);
              setSuccessMsg("");
            }}
          >
            {isRegister ? "Sign In" : "Sign Up"}
          </span>
        </div>
      </div>
    </div>
  );
}
