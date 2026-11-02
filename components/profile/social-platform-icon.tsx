import Image from "next/image";

const platformIcons = [
  { match: ["facebook", "fb.com"], name: "Facebook", src: "/social-icons/facebook.png" },
  { match: ["instagram", "instagr.am"], name: "Instagram", src: "/social-icons/instagram.png" },
  { match: ["tiktok"], name: "TikTok", src: "/social-icons/tiktok.png" },
  { match: ["youtube", "youtu.be"], name: "YouTube", src: "/social-icons/youtube.png" },
  { match: ["twitter", "x.com"], name: "X", src: "/social-icons/x.png" },
];

export function SocialPlatformIcon({ platform, size = 40 }: { platform: string; size?: number }) {
  const value = platform.toLowerCase();
  const icon = platformIcons.find((entry) => entry.match.some((token) => value.includes(token)));

  if (!icon) {
    return (
      <span aria-hidden="true" style={{ display: "grid", width: size, height: size, placeItems: "center", borderRadius: "22%", background: "#d71920", color: "white", fontSize: size * 0.52 }}>
        ↗
      </span>
    );
  }

  return <Image src={icon.src} alt={`${icon.name} icon`} width={size} height={size} />;
}
