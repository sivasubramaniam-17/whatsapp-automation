"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/apiClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { companyName, name, email, password };
      const res = await api<{ token: string }>(path, { method: "POST", body });
      setToken(res.token);
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card" style={{ width: 360 }} onSubmit={submit}>
        <div className="brand" style={{ padding: "0 0 8px" }}>
          WhatsApp Automation
        </div>
        <h2>{mode === "login" ? "Sign in" : "Create your company"}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {mode === "login"
            ? "Welcome back."
            : "Start automating your WhatsApp."}
        </p>

        {mode === "register" && (
          <>
            <label>Company name</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </>
        )}
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />

        {error && <div className="error">{error}</div>}

        <button style={{ width: "100%", marginTop: 16 }} disabled={busy}>
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p className="muted" style={{ textAlign: "center", marginBottom: 0 }}>
          {mode === "login" ? "No account?" : "Already have one?"}{" "}
          <a
            style={{ color: "var(--green)", cursor: "pointer" }}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create company" : "Sign in"}
          </a>
        </p>
      </form>
    </div>
  );
}
