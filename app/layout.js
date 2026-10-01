import "./layout.css";

export const metadata = {
  title: "شجرة العائلة",
  description: "نظام شجرة العائلة والأرشيف العائلي",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
