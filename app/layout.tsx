import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Amazuga",
  description: "Rwanda property discovery, listings, and valuation workflows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="app-root">{children}</div>
      </body>
    </html>
  );
}
