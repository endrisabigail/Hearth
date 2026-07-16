import React from "react";
import { Link } from "react-router-dom";
import "../pages/styles/login.css";

function ForgotPassword() {
  return (
    <div className="login-page-wrapper">
      <video autoPlay loop muted playsInline className="bg-video">
        <source src="/swaying_grass.mp4" type="video/mp4" />
      </video>
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

        <div className="card-title">oops! 🍄</div>
        <div className="card-sub">password reset coming soon ♪ </div>

        <p
          style={{
            fontSize: "13px",
            color: "#7aab7e",
            textAlign: "center",
            lineHeight: "1.6",
            margin: "16px 0",
            fontFamily: "'DotGothic16', monospace",
          }}
        >
          we're still setting this up! for now, please reach out if you need
          help ✉️
        </p>

        <Link to="/login">
          <button className="ac-btn">back to login ✦</button>
        </Link>

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
