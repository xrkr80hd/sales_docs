"use client";

import dynamic from "next/dynamic";

const PayoffFormScreen = dynamic(
  () =>
    import("@/components/documents/payoff-form-screen").then(
      (module) => module.PayoffFormScreen,
    ),
  { ssr: false },
);

export default PayoffFormScreen;
