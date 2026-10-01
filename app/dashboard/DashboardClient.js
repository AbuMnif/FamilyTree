"use client";

import { useState } from "react";

export default function DashboardClient({ account }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const person = account?.person;
  const family = person?.family;

  const fullName = [
    person?.first_name,
    person?.middle_name,
    person?.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  const familyName = family?.name || "العائلة";

  const isEditor = account?.role === "editor";

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      window.location.href = "/login";
    } catch (error) {
      console.error(error);
      setLoggingOut(false);
    }
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <main className="dashboard-shell">

      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-label="إغلاق القائمة"
        />
      )}

      <aside
        className={`dashboard-sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-top">

          <div className="brand">
            <div className="brand-mark">
              ش
            </div>

            <div>
              <strong>شجرة العائلة</strong>
              <span>{familyName}</span>
            </div>
          </div>

          <button
            className="mobile-close"
            onClick={closeSidebar}
            aria-label="إغلاق"
          >
            ×
          </button>

        </div>

        <div className="sidebar-person">

          <div className="person-avatar">
            {person?.first_name?.charAt(0) || "ش"}
          </div>

          <div className="person-info">
            <strong>
              {fullName || account.username}
            </strong>

            <span>
              {isEditor
                ? "محرر النظام"
                : "مستخدم"}
            </span>
          </div>

        </div>

        <nav className="sidebar-nav">

          <div className="nav-label">
            النظام
          </div>

          <a
            href="/dashboard"
            className="nav-item active"
            onClick={closeSidebar}
          >
            <span className="nav-icon">⌂</span>
            <span>الرئيسية</span>
          </a>

          <a
            href="/tree"
            className="nav-item"
            onClick={closeSidebar}
          >
            <span className="nav-icon">♧</span>
            <span>شجرة العائلة</span>
          </a>

          <a
            href="/people"
            className="nav-item"
            onClick={closeSidebar}
          >
            <span className="nav-icon">♙</span>
            <span>الأشخاص</span>
          </a>

          <a
            href="/archive"
            className="nav-item"
            onClick={closeSidebar}
          >
            <span className="nav-icon">▣</span>
            <span>الأرشيف</span>
          </a>

          <div className="nav-label nav-label-spaced">
            الحساب
          </div>

          <a
            href="/account"
            className="nav-item"
            onClick={closeSidebar}
          >
            <span className="nav-icon">◎</span>
            <span>حسابي</span>
          </a>

          {isEditor && (
            <>
              <div className="nav-label nav-label-spaced">
                الإدارة
              </div>

              <a
                href="/admin"
                className="nav-item"
                onClick={closeSidebar}
              >
                <span className="nav-icon">◆</span>
                <span>لوحة الإدارة</span>
              </a>
            </>
          )}

        </nav>

        <div className="sidebar-bottom">

          <button
            className="logout-button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <span className="nav-icon">
              ↪
            </span>

            <span>
              {loggingOut
                ? "جاري الخروج..."
                : "تسجيل الخروج"}
            </span>
          </button>

        </div>

      </aside>

      <section className="dashboard-main">

        <header className="dashboard-header">

          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="فتح القائمة"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="header-title">
            <span>
              {familyName}
            </span>

            <h1>
              الرئيسية
            </h1>
          </div>

          <div className="header-account">
            <div className="header-account-text">
              <strong>
                {fullName || account.username}
              </strong>

              <span>
                {isEditor
                  ? "محرر النظام"
                  : "مستخدم"}
              </span>
            </div>

            <div className="header-avatar">
              {person?.first_name?.charAt(0) || "ش"}
            </div>
          </div>

        </header>

        <div className="dashboard-content">

          <section className="welcome-card">

            <div className="welcome-content">

              <span className="welcome-eyebrow">
                أهلاً بك في {familyName}
              </span>

              <h2>
                {fullName || account.username}
              </h2>

              <p>
                هذه مساحتك الخاصة لإدارة واستعراض
                شجرة العائلة والأرشيف العائلي.
              </p>

            </div>

            <div className="welcome-decoration">
              <div className="tree-symbol">
                ش
              </div>
            </div>

          </section>

          <section className="dashboard-section">

            <div className="section-heading">
              <div>
                <span>الوصول السريع</span>

                <h2>
                  ماذا تريد أن تفعل؟
                </h2>
              </div>
            </div>

            <div className="quick-grid">

              <a
                href="/tree"
                className="quick-card"
              >
                <div className="quick-icon">
                  ♧
                </div>

                <div>
                  <h3>
                    شجرة العائلة
                  </h3>

                  <p>
                    استعرض أفراد العائلة وعلاقاتهم.
                  </p>
                </div>

                <span className="quick-arrow">
                  ←
                </span>
              </a>

              <a
                href="/people"
                className="quick-card"
              >
                <div className="quick-icon">
                  ♙
                </div>

                <div>
                  <h3>
                    الأشخاص
                  </h3>

                  <p>
                    ابحث واستعرض أفراد العائلة.
                  </p>
                </div>

                <span className="quick-arrow">
                  ←
                </span>
              </a>

              <a
                href="/archive"
                className="quick-card"
              >
                <div className="quick-icon">
                  ▣
                </div>

                <div>
                  <h3>
                    الأرشيف
                  </h3>

                  <p>
                    الصور والوثائق والتسجيلات العائلية.
                  </p>
                </div>

                <span className="quick-arrow">
                  ←
                </span>
              </a>

              <a
                href="/account"
                className="quick-card"
              >
                <div className="quick-icon">
                  ◎
                </div>

                <div>
                  <h3>
                    حسابي
                  </h3>

                  <p>
                    بيانات حسابك والشخص المرتبط بك.
                  </p>
                </div>

                <span className="quick-arrow">
                  ←
                </span>
              </a>

            </div>

          </section>

          {isEditor && (
            <section className="dashboard-section">

              <div className="section-heading">
                <div>
                  <span>الإدارة</span>

                  <h2>
                    أدوات المحرر
                  </h2>
                </div>
              </div>

              <a
                href="/admin"
                className="admin-card"
              >
                <div className="admin-icon">
                  ◆
                </div>

                <div className="admin-content">
                  <h3>
                    لوحة الإدارة
                  </h3>

                  <p>
                    إدارة العائلات والأشخاص والعلاقات
                    والحسابات والأرشيف.
                  </p>
                </div>

                <span className="quick-arrow">
                  ←
                </span>

              </a>

            </section>
          )}

          <section className="dashboard-footer">

            <div>
              <span className="footer-dot" />
              النظام يعمل بشكل طبيعي
            </div>

            <span>
              {familyName}
            </span>

          </section>

        </div>

      </section>

    </main>
  );
}
