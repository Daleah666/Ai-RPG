import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veil Studio — subliminal maker",
  description:
    "Theme-trained visual and audio subliminals: flashing images, YouTube-style methods, Drive connector, and a generation API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
