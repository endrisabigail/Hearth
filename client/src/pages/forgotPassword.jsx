import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "../pages/styles/login.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
      setError(
        "If an account with that email exists, a reset link has been sent.",
      );
      navigate("/login");
    } catch (err) {
      setError("Failed to send reset link. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="overlay" />

      <div className="login-container">
        <span className="corner-deco corner-deco-tl">🌱</span>
        <span className="corner-deco corner-deco-tr">✨</span>

        <div className="nook-badge">
          <span className="nook-leaf-icon" />
          HEARTH
        </div>

        <div className="card-title">Forgot Password</div>
        <div className="card-sub">we'll send you a reset link ♪</div>

        <form onSubmit={handleForgotPassword} className="login-form">
          <div className="input-wrap">
            <label className="input-label">email</label>
            <svg className="input-icon" viewBox="0 0 16 16" fill="none">
              <rect
                x="1"
                y="3"
                width="14"
                height="10"
                rx="2"
                stroke="#5aaa78"
                strokeWidth="1.5"
              />
              <path
                d="M1 5l7 5 7-5"
                stroke="#5aaa78"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              className="ac-input"
              type="email"
              placeholder="e.g. your-email@email.com ♡"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button className="ac-btn" type="submit" disabled={loading}>
            {loading ? "sending... ✦" : "Send Reset Link ✦"}
          </button>
        </form>

        <div className="divider-row">
          <div className="divider-line" />
          <div className="divider-dot" />
          <div className="divider-dot" />
          <div className="divider-dot" />
          <div className="divider-line" />
        </div>

        <p className="login-footer">
          Remembered it? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
