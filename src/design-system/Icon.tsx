import type { CSSProperties } from "react"

const icons = {
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  back: <><path d="m15 6-6 6 6 6" /></>,
  playback: <><path d="M4 17a8 8 0 1 1 16 0" /><path d="m12 13 3.5-4" /></>,
  quality: <><path d="M10 9.5v5l4.5-2.5z" /><rect x="3" y="5" width="18" height="14" rx="2" /></>,
  password: <><path d="M8 11V8a4 4 0 0 1 8 0v3" /><rect x="5" y="11" width="14" height="9" rx="2" /></>,
  volume: <><path d="M4 10v4h4l5 4V6l-5 4z" /><path d="M16.5 9a4.5 4.5 0 0 1 0 6" /></>,
  scrollbars: <><rect x="8" y="3" width="8" height="18" rx="4" /><rect x="10.5" y="7" width="3" height="6" rx="1.5" /></>,
  modes: <><rect x="3" y="8" width="18" height="8" rx="4" /><circle cx="16" cy="12" r="2" /></>,
  capture: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  save: <><path d="M7 4h10v16l-5-3.5L7 20z" /><path d="m10 8.5 4 4M14 8.5l-4 4" /></>,
  minus: <><path d="M5 12h14" /></>,
  reload: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></>,
  check: <><path d="m5 12 5 5 9-10" strokeWidth="3" /></>,
  open: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  copy: <><path d="M5 15V6a2 2 0 0 1 2-2h8" /><rect x="9" y="9" width="11" height="11" rx="2" /></>,
  delete: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" /></>,
  edit: <><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  area: <><rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" /></>,
  visible: <><path d="M3 9h18" /><rect x="3" y="5" width="18" height="14" rx="2" /></>,
  full: <><path d="M9.5 8h5M9.5 12h5M9.5 16h3" /><rect x="6" y="3" width="12" height="18" rx="2" /></>,
  element: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
  info: <><path d="M12 11v5M12 8h.01" /><circle cx="12" cy="12" r="9" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
}
export type IconName = keyof typeof icons
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>{icons[name]}</svg>
}
