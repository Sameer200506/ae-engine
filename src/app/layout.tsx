import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AEO Engine — answer-engine-optimised AI agents",
    template: "%s · AEO Engine",
  },
  description:
    "Build AI agents that answer from your own knowledge base, embed them anywhere, and charge for access. Streaming chat, RAG, usage limits and Stripe billing out of the box.",
  applicationName: "AEO Engine",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "AEO Engine",
    description:
      "AI agents that answer from your knowledge base — embedded anywhere, metered per plan.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
