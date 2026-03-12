"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import WIcon from "@/components/ui/WIcon";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setEmailSent(true);
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
            Create your account.
          </div>
          <div style={{ fontSize: 15, color: "#8e8e93" }}>Your Wingman is waiting.</div>
        </div>

        {emailSent ? (
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
              We sent a confirmation link to <strong style={{ color: "#1c1c1e" }}>{email}</strong>. Click it to activate your account and start onboarding.
            </div>
          </div>
        ) : (
          <div style={{
            background: "#fff",
            borderRadius: 18,
            padding: "28px 24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <form onSubmit={handleSignup}>
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

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#8e8e93", fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Min. 8 characters"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#8e8e93", fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Confirm password</div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  placeholder="Repeat your password"
                  required
                  style={inputStyle}
                />
              </div>

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
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#aeaeb2", lineHeight: 1.5 }}>
              By signing up you agree to our{" "}
              <Link href="/terms" style={{ color: "#8e8e93", textDecoration: "underline" }}>Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy" style={{ color: "#8e8e93", textDecoration: "underline" }}>Privacy Policy</Link>.
              {" "}You also consent to receive a one-time SMS verification code. Msg & data rates may apply.
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#8e8e93" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#000", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
