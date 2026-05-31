import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Amazuga",
  description: "Rwanda property discovery, listings, and valuation workflows.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Amazuga",
    description: "Rwanda property discovery, listings, and valuation workflows.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
    siteName: "Amazuga",
    locale: "en_RW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Amazuga",
    description: "Rwanda property discovery, listings, and valuation workflows.",
    images: ["/opengraph-image.png"],
  },
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
