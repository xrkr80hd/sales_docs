"use client";

import dynamic from "next/dynamic";

const SpaceSheetPrintScreen = dynamic(
  () =>
    import("@/components/documents/space-sheet-print-screen").then(
      (module) => module.SpaceSheetPrintScreen,
    ),
  { ssr: false },
);

export default SpaceSheetPrintScreen;
