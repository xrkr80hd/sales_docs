"use client";

import dynamic from "next/dynamic";

const BuyersGuideReverseScreen = dynamic(
  () =>
    import("@/components/documents/buyers-guide-reverse-screen").then(
      (module) => module.BuyersGuideReverseScreen,
    ),
  { ssr: false },
);

export default BuyersGuideReverseScreen;
