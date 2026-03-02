"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-earth-surface p-8 shadow-2xl">
        <h1 className="mb-6 font-display text-2xl uppercase tracking-wide text-parchment">Create Account</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-parchment/60">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="rounded-lg border border-white/10 bg-earth px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 outline-none focus:ring-2 focus:ring-survivor-green/50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-parchment/60">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="rounded-lg border border-white/10 bg-earth px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 outline-none focus:ring-2 focus:ring-survivor-green/50"
            />
          </div>
          {error && <p className="text-sm text-tribal-red">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-full bg-survivor-green py-2 text-sm font-medium text-white hover:bg-survivor-green-dark disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-parchment/40">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-survivor-green hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
