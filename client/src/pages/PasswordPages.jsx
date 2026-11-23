import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset, sendPasswordResetEmail, verifyPasswordResetCode } from "firebase/auth";
import AuthLayout from "./AuthLayout.jsx";
import { Button, Field, Spinner } from "../components/ui/primitives.jsx";
import { auth } from "../lib/firebase.js";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {}
    setSent(true);
    setLoading(false);
  };

  return (
    <AuthLayout>
      <h1 className="auth__title">Reset your password</h1>
      {sent ? (
        <>
          <p className="auth__lede">If an account uses {email}, a reset link is on its way. It can take a minute or two to arrive.</p>
          <Link className="btn btn--ghost btn--md" to="/login">Back to sign in</Link>
        </>
      ) : (
        <form className="form" onSubmit={submit}>
          <p className="auth__lede">Enter the email you signed up with and we'll send you a link to choose a new password.</p>
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-autofocus />
          </Field>
          <Button variant="primary" size="lg" type="submit" loading={loading}>Send reset link</Button>
          <div className="form__row"><Link to="/login">Back to sign in</Link></div>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const code = params.get("oobCode");
  const [status, setStatus] = useState("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code || !auth) {
      setStatus("invalid");
      return;
    }
    verifyPasswordResetCode(auth, code)
      .then((e) => {
        setEmail(e);
        setStatus("ready");
      })
      .catch(() => setStatus("invalid"));
  }, [code]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those passwords don't match.");
    setLoading(true);
    try {
      await confirmPasswordReset(auth, code, password);
      setStatus("done");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.code === "auth/weak-password" ? "Choose a stronger password." : "This link has expired. Request a new one.");
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth__title">Choose a new password</h1>
      {status === "checking" && <Spinner />}
      {status === "invalid" && (
        <>
          <p className="auth__lede">This reset link is missing or has expired.</p>
          <Link className="btn btn--primary btn--md" to="/forgot-password">Request a new link</Link>
        </>
      )}
      {status === "done" && <p className="auth__lede">Password updated. Taking you to sign in…</p>}
      {status === "ready" && (
        <form className="form" onSubmit={submit}>
          <p className="auth__lede">For {email}</p>
          <Field label="New password">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required data-autofocus />
          </Field>
          <Field label="Type it again">
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </Field>
          {error && <p className="form__error" role="alert">{error}</p>}
          <Button variant="primary" size="lg" type="submit" loading={loading}>Update password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
