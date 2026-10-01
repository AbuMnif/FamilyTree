"use client";

import { useState } from "react";
import "./page.css";

export default function SetupPage() {
  const [form, setForm] = useState({
    familyName: "",
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "male",
    birthDate: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setSuccess(false);

    if (!form.familyName.trim()) {
      setMessage("اكتب اسم العائلة.");
      return;
    }

    if (!form.firstName.trim()) {
      setMessage("اكتب الاسم الأول.");
      return;
    }

    if (!form.username.trim()) {
      setMessage("اكتب اسم المستخدم.");
      return;
    }

    if (form.username.trim().length < 3) {
      setMessage("اسم المستخدم يجب أن يكون 3 أحرف على الأقل.");
      return;
    }

    if (!form.password) {
      setMessage("اكتب كلمة المرور.");
      return;
    }

    if (form.password.length < 8) {
      setMessage("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          familyName: form.familyName.trim(),
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim(),
          lastName: form.lastName.trim(),
          gender: form.gender,
          birthDate: form.birthDate || null,
          username: form.username.trim(),
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(
          data.message || "حدث خطأ أثناء إنشاء الحساب."
        );
        return;
      }

      setSuccess(true);
      setMessage(
        "تم إنشاء الحساب بنجاح. يمكنك الآن الانتقال إلى صفحة تسجيل الدخول."
      );

      setForm({
        familyName: "",
        firstName: "",
        middleName: "",
        lastName: "",
        gender: "male",
        birthDate: "",
        username: "",
        password: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error(error);
      setMessage("تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="setup-page">
      <div className="setup-background">
        <div className="setup-orb setup-orb-one" />
        <div className="setup-orb setup-orb-two" />
      </div>

      <section className="setup-card">
        <div className="setup-header">
          <div className="setup-logo">ش</div>

          <div>
            <span className="setup-eyebrow">
              الإعداد الأولي
            </span>

            <h1>إنشاء حساب المحرر</h1>

            <p>
              أنشئ أول عائلة وشخص وحساب مدير للنظام.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">

          <div className="setup-section">
            <div className="section-title">
              <span>01</span>
              <div>
                <h2>العائلة</h2>
                <p>أنشئ أول عائلة في النظام.</p>
              </div>
            </div>

            <label>
              <span>اسم العائلة</span>

              <input
                name="familyName"
                value={form.familyName}
                onChange={handleChange}
                placeholder="مثال: عائلة الرفي"
                autoComplete="off"
              />
            </label>
          </div>

          <div className="setup-divider" />

          <div className="setup-section">
            <div className="section-title">
              <span>02</span>
              <div>
                <h2>بياناتك في شجرة العائلة</h2>
                <p>
                  هذا الشخص سيكون مرتبطًا بحساب المحرر.
                </p>
              </div>
            </div>

            <div className="fields-grid">

              <label>
                <span>الاسم الأول</span>

                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="الاسم الأول"
                  autoComplete="given-name"
                />
              </label>

              <label>
                <span>اسم الأب</span>

                <input
                  name="middleName"
                  value={form.middleName}
                  onChange={handleChange}
                  placeholder="اسم الأب"
                  autoComplete="additional-name"
                />
              </label>

              <label>
                <span>اسم العائلة</span>

                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="اسم العائلة"
                  autoComplete="family-name"
                />
              </label>

              <label>
                <span>الجنس</span>

                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </label>

              <label className="full-width">
                <span>تاريخ الميلاد</span>

                <input
                  type="date"
                  name="birthDate"
                  value={form.birthDate}
                  onChange={handleChange}
                />
              </label>

            </div>
          </div>

          <div className="setup-divider" />

          <div className="setup-section">
            <div className="section-title">
              <span>03</span>
              <div>
                <h2>بيانات الدخول</h2>
                <p>
                  استخدمها للدخول إلى الموقع لاحقًا.
                </p>
              </div>
            </div>

            <div className="fields-grid">

              <label className="full-width">
                <span>اسم المستخدم</span>

                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="اسم المستخدم"
                  autoComplete="username"
                  dir="ltr"
                />
              </label>

              <label>
                <span>كلمة المرور</span>

                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="8 أحرف على الأقل"
                  autoComplete="new-password"
                  dir="ltr"
                />
              </label>

              <label>
                <span>تأكيد كلمة المرور</span>

                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="أعد كتابة كلمة المرور"
                  autoComplete="new-password"
                  dir="ltr"
                />
              </label>

            </div>
          </div>

          {message && (
            <div
              className={`setup-message ${
                success ? "success" : "error"
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            className="setup-submit"
            disabled={loading || success}
          >
            {loading
              ? "جاري إنشاء الحساب..."
              : success
              ? "تم إنشاء الحساب"
              : "إنشاء حساب المحرر"}
          </button>

          {success && (
            <a href="/login" className="login-link">
              الانتقال إلى تسجيل الدخول
            </a>
          )}
        </form>
      </section>
    </main>
  );
}
