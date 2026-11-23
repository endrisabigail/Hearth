import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import AuthLayout from "./AuthLayout.jsx";
import { Button, Field } from "../components/ui/primitives.jsx";
import { auth, firebaseConfigured } from "../lib/firebase.js";
import { api, errMsg } from "../lib/api.js";
import { DemoButton } from "./Login.jsx";

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invite = params.get("invite");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(username.trim())) {
      setError("Usernames are 3–20 letters, numbers, dots, dashes or underscores.");
      return;
    }
    setLoading(true);
    try {
      if (!auth.currentUser) await createUserWithEmailAndPassword(auth, email.trim(), password);
      await api.post("/auth/register", { username: username.trim(), inviteCode: invite || undefined });
      navigate(invite ? `/avatar?invite=${invite}` : "/avatar");
    } catch (err) {
      setError(
        err.code === "auth/email-already-in-use"
          ? "That email already has an account. Sign in instead."
          : err.code === "auth/weak-password"
            ? "Use a password with at least 6 characters."
            : err.code === "auth/invalid-email"
              ? "That email address doesn't look right."
              : errMsg(err, "Couldn't create your account. Try again in a moment."),
      );
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth__title">Start a Hearth</h1>
      <p className="auth__lede">
        {invite ? "You've been invited to a party. Make an account and you'll land right in their plaza." : "Make an account, pick a character, and turn your to-do list into a little world."}
      </p>
      {firebaseConfigured ? (
        <form className="form" onSubmit={submit}>
          <Field label="Username" hint="This is what your party sees above your character.">
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required data-autofocus />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field label="Password">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
          </Field>
          {error && <p className="form__error" role="alert">{error}</p>}
          <Button variant="primary" size="lg" type="submit" loading={loading}>
            Create account
          </Button>
          <div className="form__row">
            <span>Already have one?</span>
            <Link to="/login">Sign in</Link>
          </div>
        </form>
      ) : (
        <>
          <p className="notice">Accounts aren't set up on this build yet.</p>
          <DemoButton variant="primary" />
        </>
      )}
    </AuthLayout>
  );
}
