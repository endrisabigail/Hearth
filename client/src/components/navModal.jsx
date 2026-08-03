import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../pages/styles/navModal.css";

function NavModal({ party, api, onClose }) {
  const navigate = useNavigate();

  const [musicVolume, setMusicVolume] = useState(() => {
    const saved = localStorage.getItem("hearth_musicVolume");
    return saved !== null ? Number(saved) : 70;
  });

  const [sfxVolume, setSfxVolume] = useState(() => {
    const saved = localStorage.getItem("hearth_sfxVolume");
    return saved !== null ? Number(saved) : 50;
  });

  const handleMusicVolumeChange = (e) => {
    const value = Number(e.target.value);
    setMusicVolume(value);
    localStorage.setItem("hearth_musicVolume", String(value));
    window.dispatchEvent(
      new CustomEvent("hearth:volumechange", {
        detail: { channel: "music", value: value / 100 },
      }),
    );
  };

  const handleSfxVolumeChange = (e) => {
    const value = Number(e.target.value);
    setSfxVolume(value);
    localStorage.setItem("hearth_sfxVolume", String(value));
    window.dispatchEvent(
      new CustomEvent("hearth:volumechange", {
        detail: { channel: "sfx", value: value / 100 },
      }),
    );
  };

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
          <span className="nm-title">Settings</span>
          <button className="nm-close-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="nm-body">
          <div className="nm-section">
            <p className="nm-section-heading">Sound</p>

            <div className="nm-slider-row">
              <div className="nm-slider-label-row">
                <span className="nm-slider-label">Music Volume</span>
                <span className="nm-slider-value">{musicVolume}%</span>
              </div>
              <input
                type="range"
                className="nm-slider"
                value={musicVolume}
                min={0}
                max={100}
                onChange={handleMusicVolumeChange}
              />
            </div>

            <div className="nm-slider-row">
              <div className="nm-slider-label-row">
                <span className="nm-slider-label">Sound Effects Volume</span>
                <span className="nm-slider-value">{sfxVolume}%</span>
              </div>
              <input
                type="range"
                className="nm-slider"
                value={sfxVolume}
                min={0}
                max={100}
                onChange={handleSfxVolumeChange}
              />
            </div>

            <p className="nm-section-heading">Preferences</p>

            <ToggleRow label="Live Settings" defaultOn={true} />
            <ToggleRow label="Notifications" defaultOn={true} />

            {party?.inviteCode && (
              <button className="nm-btn nm-invite-btn" onClick={handleCopyInvite}>
                Copy Invite Link
              </button>
            )}

            <button className="nm-btn nm-logout-btn" onClick={handleLogout}>
              Log Out
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
