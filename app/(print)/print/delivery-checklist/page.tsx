"use client";

import dynamic from "next/dynamic";

const DeliveryChecklistPrintScreen = dynamic(
  () =>
    import("@/components/documents/delivery-checklist-print-screen").then(
      (module) => module.DeliveryChecklistPrintScreen,
    ),
  { ssr: false },
);

export default DeliveryChecklistPrintScreen;
