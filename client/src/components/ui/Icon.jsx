const P = {
  board: <><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 2.5h6v3H9z" /><path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chat: <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M19.3 13.8a7.6 7.6 0 0 0 0-3.6l1.9-1.4-2-3.4-2.2.8a7.6 7.6 0 0 0-3.1-1.8L13.5 2h-3l-.4 2.4a7.6 7.6 0 0 0-3.1 1.8l-2.2-.8-2 3.4 1.9 1.4a7.6 7.6 0 0 0 0 3.6l-1.9 1.4 2 3.4 2.2-.8a7.6 7.6 0 0 0 3.1 1.8l.4 2.4h3l.4-2.4a7.6 7.6 0 0 0 3.1-1.8l2.2.8 2-3.4z" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M15 5l-7 7 7 7" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  sparkle: <path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z" />,
  send: <path d="M4 12 20 4l-6 16-2.5-6.5z" />,
  trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  flag: <path d="M5 21V4h11l-2 4 2 4H5" />,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.4.7-2.4 1.8 0 2.6 5 1.3 5 4 0 1.1-1 1.9-2.6 1.9-1.2 0-2.2-.5-2.6-1.3M12 6.5v11" /></>,
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 3-5.6 3.6-9.3 2.4 1.5 3.4 3.7 3.4 5.6 1-.6 1.7-1.7 1.9-3 2.4 2 4.1 4.3 4.1 6.8 0 3.5-2.6 6.1-6.5 6.1z" />,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.4-3.3 2.6-5 5.5-5s5.1 1.7 5.5 5" /><circle cx="17" cy="9.5" r="2.5" /><path d="M16 14.2c2.6-.2 4.3 1.3 4.6 4.3" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  logout: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" /></>,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  mute: <><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
  sound: <><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" /><path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>,
  walk: <><circle cx="13" cy="4.5" r="2" /><path d="m9 21 2.5-6.5L14 17v4M8 11l3-3.5 3 1 2.5 3M11.5 14.5 13 9" /></>,
  badge: <><circle cx="12" cy="9" r="5.5" /><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.3 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.3-3.5-8.5s1-6 3.5-8.5z" /></>,
  wave: <path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V10m0 0V5.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3.5 14.5a1.6 1.6 0 0 1 2.4-2L7 13.5V11" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 3.5V8h4.5M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 20.5V16h-4.5" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c.6-4 3.5-6 7.5-6s6.9 2 7.5 6" /></>,
};

export default function Icon({ name, size = 20, stroke = 2, className = "", ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`icon ${className}`}
      {...rest}
    >
      {P[name]}
    </svg>
  );
}
