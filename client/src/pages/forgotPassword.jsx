import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "../pages/styles/login.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
 
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
      setSuccess("✉️ check your email for a reset link ♡");
      setTimeout(() => navigate("/login"), 4000);
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
        <div className="card-sub">we'll send you a reset link🍃</div>

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
          {success && <p className="success">{success}</p>}

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
