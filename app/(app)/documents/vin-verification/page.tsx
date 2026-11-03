"use client";

import dynamic from "next/dynamic";

const VinVerificationScreen = dynamic(
  () =>
    import("@/components/documents/vin-verification-screen").then(
      (module) => module.VinVerificationScreen,
    ),
  { ssr: false },
);

export default VinVerificationScreen;
