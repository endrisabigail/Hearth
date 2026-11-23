import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import AuthLayout from "./AuthLayout.jsx";
import { Button, Field } from "../components/ui/primitives.jsx";
import { auth, firebaseConfigured } from "../lib/firebase.js";
import { useAuth } from "../lib/auth.jsx";
import { enterDemo, isDemo } from "../lib/demo.js";

export function DemoButton({ variant = "ghost" }) {
  const navigate = useNavigate();
  return (
    <Button
      variant={variant}
      icon="globe"
      type="button"
      onClick={() => {
        enterDemo();
        navigate("/avatar?demo=1");
      }}
    >
      Walk around a demo plaza
    </Button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDemo()) navigate("/plaza", { replace: true });
    else if (ready && user) navigate(location.state?.from || "/plaza", { replace: true });
  }, [ready, user]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate(location.state?.from || "/plaza");
    } catch (err) {
      setError(
        err.code === "auth/too-many-requests"
          ? "Too many tries. Wait a minute, then sign in again."
          : "That email and password don't match. Check them and try again.",
      );
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth__title">Welcome back</h1>
      <p className="auth__lede">Your plaza, your party and your quests are waiting where you left them.</p>
      {firebaseConfigured ? (
        <form className="form" onSubmit={submit}>
          <Field label="Email">
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-autofocus />
          </Field>
          <Field label="Password">
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p className="form__error" role="alert">{error}</p>}
          <Button variant="primary" size="lg" type="submit" loading={loading}>
            Sign in
          </Button>
          <div className="form__row">
            <Link to="/forgot-password">Forgot password?</Link>
            <Link to="/signup">Create an account</Link>
          </div>
        </form>
      ) : (
        <p className="notice">Sign-in isn't set up on this build yet. Add your Firebase keys to <code>.env</code> to enable accounts.</p>
      )}
      <div className="auth__divider"><span>or just look around</span></div>
      <DemoButton variant={firebaseConfigured ? "ghost" : "primary"} />
    </AuthLayout>
  );
}
