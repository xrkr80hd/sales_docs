"use client";

import dynamic from "next/dynamic";

const SpaceSheetScreen = dynamic(
  () =>
    import("@/components/documents/space-sheet-screen").then(
      (module) => module.SpaceSheetScreen,
    ),
  { ssr: false },
);

export default function SpacedPage() {
  return <SpaceSheetScreen />;
}
