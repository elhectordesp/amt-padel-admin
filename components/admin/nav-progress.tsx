"use client";

import { AppProgressBar } from "next-nprogress-bar";

export function NavProgress() {
  return (
    <AppProgressBar
      height="2px"
      color="#D4AF37"
      options={{ showSpinner: false }}
      shallowRouting
    />
  );
}
