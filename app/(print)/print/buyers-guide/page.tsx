"use client";

import dynamic from "next/dynamic";

const BuyersGuidePrintScreen = dynamic(
  () =>
    import("@/components/documents/buyers-guide-print-screen").then(
      (module) => module.BuyersGuidePrintScreen,
    ),
  { ssr: false },
);

export default BuyersGuidePrintScreen;
