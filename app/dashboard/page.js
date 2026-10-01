import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import "./page.css";

export default async function DashboardPage() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  const person = account.person;

  const fullName = [
    person?.first_name,
    person?.middle_name,
    person?.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  const accountType =
    account.role === "editor"
      ? "محرر النظام"
      : "مستخدم";

  return (
    <main className="dashboard-page">
      <section className="dashboard-card">
        <div className="dashboard-mark">
          ش
        </div>

        <div>
          <span className="dashboard-label">
            مرحبًا بك في
          </span>

          <h1>شجرة العائلة</h1>

          <p className="dashboard-name">
            {fullName || account.username}
          </p>

          <p className="dashboard-role">
            {accountType}
          </p>
        </div>

        <div className="dashboard-status">
          <span />
          تم تسجيل الدخول بنجاح
        </div>
      </section>
    </main>
  );
}
