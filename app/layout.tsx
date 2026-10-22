import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";

export const metadata: Metadata = {
  title: "YakKeeper — Build together",
  description: "Where projects meet their next contributors. Explore independent projects, share an idea, and help build what comes next.",
  icons: {
    icon: [{url: "/brand/yak-mark.svg?v=3",type:"image/svg+xml"},{url: "/brand/favicon.png?v=3", type: "image/png", sizes: "32x32"}],
    shortcut: "/brand/favicon.png?v=3",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`try{var t=localStorage.getItem('yakkeeper-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{document.documentElement.dataset.theme='dark'}`}} /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
