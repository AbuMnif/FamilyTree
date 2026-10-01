"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./page.css";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!username.trim()) {
      setError("أدخل اسم المستخدم.");
      return;
    }

    if (!password) {
      setError("أدخل كلمة المرور.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message || "اسم المستخدم أو كلمة المرور غير صحيحة."
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Login error:", error);

      setError(
        "تعذر الاتصال بالخادم. حاول مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-background">
        <div className="login-orb login-orb-one" />
        <div className="login-orb login-orb-two" />
      </div>

      <section className="login-card">
        <div className="login-logo">
          ش
        </div>

        <div className="login-header">
          <span>شجرة العائلة</span>

          <h1>تسجيل الدخول</h1>

          <p>
            أدخل بيانات حسابك للوصول إلى النظام.
          </p>
        </div>

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          <label>
            <span>اسم المستخدم</span>

            <input
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              placeholder="اسم المستخدم"
              autoComplete="username"
              autoFocus
              dir="ltr"
            />
          </label>

          <label>
            <span>كلمة المرور</span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="كلمة المرور"
              autoComplete="current-password"
              dir="ltr"
            />
          </label>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "جاري تسجيل الدخول..."
              : "تسجيل الدخول"}
          </button>
        </form>
      </section>
    </main>
  );
}
