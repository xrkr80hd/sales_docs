"use client";

import dynamic from "next/dynamic";

const MyDealsScreen = dynamic(
  () =>
    import("@/components/deals/my-deals-screen").then(
      (module) => module.MyDealsScreen,
    ),
  { ssr: false },
);

export default MyDealsScreen;
