"use client";

import dynamic from "next/dynamic";

const UnifiedInputScreen = dynamic(
  () =>
    import("@/components/workflow/unified-input-screen").then(
      (module) => module.UnifiedInputScreen,
    ),
  { ssr: false },
);

export default function WorkflowPage() {
  return <UnifiedInputScreen dealType="used" />;
}
