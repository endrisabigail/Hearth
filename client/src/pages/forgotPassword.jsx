import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import "../pages/styles/login.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("check your email for a reset link ♡");
    } catch (err) {
      console.error(err);
      // Deliberately vague, so this can't be used to check which emails are registered
      setError("if an account exists for that email, a reset link has been sent.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="overlay" />

      <div className="login-container">
        <span className="corner-deco corner-deco-tl">🌱</span>
        <span className="corner-deco corner-deco-tr">☘️</span>
        <svg
          viewBox="0 0 200 60"
          style={{ width: "200px", marginBottom: "-10px" }}
        >
          <defs>
            <path id="curve" d="M 15,55 Q 100,-10 190,65" />
          </defs>
          <text
            fontFamily="DotGothic16, monospace"
            fontSize="22"
            fontWeight="900"
            fill="#5aaa78"
            letterSpacing="6"
          >
            <textPath href="#curve" startOffset="50%" textAnchor="middle">
              Hearth
            </textPath>
          </text>
        </svg>
        <img
          src="/hearthlogo.png"
          alt="Hearth"
          style={{ width: "220px", marginBottom: "-67px", marginTop: "-85px" }}
        />

        <div className="card-title">Forgot Password</div>
        <div className="card-sub">we'll email you a reset link</div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-wrap">
            <label className="input-label">email</label>
            <input
              className="ac-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}

          <button className="ac-btn" type="submit" disabled={loading}>
            {loading ? "sending... ✦" : "Send Reset Link ✦"}
          </button>
        </form>

        <div className="divider-row">
          <div className="divider-line"  />
          <div className="divider-dot" />
          <div className="divider-dot" />
          <div className="divider-dot" />
          <div className="divider-line" />
        </div>

        <p className="login-footer">
          Back to <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;