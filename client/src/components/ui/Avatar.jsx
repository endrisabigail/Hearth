import { useEffect, useState } from "react";
import { avatarFor } from "../../lib/avatars.js";
import { getThumb, requestThumb } from "../../lib/thumbnails.js";

export default function Avatar({ avatarId, companion = false, size = 40, ring, live, title, className = "" }) {
  const av = avatarFor(avatarId);
  const url = companion ? av.companion : av.model;
  const [src, setSrc] = useState(() => getThumb(url));
  useEffect(() => {
    setSrc(getThumb(url));
    return requestThumb(url, undefined, setSrc);
  }, [url]);
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size, "--ring": ring || "transparent" }} title={title}>
      {src ? <img src={src} alt="" draggable="false" /> : <span className="avatar__emoji" style={{ fontSize: size * 0.5 }}>{av.emoji}</span>}
      {live !== undefined && <span className={`avatar__dot ${live ? "is-live" : ""}`} aria-label={live ? "online" : "away"} />}
    </span>
  );
}
