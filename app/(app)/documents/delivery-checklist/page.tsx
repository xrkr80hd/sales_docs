"use client";

import dynamic from "next/dynamic";

const DeliveryChecklistScreen = dynamic(
  () =>
    import("@/components/documents/delivery-checklist-screen").then(
      (module) => module.DeliveryChecklistScreen,
    ),
  { ssr: false },
);

export default DeliveryChecklistScreen;
