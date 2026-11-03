"use client";

import dynamic from "next/dynamic";

const AddressInformationScreen = dynamic(
  () =>
    import("@/components/documents/address-information-screen").then(
      (module) => module.AddressInformationScreen,
    ),
  { ssr: false },
);

export default AddressInformationScreen;
