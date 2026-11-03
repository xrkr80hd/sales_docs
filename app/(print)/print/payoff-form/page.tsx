"use client";

import dynamic from "next/dynamic";

const PayoffFormPrintScreen = dynamic(
  () =>
    import("@/components/documents/payoff-form-print-screen").then(
      (module) => module.PayoffFormPrintScreen,
    ),
  { ssr: false },
);

export default PayoffFormPrintScreen;
