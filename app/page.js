import "./page.css";

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-content">
          <span className="home-kicker">الأرشيف العائلي</span>

          <h1>
            شجرة
            <br />
            العائلة
          </h1>

          <p>
            منصة خاصة لحفظ شجرة العائلة وذكرياتها وصورها
            وتسجيلاتها ووثائقها في مكان واحد.
          </p>

          <a href="/login" className="home-button">
            تسجيل الدخول
          </a>
        </div>

        <div className="home-tree">
          <div className="tree-node tree-grandparent">
            <span>الجد</span>
          </div>

          <div className="tree-line tree-line-main" />

          <div className="tree-children">
            <div className="tree-node">
              <span>الأب</span>
            </div>

            <div className="tree-node tree-current">
              <span>أنت</span>
            </div>

            <div className="tree-node">
              <span>العم</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
