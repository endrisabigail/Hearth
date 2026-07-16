import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../firebase";
import "../pages/styles/login.css";

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(true);
  const [validCode, setValidCode] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!oobCode) {
      setError("missing or invalid reset link.");
      setCheckingCode(false);
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((userEmail) => {
        setEmail(userEmail);
        setValidCode(true);
      })
      .catch(() => {
        setError("this reset link is invalid or has expired.");
      })
      .finally(() => setCheckingCode(false));
  }, [oobCode]);

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      return setError("password must be at least 8 characters");
    }

    if (password !== confirm) {
      return setError("passwords don't match :(");
    }

    setLoading(true);

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess("password reset! redirecting you to login ♡");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      console.error(err);
      setError(
        err.code === "auth/weak-password"
          ? "please choose a stronger password."
          : "invalid or expired link. please try again.",
      );
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

        <div className="card-title">Reset Password</div>

        {checkingCode ? (
          <div className="card-sub">checking your link...</div>
        ) : !validCode ? (
          <>
            <div className="card-sub">{error}</div>
            <p className="login-footer">
              <Link to="/forgot-password">Request a new link</Link>
            </p>
          </>
        ) : (
          <>
            <div className="card-sub">
              resetting password for <strong>{email}</strong>
            </div>

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
          </>
        )}

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

export default ResetPassword;