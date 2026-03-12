"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import WIcon from "@/components/ui/WIcon";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"password" | "magic" | "forgot">("password");
  const [magicSent, setMagicSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const supabase = createClient();

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#f2f2f7",
    border: "2px solid transparent",
    borderRadius: 12,
    padding: "14px 16px",
    color: "#1c1c1e",
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      window.location.href = "/dashboard";
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
    } else {
      setMagicSent(true);
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f2f2f7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
          <WIcon size={64} />
        </div>

        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 8 }}>
            Welcome back.
          </div>
          <div style={{ fontSize: 15, color: "#8e8e93" }}>Sign in to your Wingman account.</div>
        </div>

        {resetSent ? (
          <div style={{ background: "#fff", borderRadius: 18, padding: "32px 24px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1c1c1e", marginBottom: 8 }}>Check your inbox.</div>
            <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6 }}>
              We sent a password reset link to <strong style={{ color: "#1c1c1e" }}>{email}</strong>. Click it to set a new password.
            </div>
            <button
              onClick={() => { setResetSent(false); setMode("password"); setEmail(""); }}
              style={{ marginTop: 24, background: "none", border: "none", color: "#8e8e93", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Back to sign in
            </button>
          </div>
        ) : magicSent ? (
          <div style={{
            background: "#fff",
            borderRadius: 18,
            padding: "32px 24px",
            textAlign: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1c1c1e", marginBottom: 8 }}>Check your inbox.</div>
            <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6 }}>
              We sent a magic link to <strong style={{ color: "#1c1c1e" }}>{email}</strong>. Click it to sign in.
            </div>
            <button
              onClick={() => { setMagicSent(false); setEmail(""); }}
              style={{ marginTop: 24, background: "none", border: "none", color: "#8e8e93", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div style={{
            background: "#fff",
            borderRadius: 18,
            padding: "28px 24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            {/* Mode tabs */}
            <div style={{ display: "flex", gap: 4, background: "#f2f2f7", borderRadius: 10, padding: 4, marginBottom: 24 }}>
              {[{ id: "password", label: "Password" }, { id: "magic", label: "Magic Link" }, { id: "forgot", label: "Forgot?" }].map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id as "password" | "magic" | "forgot"); setError(""); }}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 7, border: "none",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    background: mode === m.id ? "#fff" : "transparent",
                    color: mode === m.id ? "#1c1c1e" : "#8e8e93",
                    boxShadow: mode === m.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.18s",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <form onSubmit={mode === "password" ? handleLogin : mode === "magic" ? handleMagicLink : handleForgotPassword}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#8e8e93", fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@example.com"
                  required
                  style={inputStyle}
                />
              </div>

              {mode === "password" && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "#8e8e93", fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••"
                    required
                    style={inputStyle}
                  />
                </div>
              )}

              {mode === "magic" && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "#8e8e93", lineHeight: 1.6 }}>
                    We'll send a magic link to your email. Click it to sign in instantly — no password needed.
                  </div>
                </div>
              )}

              {mode === "forgot" && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "#8e8e93", lineHeight: 1.6 }}>
                    Enter your email and we'll send you a link to reset your password.
                  </div>
                </div>
              )}

              {error && (
                <div style={{ fontSize: 13, color: "#ff3b30", marginBottom: 14, padding: "10px 12px", background: "#fff0f0", borderRadius: 8 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "14px",
                  background: "#000", color: "#fff",
                  border: "none", borderRadius: 12,
                  fontSize: 15, fontWeight: 600,
                  fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {loading ? "Sending…" : mode === "magic" ? "Send magic link" : mode === "forgot" ? "Send reset link" : "Sign in"}
              </button>
            </form>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#8e8e93" }}>
          New to Wingman?{" "}
          <Link href="/signup" style={{ color: "#000", fontWeight: 600, textDecoration: "none" }}>
            Get started
          </Link>
        </div>
      </div>
    </div>
  );
}
