
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">(
    "error"
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (mode === "signup" && !name.trim()) {
      setMessage("Please enter your full name.");
      setMessageType("error");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must contain at least 6 characters.");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setMessage(
            "Account created! Check your email to confirm your account before logging in."
          );
          setMessageType("success");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-5 py-10">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl shadow-lg">
              💊
            </div>
            <div className="text-3xl font-bold text-slate-400">+</div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-3xl shadow-lg">
              🧑‍⚕️
            </div>
          </div>

          <h1 className="mt-5 text-3xl font-bold text-slate-900">
            MediCare+
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Smart medicine management
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={`rounded-lg py-3 text-sm font-bold transition-all ${
                mode === "login"
                  ? "bg-white text-blue-600 shadow"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMessage("");
              }}
              className={`rounded-lg py-3 text-sm font-bold transition-all ${
                mode === "signup"
                  ? "bg-white text-blue-600 shadow"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sign Up
            </button>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">
            {mode === "login" ? "Welcome back 👋" : "Create account"}
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            {mode === "login"
              ? "Login to manage your medicines."
              : "Create your MediCare+ account."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={6}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {message && (
              <div
                role="status"
                className={`break-words rounded-xl border px-4 py-3 text-sm ${
                  messageType === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-100 bg-red-50 text-red-600"
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
