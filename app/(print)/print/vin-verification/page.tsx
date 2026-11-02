"use client";

import dynamic from "next/dynamic";

const VinVerificationPrintScreen = dynamic(
  () =>
    import("@/components/documents/vin-verification-print-screen").then(
      (module) => module.VinVerificationPrintScreen,
    ),
  { ssr: false },
);

export default VinVerificationPrintScreen;
