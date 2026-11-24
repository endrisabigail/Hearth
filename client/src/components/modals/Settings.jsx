import { useNavigate } from "react-router-dom";
import { Modal, ModalHeader, Button, Segmented, Toggle } from "../ui/primitives.jsx";
import Icon from "../ui/Icon.jsx";
import Avatar from "../ui/Avatar.jsx";
import { useSettings, setSettings } from "../../lib/settings.js";
import { signOut } from "../../lib/auth.jsx";
import { AVATARS, themeFor } from "../../lib/avatars.js";
import { isDemo } from "../../lib/demo.js";

function Slider({ label, value, onChange, icon }) {
  return (
    <label className="slider">
      <span className="slider__label">
        <Icon name={icon} size={16} /> {label}
      </span>
      <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} style={{ "--fill": `${value * 100}%` }} />
      <span className="slider__val">{Math.round(value * 100)}</span>
    </label>
  );
}

export default function Settings({ open, onClose, party, user, liveQuality, toast }) {
  const s = useSettings();
  const navigate = useNavigate();
  const invite = party?.inviteCode ? `${window.location.origin}/join/${party.inviteCode}` : null;

  const copyInvite = async () => {
    try {
      if (navigator.share && /Mobi/.test(navigator.userAgent)) await navigator.share({ title: "Join my Hearth", url: invite });
      else await navigator.clipboard.writeText(invite);
      toast("Invite link copied", { icon: "🔗" });
    } catch {}
  };

  return (
    <Modal open={open} onClose={onClose} label="Settings" className="settings">
      <ModalHeader title="Settings" onClose={onClose} />
      <div className="modal__body">
        <section className="set">
          <h3>Sound</h3>
          <Slider label="Music" icon="music" value={s.musicVolume} onChange={(v) => setSettings({ musicVolume: v })} />
          <Slider label="Effects" icon="sound" value={s.sfxVolume} onChange={(v) => setSettings({ sfxVolume: v })} />
        </section>
        <section className="set">
          <h3>Graphics</h3>
          <Segmented
            options={[
              { value: "auto", label: "Auto" },
              { value: "low", label: "Battery saver" },
              { value: "medium", label: "Balanced" },
              { value: "high", label: "Pretty" },
            ]}
            value={s.quality}
            onChange={(v) => setSettings({ quality: v })}
            className="seg-quality"
          />
          <p className="muted small">{s.quality === "auto" ? `Auto adjusts to your device. Right now it's using ${liveQuality || "high"}.` : "Applies right away. Battery saver turns off shadows."}</p>
          <Toggle label="Show names and quest labels" checked={s.showNames} onChange={(v) => setSettings({ showNames: v })} />
          <Toggle label="Reduce motion" checked={s.reducedMotion} onChange={(v) => setSettings({ reducedMotion: v })} />
        </section>
        <section className="set">
          <h3>Party</h3>
          {invite ? (
            <div className="invite-box">
              <code>{invite.replace(/^https?:\/\//, "")}</code>
              <Button size="sm" icon="link" onClick={copyInvite}>Copy invite</Button>
            </div>
          ) : (
            <p className="muted">You're not in a party yet.</p>
          )}
          <Button variant="ghost" icon="user" onClick={() => navigate(`/avatar?current=${user?.avatarId || "frog"}`)}>Change character</Button>
        </section>
        <div className="set__foot">
          <Button
            variant="ghost"
            icon="logout"
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
          >
            {isDemo() ? "Leave the demo" : "Sign out"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function PlazaPicker({ open, onClose, homeId, currentId, onPick }) {
  return (
    <Modal open={open} onClose={onClose} label="Visit plazas" wide className="plazas">
      <ModalHeader title="Visit another plaza" onClose={onClose} />
      <div className="modal__body">
        <p className="muted">Every character has a home plaza. Your party's home is the {themeFor(homeId).name}. Visiting is just for you; teammates still see you at home.</p>
        <div className="plaza-grid">
          {AVATARS.map((a) => {
            const t = themeFor(a.id);
            const here = a.id === currentId;
            return (
              <button key={a.id} className={`plaza-card ${here ? "is-here" : ""}`} onClick={() => onPick(a.id === homeId ? null : a.id)} style={{ "--a": t.sky[0], "--b": t.sky[1], "--c": t.sky[2], "--acc": t.accent }}>
                <span className="plaza-card__sky">
                  <Avatar avatarId={a.id} size={64} />
                </span>
                <span className="plaza-card__text">
                  <span className="plaza-card__name">{t.name}</span>
                </span>
                {a.id === homeId && <span className="plaza-card__home">Home</span>}
                {here && <span className="plaza-card__here">You're here</span>}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
