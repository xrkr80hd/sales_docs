"use client";

import dynamic from "next/dynamic";

const AddressInformationPrintScreen = dynamic(
  () =>
    import("@/components/documents/address-information-print-screen").then(
      (module) => module.AddressInformationPrintScreen,
    ),
  { ssr: false },
);

export default AddressInformationPrintScreen;
