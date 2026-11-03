"use client";

import dynamic from "next/dynamic";

const CheatSheetScreen = dynamic(
  () =>
    import("@/components/workflow/cheat-sheet-screen").then(
      (module) => module.CheatSheetScreen,
    ),
  { ssr: false },
);

export default CheatSheetScreen;
