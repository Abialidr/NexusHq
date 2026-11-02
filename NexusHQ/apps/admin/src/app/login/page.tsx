import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="login">
      <div className="card">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">N</div>
          <div><b>NexusHQ</b><small>Admin console</small></div>
        </div>
        <div><h1 style={{ fontSize: 26 }}>Sign in</h1><p className="muted">Only the portfolio owner can sign in here.</p></div>
        {error === "not-admin" && <p className="err">This account is signed in but does not have the admin role.</p>}
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
