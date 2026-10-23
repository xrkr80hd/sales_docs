import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const barlow = localFont({variable:"--font-barlow",display:"swap",src:[
  {path:"../public/fonts/barlow-400.woff2",weight:"400",style:"normal"},
  {path:"../public/fonts/barlow-500.woff2",weight:"500",style:"normal"},
  {path:"../public/fonts/barlow-600.woff2",weight:"600",style:"normal"},
  {path:"../public/fonts/barlow-700.woff2",weight:"700",style:"normal"},
  {path:"../public/fonts/barlow-800.woff2",weight:"800",style:"normal"},
]});
const plexMono = localFont({variable:"--font-plex-mono",display:"swap",src:[
  {path:"../public/fonts/ibm-plex-mono-400.woff2",weight:"400",style:"normal"},
  {path:"../public/fonts/ibm-plex-mono-500.woff2",weight:"500",style:"normal"},
  {path:"../public/fonts/ibm-plex-mono-600.woff2",weight:"600",style:"normal"},
  {path:"../public/fonts/ibm-plex-mono-700.woff2",weight:"700",style:"normal"},
]});

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
