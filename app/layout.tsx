import type { Metadata } from "next";
import "./globals.css";
import "./project.css";
import "./navigation.css";

export const metadata: Metadata = {
  title: "Vaagai · Jaguar Crew",
  description: "Jaguar Crew’s shared Oracle Fusion HCM river simulation: tasks, evidence, reviews and project-aware guidance.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
