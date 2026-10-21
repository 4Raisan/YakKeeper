import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YakKeeper — Build together",
  description: "Where projects meet their next contributors. Explore independent projects, share an idea, and help build what comes next.",
  icons: {
    icon: {url: "/brand/favicon.png", type: "image/png", sizes: "32x32"},
    shortcut: "/brand/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
