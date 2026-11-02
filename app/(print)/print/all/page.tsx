"use client";

import dynamic from "next/dynamic";

const AllPrintScreen = dynamic(
  () =>
    import("@/components/documents/all-print-screen").then(
      (module) => module.AllPrintScreen,
    ),
  { ssr: false },
);

export default AllPrintScreen;
