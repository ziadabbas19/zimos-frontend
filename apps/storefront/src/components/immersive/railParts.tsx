import dynamic from "next/dynamic";
import { VB_H, VB_W } from "./railGeometry";

/**
 * The clothing rail's shared parts (ClothingRail.tsx, ClothingRailDetail.tsx):
 * the hanger, the photo, and the drawn garments — those from their own chunk
 * (railArt.tsx), fetched only when a piece without a photo is on the rail.
 */
export const Fabric = dynamic(() => import("./railArt").then((m) => m.Fabric));
export const SideArt = dynamic(() => import("./railArt").then((m) => m.SideArt));
export const ArtDefs = dynamic(() => import("./railArt").then((m) => m.ArtDefs));
export const GarmentTop = dynamic(() => import("./railArt").then((m) => m.GarmentTop));
export const DrawnMask = dynamic(() => import("./railArt").then((m) => m.DrawnMask));

/** The hangers' wood and chrome, under the rail's `uid`. */
export function Defs({ uid }: { uid: string }) {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute" focusable="false">
      <defs>
        <linearGradient id={`${uid}-wood`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="color-mix(in oklab, sienna 55%, white)" />
          <stop offset="0.45" stopColor="color-mix(in oklab, sienna 80%, black)" />
          <stop offset="1" stopColor="color-mix(in oklab, sienna 45%, black)" />
        </linearGradient>
        <linearGradient id={`${uid}-woodgrain`} gradientUnits="userSpaceOnUse" spreadMethod="repeat" x1="0" x2="11" y1="0" y2="0.6">
          <stop offset="0" stopColor="black" stopOpacity="0" />
          <stop offset="0.45" stopColor="black" stopOpacity="0.16" />
          <stop offset="0.6" stopColor="white" stopOpacity="0.08" />
          <stop offset="1" stopColor="black" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-chrome`} gradientUnits="userSpaceOnUse" x1="98.5" x2="101.7" y1="0" y2="0">
          <stop offset="0" stopColor="color-mix(in oklab, white 45%, gray)" />
          <stop offset="0.35" stopColor="white" />
          <stop offset="0.78" stopColor="color-mix(in oklab, gray 65%, black)" />
          <stop offset="1" stopColor="color-mix(in oklab, gray 75%, white)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const HOOK = "M100,36 L100,-0.4 C100,-3.4 102.2,-4.2 103.9,-2.8 C104.9,-2 105.4,-1.2 105.6,-0.2";
const HOOK_HI = "M99.5,30 L99.5,-0.2 C99.5,-2.4 101,-3.2 102.4,-2.6";
const BAR = "M38,57 Q70,38 100,36 Q130,38 162,57";
const BAR_HI = "M40,54.5 Q71,35.5 100,33.5 Q129,35.5 160,54.5";

function Hook({ uid }: { uid: string }) {
  return (
    <>
      <path d={HOOK} fill="none" stroke="black" strokeOpacity="0.28" strokeWidth="3.4" strokeLinecap="round" transform="translate(0.9 1.1)" />
      <path d={HOOK} fill="none" stroke={`url(#${uid}-chrome)`} strokeWidth="2.6" strokeLinecap="round" />
      <path d={HOOK_HI} fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.6" strokeLinecap="round" />
      <ellipse cx="105.9" cy="0.6" rx="1.9" ry="0.9" fill="black" fillOpacity="0.4" />
      <rect x="96" y="27" width="8" height="9" rx="2" fill={`url(#${uid}-chrome)`} />
      <rect x="97.2" y="28.2" width="2" height="6.6" rx="1" fill="white" fillOpacity="0.5" />
    </>
  );
}

export function Hanger({ uid, material }: { uid: string; material: "wood" | "matte" | "none" }) {
  const bar = material === "wood" ? `url(#${uid}-wood)` : "currentColor";
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMin meet" className={`absolute inset-0 size-full overflow-visible ${material === "matte" ? "text-ink/85" : ""}`}>
      {material !== "none" && (
        <>
          <path d={BAR} fill="none" stroke="black" strokeOpacity="0.25" strokeWidth="9.5" strokeLinecap="round" transform="translate(0.6 1.6)" />
          <path d={BAR} fill="none" stroke={bar} strokeWidth="8.5" strokeLinecap="round" />
          {material === "wood" && <path d={BAR} fill="none" stroke={`url(#${uid}-woodgrain)`} strokeWidth="8.5" strokeLinecap="round" />}
          <path d={BAR_HI} fill="none" stroke="white" strokeOpacity={material === "wood" ? 0.3 : 0.14} strokeWidth="1.1" strokeLinecap="round" />
          <Hook uid={uid} />
        </>
      )}
    </svg>
  );
}

export function SideHanger({ uid, material }: { uid: string; material: "wood" | "matte" | "none" }) {
  if (material === "none") return null;
  const bar = material === "wood" ? `url(#${uid}-wood)` : "currentColor";
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMin meet" className={`absolute inset-0 size-full overflow-visible ${material === "matte" ? "text-ink/85" : ""}`}>
      <path d="M97.8,35 L102.2,35 L104.5,50 L95.5,50 Z" fill={bar} />
      <path d="M98.6,36 L100,36 L100,49 L97.3,49 Z" fill="white" fillOpacity="0.22" />
      <Hook uid={uid} />
    </svg>
  );
}

export function Photo({ src, alt, full, outline = false }: { src: string; alt: string; full: boolean; outline?: boolean }) {
  // A product photo the merchant uploaded, drawn at the hanger's own size.
  // `outline` draws it all in black — the piece's shadow or shade. Not a CSS
  // mask of the photo: a mask is fetched under CORS, which the media host
  // grants to the dashboard only, so it fails on a store's own domain.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} draggable={false} className={`pointer-events-none absolute inset-x-0 bottom-0 size-auto w-full select-none object-contain object-top ${full ? "top-0 h-full" : "top-[8%] h-[92%]"}`} style={outline ? { filter: "brightness(0)" } : undefined} />;
}
