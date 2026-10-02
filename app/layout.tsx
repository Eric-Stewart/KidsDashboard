import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Family School", template: "%s · Family School" },
  description: "Your private family school dashboard.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
