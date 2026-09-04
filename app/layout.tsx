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
  title: { default: "NXTDOCS", template: "%s | NXTDOCS" },
  description: "NXTDOCS consultant profiles and dealership tools.",
  applicationName: "NXTDOCS",
  appleWebApp: {
    capable: true,
    title: "NXTDOCS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/nxtdocs-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/nxtdocs-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
