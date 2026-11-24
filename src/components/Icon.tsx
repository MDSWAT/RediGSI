import type { CSSProperties } from "react";

export type IconName = "map" | "people" | "briefcase" | "overlap" | "data" | "upload" | "fit" | "search" | "point" | "line" | "polygon" | "rectangle" | "arrow" | "plus";

const paths: Record<IconName, string> = {
  plus: "M12 5v14M5 12h14",
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  briefcase: "M9 7V4h6v3M3 7h18v14H3V7Zm0 6a25 25 0 0 0 18 0m-9-2v4",
  overlap: "M15 9a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm6 6a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z",
  data: "M20 5c0 1.66-3.58 3-8 3S4 6.66 4 5s3.58-3 8-3 8 1.34 8 3Zm0 0v14c0 1.66-3.58 3-8 3s-8-1.34-8-3V5m0 7c0 1.66 3.58 3 8 3s8-1.34 8-3",
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6",
  fit: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  point: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  line: "m4 19 6-9 10-5M2 17h4v4H2v-4Zm6-9h4v4H8V8Zm10-5h4v4h-4V3Z",
  polygon: "m4 8 9-5 8 9-7 9L3 17 4 8Z",
  rectangle: "M3 5h18v14H3V5Z",
  arrow: "M4 12h16m-6-6 6 6-6 6",
};

export default function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
