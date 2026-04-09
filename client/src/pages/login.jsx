import React, { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "../styles/login.css";

function Login() {
  // user states
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  // audio ref for music control
  const audioRef = useRef(null);

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post("http://localhost:5000/api/auth/login", {
        email,
        password,
      });
      localStorage.setItem("token", response.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message || "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <video autoPlay loop muted playsInline className="bg-video">
        <source src="/swaying_grass.mp4" type="video/mp4" />
      </video>
      <audio ref={audioRef} loop className="bg-audio">
        <source src="/calm_breeze.mp3" type="audio/mpeg" />
      </audio>
      <div className="overlay" />
      {/* Music toggle button */}
      <button
        className={`music-btn ${playing ? "music-btn--playing" : ""}`}
        onClick={toggleMusic}
      >
        {playing ? "♪ on " : "♪ off"}
      </button>

      {/* clouds */}
      <svg className="cloud cloud-lg" viewBox="0 0 110 55" fill="none">
        <ellipse
          cx="55"
          cy="38"
          rx="46"
          ry="17"
          fill="rgba(255,255,255,0.88)"
        />
        <ellipse
          cx="35"
          cy="30"
          rx="22"
          ry="20"
          fill="rgba(255,255,255,0.88)"
        />
        <ellipse
          cx="62"
          cy="26"
          rx="26"
          ry="22"
          fill="rgba(255,255,255,0.88)"
        />
        <ellipse
          cx="84"
          cy="33"
          rx="18"
          ry="15"
          fill="rgba(255,255,255,0.88)"
        />
      </svg>

      <svg className="cloud cloud-sm" viewBox="0 0 75 40" fill="none">
        <ellipse
          cx="37"
          cy="28"
          rx="32"
          ry="12"
          fill="rgba(255,255,255,0.80)"
        />
        <ellipse
          cx="22"
          cy="22"
          rx="16"
          ry="14"
          fill="rgba(255,255,255,0.80)"
        />
        <ellipse
          cx="45"
          cy="18"
          rx="18"
          ry="16"
          fill="rgba(255,255,255,0.80)"
        />
        <ellipse
          cx="60"
          cy="24"
          rx="13"
          ry="11"
          fill="rgba(255,255,255,0.80)"
        />
      </svg>

      <svg className="cloud cloud-xl" viewBox="0 0 140 65" fill="none">
        <ellipse
          cx="70"
          cy="48"
          rx="60"
          ry="18"
          fill="rgba(255,255,255,0.85)"
        />
        <ellipse
          cx="42"
          cy="38"
          rx="28"
          ry="24"
          fill="rgba(255,255,255,0.85)"
        />
        <ellipse
          cx="78"
          cy="32"
          rx="33"
          ry="28"
          fill="rgba(255,255,255,0.85)"
        />
        <ellipse
          cx="110"
          cy="40"
          rx="24"
          ry="20"
          fill="rgba(255,255,255,0.85)"
        />
      </svg>

      {/* fireflies */}
      <div className="fireflies fireflies-1" />
      <div className="fireflies fireflies-2" />
      <div className="fireflies fireflies-3" />
      <div className="fireflies fireflies-4" />

      {/* login card */}
      <div className="login-container">
        <span className="corner-deco corner-deco-tl">🍃</span>
        <span className="corner-deco corner-deco-tr">🌸</span>

        <div className="nook-badge">
          <span className="nook-leaf-icon" />
          HEARTH
        </div>

        <div className="card-title">Sign in</div>
        <div className="card-sub">welcome back, traveler ♪</div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-wrap">
            <label className="input-label"> email</label>
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

          <div className="input-wrap">
            <label className="input-label">password</label>
            <svg className="input-icon" viewBox="0 0 16 16" fill="none">
              <rect
                x="3"
                y="7"
                width="10"
                height="7"
                rx="2"
                stroke="#5aaa78"
                strokeWidth="1.5"
              />
              <path
                d="M5 7V5a3 3 0 016 0v2"
                stroke="#5aaa78"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="8" cy="10.5" r="1" fill="#5aaa78" />
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

          {error && <p className="error">{error}</p>}

          <button className="ac-btn" type="submit" disabled={loading}>
            {loading ? "loading... ✦" : "Login ✦"}
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
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
