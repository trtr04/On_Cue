import type { Metadata } from "next";
import "./globals.css";

const title = "On Cue｜沟通练习与冲突应对";
const description = "把难开口的话，练成你的底气。通过互动场景练习更清晰、更有边界感的表达。";

export const metadata: Metadata = {
  metadataBase: new URL("https://on-cue-practice.clever-gecko-9185.chatgpt.site"),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    url: "https://on-cue-practice.clever-gecko-9185.chatgpt.site",
    images: [
      {
        url: "/og.png",
        width: 1672,
        height: 941,
        alt: "On Cue — 把难开口的话，练成你的底气",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
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
