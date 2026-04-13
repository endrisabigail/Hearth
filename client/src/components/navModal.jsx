import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/navModal.css";

const AVATAR_MAP = {
  tomato: "🍅",
  frog: "🐸",
  fish: "🐟",
  mushroom: "🍄",
  apple: "🍎",
  snail: "🐌",
};

function NavModal({ userData, party, api, onClose }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("personal");

  const partyMembers = [
    ...(party?.owner ? [{ ...party.owner, isOwner: true }] : []),
    ...(party?.members || []),
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="nm-overlay" onClick={onClose}>
      <div className="nm-card" onClick={(e) => e.stopPropagation()}>
        <div className="nm-header">
          <span className="nm-title">⚙️ GUILD HALL (SETTINGS)</span>
          <button className="nm-close-btn" onClick={onClose}>
            CLOSE ✕
          </button>
        </div>

        <div className="nm-tabs">
          <button
            className={`nm-tab ${activeTab === "personal" ? "active" : ""}`}
            onClick={() => setActiveTab("personal")}
          >
            👤 Personal
          </button>
          <button
            className={`nm-tab ${activeTab === "guild" ? "active" : ""}`}
            onClick={() => setActiveTab("guild")}
          >
            🏡 Guild
          </button>
          <button
            className={`nm-tab ${activeTab === "navigate" ? "active" : ""}`}
            onClick={() => setActiveTab("navigate")}
          >
            🗺️ Navigate
          </button>
        </div>

        <div className="nm-body">
          {activeTab === "personal" && (
            <div className="nm-section">
              {/* Profile */}
              <div className="nm-profile-card">
                <div className="nm-avatar-bubble">
                  {AVATAR_MAP[userData?.avatarId] || "🐾"}
                </div>
                <div className="nm-profile-info">
                  <p className="nm-username">
                    {userData?.username || "Villager"}
                  </p>
                  <p className="nm-rank">{userData?.rank || "New Leaf"}</p>
                  <div className="nm-profile-btns">
                    <button
                      className="nm-chip-btn"
                      onClick={() => {
                        onClose();
                      }}
                    >
                      📖 Passport
                    </button>
                    <button
                      className="nm-chip-btn"
                      onClick={() => {
                        onClose();
                      }}
                    >
                      👗 Outfit
                    </button>
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div className="nm-section-heading">Notification Pings</div>
              <ToggleRow label="New Quest Popup" defaultOn={true} />
              <ToggleRow label="Chat Mentions" defaultOn={false} />
              <ToggleRow label="Daily Summary" defaultOn={true} />

              {/* Sounds */}
              <div className="nm-section-heading">Sounds & Music</div>
              <div className="nm-slider-row">
                <span className="nm-slider-label">BGM</span>
                <input
                  type="range"
                  className="nm-slider"
                  defaultValue={70}
                  min={0}
                  max={100}
                />
              </div>
              <div className="nm-slider-row">
                <span className="nm-slider-label">Sound FX</span>
                <input
                  type="range"
                  className="nm-slider"
                  defaultValue={50}
                  min={0}
                  max={100}
                />
              </div>
              <ToggleRow label="🎣 Fishing Mode" defaultOn={false} />

              {/* Logout */}
              <button className="nm-logout-btn" onClick={handleLogout}>
                🚪 Log Out
              </button>
            </div>
          )}

          {activeTab === "guild" && (
            <div className="nm-section">
              <div className="nm-section-heading">Neighbor List</div>
              {partyMembers.length > 0 ? (
                partyMembers.map((m) => (
                  <div key={m._id} className="nm-member-row">
                    <div className="nm-member-emoji">
                      {AVATAR_MAP[m.avatarId] || "🐾"}
                    </div>
                    <div>
                      <p className="nm-member-name">
                        {m.username}
                        {m.isOwner && <span className="nm-crown">👑</span>}
                      </p>
                      <p className="nm-member-role">
                        {m.isOwner ? "Lead" : "Member"} · 🔥{" "}
                        {m.streak?.current || 0}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: "#8b6040", fontSize: 12, fontWeight: 700 }}>
                  No members yet! Share your invite link ✦
                </p>
              )}

              {userData?.isPartyOwner && party?.inviteCode && (
                <button
                  className="nm-invite-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/join/${party.inviteCode}`,
                    );
                  }}
                >
                  📬 Invite New Neighbor
                </button>
              )}

              <div className="nm-section-heading" style={{ marginTop: 16 }}>
                Webhooks & Integrations
              </div>
              <ToggleRow label="GitHub Push → Grow Tree" defaultOn={true} />
              <ToggleRow label="Discord Notifications" defaultOn={false} />
            </div>
          )}

          {activeTab === "navigate" && (
            <div className="nm-section">
              <div className="nm-section-heading">Pages</div>
              {[
                {
                  icon: "🗺️",
                  label: "Plaza Map",
                  sub: "Home",
                  path: "/dashboard",
                },
                { icon: "📋", label: "Board", sub: "Quests", path: "/board" },
                {
                  icon: "📖",
                  label: "Passport",
                  sub: "Profile",
                  path: "/passport",
                },
                {
                  icon: "🎒",
                  label: "Pocket",
                  sub: "Inventory",
                  path: "/pocket",
                },
              ].map((item) => (
                <div
                  key={item.path}
                  className="nm-nav-link"
                  onClick={() => {
                    onClose();
                  }}
                >
                  <span className="nm-nav-link-icon">{item.icon}</span>
                  <span className="nm-nav-link-text">{item.label}</span>
                  <span className="nm-nav-link-sub">{item.sub} →</span>
                </div>
              ))}

              <div className="nm-section-heading" style={{ marginTop: 16 }}>
                Account
              </div>
              <button className="nm-logout-btn" onClick={handleLogout}>
                🚪 Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, defaultOn }) {
  const [on, setOn] = React.useState(defaultOn);
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
