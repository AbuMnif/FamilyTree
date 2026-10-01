import "./page.css";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-heading">
          <span>الأرشيف العائلي</span>

          <h1>تسجيل الدخول</h1>

          <p>
            أدخل بيانات حسابك للوصول إلى شجرة العائلة والأرشيف.
          </p>
        </div>

        <form className="login-form">
          <label>
            اسم المستخدم
            <input
              type="text"
              name="username"
              placeholder="اسم المستخدم"
            />
          </label>

          <label>
            كلمة المرور
            <input
              type="password"
              name="password"
              placeholder="كلمة المرور"
            />
          </label>

          <button type="submit">
            دخول
          </button>
        </form>
      </section>
    </main>
  );
}
