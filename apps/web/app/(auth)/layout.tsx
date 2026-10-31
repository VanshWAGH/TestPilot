import { AuthHero } from "@/components/auth/auth-hero";
import { ThemeToggle } from "@/components/auth/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <AuthHero />
      <main className="auth-main">
        <div className="auth-top">
          <ThemeToggle />
        </div>
        <div className="auth-wrap">
          {children}
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className="auth-clerk">
            <span>
              Secured by <b style={{ color: "var(--tp-ink)" }}>Clerk</b>
            </span>
            <span className="auth-dev">Development mode</span>
          </div>
        </div>
      </main>
    </div>
  );
}
