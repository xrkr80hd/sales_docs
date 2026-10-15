import type { Metadata } from "next";
import { Barlow, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nextdocs.xrkr80hd.studio"),
  title: { default: "NXTDOX", template: "%s | NXTDOX" },
  description: "NXTDOX consultant profiles and dealership tools.",
  applicationName: "NXTDOX",
  appleWebApp: {
    capable: true,
    title: "NXTDOX",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/nxtdox-app-icon.png", sizes: "1254x1254", type: "image/png" }],
    apple: "/icons/nxtdox-app-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${barlow.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
