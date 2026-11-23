export function dueInfo(date) {
  if (!date) return { label: "No due date", tone: "calm" };
  const d = new Date(date);
  const now = new Date();
  const ms = d - now;
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / 86400000);
  if (ms < 0 && days < 0) return { label: `${-days} ${days === -1 ? "day" : "days"} overdue`, tone: "late" };
  if (days === 0) {
    const h = Math.max(0, Math.round(ms / 3600000));
    return { label: ms < 0 ? "Due earlier today" : h <= 1 ? "Due within the hour" : `Due in ${h} hours`, tone: "soon" };
  }
  if (days === 1) return { label: "Due tomorrow", tone: "soon" };
  if (days < 7) return { label: `Due ${d.toLocaleDateString(undefined, { weekday: "long" })}`, tone: "calm" };
  return { label: `Due ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, tone: "calm" };
}

export function timeAgo(date) {
  const ms = Date.now() - new Date(date).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function toDateInput(date) {
  const d = date ? new Date(date) : new Date(Date.now() + 3 * 86400000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateInput(v) {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 18, 0, 0).toISOString();
}
