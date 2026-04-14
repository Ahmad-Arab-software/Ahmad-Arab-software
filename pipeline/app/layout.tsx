import type { Metadata } from "next";
import "./globals.css";
import { PipelineProvider } from "@/lib/PipelineContext";

export const metadata: Metadata = {
  title: "Website Generator",
  description: "Automatisch een professionele website genereren op basis van je bestaande online aanwezigheid.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <PipelineProvider>{children}</PipelineProvider>
      </body>
    </html>
  );
}
