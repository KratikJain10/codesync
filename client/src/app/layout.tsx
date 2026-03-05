import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/hooks/useTheme";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8b5cf6',
};

export const metadata: Metadata = {
  title: "CodeSync — Real-time Collaborative Code Editor",
  description: "Write, collaborate, and execute code together in real-time. Powered by CRDT technology for seamless multi-user editing with live preview and 8+ language support.",
  keywords: ["code editor", "collaborative", "real-time", "CRDT", "pair programming", "live coding", "code execution"],
  authors: [{ name: "Kratik Jain" }],
  openGraph: {
    title: "CodeSync — Real-time Collaborative Code Editor",
    description: "Write, collaborate, and execute code together in real-time. Multi-cursor editing, live preview, and 8+ language support.",
    type: "website",
    siteName: "CodeSync",
  },
  twitter: {
    card: "summary_large_image",
    title: "CodeSync — Real-time Collaborative Code Editor",
    description: "Write, collaborate, and execute code together in real-time.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
