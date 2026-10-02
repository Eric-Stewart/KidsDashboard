import { signIn } from "@/auth";
import { demoEnabled } from "@/lib/auth-policy";
import { BookOpen, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const googleReady =
    !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
  async function googleLogin() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }
  async function preview() {
    "use server";
    if (!demoEnabled()) throw new Error("Preview unavailable");
    await signIn("local-preview", { redirectTo: "/dashboard" });
  }
  return (
    <main className="login-page">
      <section className="login-card">
        <span className="brand-mark">
          <BookOpen size={26} />
        </span>
        <p className="eyebrow">FAMILY SCHOOL</p>
        <h1>
          A little clarity.
          <br />
          Every school day.
        </h1>
        <p className="muted">
          Assignments, grades, and the things that need your attention. All in
          one private place.
        </p>
        <div className="login-actions">
          {error && (
            <p role="alert" className="error-note">
              Sign-in was unsuccessful. Use an approved parent account.
            </p>
          )}
          {googleReady ? (
            <form action={googleLogin}>
              <Button size="lg" className="w-full">
                Sign in with Google
              </Button>
            </form>
          ) : (
            <p className="setup-note">
              Parent sign-in is not configured yet. Follow the setup guide to
              enable your approved Google account.
            </p>
          )}
          {demoEnabled() && (
            <form action={preview}>
              <Button size="lg" className="w-full">
                Explore local sample dashboard
              </Button>
              <p className="small muted">
                Fictional data · available only on this computer
              </p>
            </form>
          )}
        </div>
        <p className="privacy">
          <LockKeyhole size={15} /> Only approved family members can sign in.
        </p>
      </section>
      <div className="login-art" aria-hidden="true">
        <div className="login-art-inner">
          <span className="eyebrow">A CLEARER PICTURE</span>
          <p>
            Less checking.
            <br />
            More connecting.
          </p>
          <div className="art-line" />
          <span>Your family’s school day, together.</span>
        </div>
      </div>
    </main>
  );
}
