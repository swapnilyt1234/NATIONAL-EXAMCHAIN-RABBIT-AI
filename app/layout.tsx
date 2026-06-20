import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans-modern",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-modern",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "National ExamChain Portal",
  description: "Secure blockchain-powered exam distribution and controlled access",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
        <Toaster richColors theme="dark" position="top-right" />
      </body>
    </html>
  );
}
