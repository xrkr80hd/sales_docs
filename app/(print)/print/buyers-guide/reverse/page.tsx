"use client";

import dynamic from "next/dynamic";

const BuyersGuideReversePrintScreen = dynamic(
  () =>
    import("@/components/documents/buyers-guide-reverse-print-screen").then(
      (module) => module.BuyersGuideReversePrintScreen,
    ),
  { ssr: false },
);

export default BuyersGuideReversePrintScreen;
