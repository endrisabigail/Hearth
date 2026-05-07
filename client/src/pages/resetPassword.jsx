import React, { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import axios from "axios";
import "../pages/styles/login.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function resetPassword() {
  const navigate = useNavigate();
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirm) {
      return setError("passwords don't match :(");
    }

    setLoading(true);

    try {
      await axios.post(`${API_URL}/api/auth/reset-password/${token}`, {
        password,
      });
      setSuccess("password reset! redirecting you to login ♡");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(
        err.response?.data?.msg || "invalid or expired link. please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="overlay" />

      <div className="login-container">
        <span className="corner-deco corner-deco-tl">🌿</span>
        <span className="corner-deco corner-deco-tr">✨</span>

        <img
          src="/hearthlogo.png"
          alt="Hearth"
          style={{ width: "140px", marginBottom: "8px" }}
        />

        <div className="card-title">Reset Password</div>
        <div className="card-sub">choose a new password ♪</div>

        <form onSubmit={handleReset} className="login-form">
          <div className="input-wrap">
            <label className="input-label">new password</label>
            <svg className="input-icon" viewBox="0 0 16 16" fill="none">
              <rect
                x="3"
                y="7"
                width="10"
                height="7"
                rx="1.5"
                stroke="#5aaa78"
                strokeWidth="1.5"
              />
              <path
                d="M5 7V5a3 3 0 016 0v2"
                stroke="#5aaa78"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              className="ac-input"
              type="password"
              placeholder="✦ ✦ ✦ ✦ ✦ ✦"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="input-wrap">
            <label className="input-label">confirm password</label>
            <svg className="input-icon" viewBox="0 0 16 16" fill="none">
              <rect
                x="3"
                y="7"
                width="10"
                height="7"
                rx="1.5"
                stroke="#5aaa78"
                strokeWidth="1.5"
              />
              <path
                d="M5 7V5a3 3 0 016 0v2"
                stroke="#5aaa78"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              className="ac-input"
              type="password"
              placeholder="✦ ✦ ✦ ✦ ✦ ✦"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}

          <button className="ac-btn" type="submit" disabled={loading}>
            {loading ? "resetting... ✦" : "Reset Password ✦"}
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
          Back to <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default resetPassword;
