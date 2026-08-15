import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "ROS2-Docs MCP — Grounded ROS 2 answers",
    description: "Search indexed Humble, Jazzy, and Lyrical documentation from Claude Code or VS Code.",
    openGraph: {
      title: "ROS2-Docs MCP",
      description: "ROS 2 answers, grounded in the docs.",
      images: [`${origin}/og.png`],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "ROS2-Docs MCP",
      description: "ROS 2 answers, grounded in the docs.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
