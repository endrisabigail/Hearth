import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../pages/styles/navModal.css";

function NavModal({ party, api, onClose }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleCopyInvite = () => {
    if (party?.inviteCode) {
      navigator.clipboard.writeText(
        `${window.location.origin}/join/${party.inviteCode}`
      );
    }
  };

  return (
    <div className="nm-overlay" onClick={onClose}>
      <div className="nm-card" onClick={(e) => e.stopPropagation()}>
        <div className="nm-header">
          <span className="nm-title">⚙️ SETTINGS</span>
          <button className="nm-close-btn" onClick={onClose}>
            CLOSE ✕
          </button>
        </div>

        <div className="nm-body">
          <div className="nm-section">
            {/* Music Volume */}
            <div className="nm-slider-row">
              <span className="nm-slider-label">🎵 Music Volume</span>
              <input
                type="range"
                className="nm-slider"
                defaultValue={70}
                min={0}
                max={100}
              />
            </div>

            {/* Sound Effects Volume */}
            <div className="nm-slider-row">
              <span className="nm-slider-label">🔊 Sound Effects Volume</span>
              <input
                type="range"
                className="nm-slider"
                defaultValue={50}
                min={0}
                max={100}
              />
            </div>

            {/* Live Settings On/Off */}
            <ToggleRow label="🟢 Live Settings" defaultOn={true} />

            {/* Notifications */}
            <ToggleRow label="🔔 Notifications" defaultOn={true} />

            {/* Copy Invite Link */}
            {party?.inviteCode && (
              <button className="nm-invite-btn" onClick={handleCopyInvite}>
                📬 Copy Invite Link
              </button>
            )}

            {/* Logout */}
            <button className="nm-logout-btn" onClick={handleLogout}>
              🚪 Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, defaultOn }) {
  const [on, setOn] = useState(defaultOn);

  return (
    <div className="nm-toggle-row">
      <span className="nm-toggle-label">{label}</span>
      <button
        className={`nm-toggle ${on ? "on" : "off"}`}
        onClick={() => setOn(!on)}
        aria-label={label}
      />
    </div>
  );
}

export default NavModal;