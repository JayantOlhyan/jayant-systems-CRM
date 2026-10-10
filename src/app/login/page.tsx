"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Mail, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("jayant@jayant.systems");
  const [password, setPassword] = useState("jayant-crm-2026");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Invalid credentials");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Network error while signing in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F4F5F7] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[#292D38] bg-[#151821] p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[#7958F5] flex items-center justify-center text-white font-bold text-base shadow">
            J
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">JAYANT CRM</h1>
            <p className="text-xs text-[#A0A5B2]">
              Personal Lead Intelligence &amp; Relationship Workspace
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-[#292D38] bg-[#101218] p-3 text-xs text-[#A0A5B2] flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-[#7958F5] shrink-0 mt-0.5" />
          <div>
            <p className="text-[#F4F5F7] font-medium">Private Single-Operator Workspace</p>
            <p className="mt-0.5">
              Default local credentials are pre-filled for immediate agency operation. Configure{" "}
              <code className="font-mono text-[#7958F5]">CRM_ADMIN_EMAIL</code> and{" "}
              <code className="font-mono text-[#7958F5]">CRM_ADMIN_PASSWORD</code> in{" "}
              <code className="font-mono">.env</code> for production deployment.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[#A0A5B2] block mb-1.5">Operator Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#6D7482] absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="crm-input pl-9"
                placeholder="jayant@jayant.systems"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#A0A5B2] block mb-1.5">Workspace Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6D7482] absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="crm-input pl-9"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-[#E56B73]/40 bg-[#E56B73]/10 px-3 py-2 text-xs text-[#E56B73]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="crm-btn crm-btn-primary w-full py-2.5 font-semibold"
          >
            {loading ? "Signing in..." : "Enter Workspace"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
