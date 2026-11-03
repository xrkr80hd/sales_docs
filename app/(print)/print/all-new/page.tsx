"use client";

import dynamic from "next/dynamic";

const AllNewPrintScreen = dynamic(
  () =>
    import("@/components/documents/all-new-print-screen").then(
      (module) => module.AllNewPrintScreen,
    ),
  { ssr: false },
);

export default AllNewPrintScreen;
