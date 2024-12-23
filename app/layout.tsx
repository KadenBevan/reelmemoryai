import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reel Memory AI",
  description: "AI-Powered Media Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white">
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
} 