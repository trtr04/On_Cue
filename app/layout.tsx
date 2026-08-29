import type { Metadata } from "next";
import "./globals.css";

const title = "On Cue｜沟通练习与冲突应对";
const description = "把难开口的话，练成你的底气。通过互动场景练习更清晰、更有边界感的表达。";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
