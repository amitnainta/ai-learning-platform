import type { Metadata } from "next";
import type { ReactNode } from "react";

// Placeholder root layout — not the real product chrome. Later feature
// work items will replace this with the actual site shell (nav, footer,
// theming, etc.). This exists purely to give the scaffold a renderable
// route tree.
export const metadata: Metadata = {
  title: "AI Learning Platform",
  description: "Scaffolding placeholder for the AI Learning Platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
