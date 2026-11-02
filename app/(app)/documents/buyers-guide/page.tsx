"use client";

import dynamic from "next/dynamic";

const BuyersGuideScreen = dynamic(
  () =>
    import("@/components/documents/buyers-guide-screen").then(
      (module) => module.BuyersGuideScreen,
    ),
  { ssr: false },
);

export default BuyersGuideScreen;
