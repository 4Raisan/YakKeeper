import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YakKeeper — Projects",
  description: "Where projects meet their next contributors. Explore independent projects, share an idea, and help build what comes next.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
