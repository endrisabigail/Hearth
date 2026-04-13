import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "../pages/styles/login.css";

function JoinParty() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [partyInfo, setPartyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const AVATAR_MAP = {
    tomato: "🍅",
    frog: "🐸",
    fish: "🐟",
    mushroom: "🍄",
    apple: "🍎",
    snail: "🐌",
  };

  useEffect(() => {
    fetchPartyInfo();
  }, []);

  const fetchPartyInfo = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/party/invite/${inviteCode}`,
      );
      setPartyInfo(res.data);
    } catch (err) {
      setError("Party not found. Check your invite link!");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    // if not logged in, redirect to signup with invite code saved
    if (!token) {
      localStorage.setItem("pendingInvite", inviteCode);
      navigate("/signup");
      return;
    }

    setJoining(true);
    try {
      await axios.post(
        `http://localhost:5000/api/party/join/${inviteCode}`,
        {},
        { headers: { "x-auth-token": token } },
      );
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Could not join party.");
    } finally {
      setJoining(false);
    }
  };

  if (loading)
    return (
      <div className="login-page-wrapper">
        <div className="overlay" />
        <p style={{ color: "#fff", fontFamily: "Nunito", marginTop: "40vh" }}>
          Finding your party... ✦
        </p>
      </div>
    );

  return (
    <div className="login-page-wrapper">
      <video autoPlay loop muted playsInline className="bg-video">
        <source src="/swaying_grass.mp4" type="video/mp4" />
      </video>
      <div className="overlay" />

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

      <div className="fireflies fireflies-1" />
      <div className="fireflies fireflies-3" />

      <div className="login-container">
        <span className="corner-deco corner-deco-tl">🏡</span>
        <span className="corner-deco corner-deco-tr">🌿</span>

        <div className="nook-badge">
          <span className="nook-leaf-icon" />
          HEARTH
        </div>

        {error ? (
          <>
            <div className="card-title">Oops!</div>
            <div className="card-sub">{error}</div>
            <button className="ac-btn" onClick={() => navigate("/login")}>
              Back to Login ✦
            </button>
          </>
        ) : (
          partyInfo && (
            <>
              <div className="card-title">You're Invited!</div>
              <div className="card-sub">to join a Hearth ♪</div>

              <div
                style={{
                  background: "rgba(90,170,74,0.1)",
                  border: "2px solid rgba(90,170,74,0.25)",
                  borderRadius: "14px",
                  padding: "14px",
                  margin: "12px 0",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "20px",
                    margin: "0 0 4px",
                    fontWeight: 800,
                    color: "#2d5a27",
                    fontFamily: "Nunito",
                  }}
                >
                  {partyInfo.partyName}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#6aaa5e",
                    margin: "0 0 8px",
                    fontFamily: "Nunito",
                    fontWeight: 700,
                  }}
                >
                  {AVATAR_MAP[partyInfo.owner?.avatarId] || "🐾"} Led by{" "}
                  {partyInfo.owner?.username}
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    color: "rgba(61,43,31,0.5)",
                    margin: 0,
                    fontFamily: "Nunito",
                    fontWeight: 600,
                  }}
                >
                  {partyInfo.memberCount} member
                  {partyInfo.memberCount !== 1 ? "s" : ""} already inside
                </p>
              </div>

              <button
                className="ac-btn"
                onClick={handleJoin}
                disabled={joining}
              >
                {joining ? "Joining... ✦" : "Join this Hearth! ✦"}
              </button>

              {!token && (
                <p className="login-footer" style={{ marginTop: "8px" }}>
                  You'll need to sign up or log in first!
                </p>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}

export default JoinParty;
