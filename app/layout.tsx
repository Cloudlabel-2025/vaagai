import type { Metadata } from "next";
import { TabProvider } from "../components/tab-session";
import "./globals.css";
import "./personal-settings.css";
import "./project.css";
import "./navigation.css";
import "./expedition.css";
import "./river-world.css";
import "./departure-camp.css";
import "./mission-briefing.css";
import "./paddle-plan.css";
import "./crew-huddles.css";
import "./crew-community.css";
import "./journey-evidence.css";
import "./currents-rocks.css";
import "./crew-control.css";

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
      <body className="antialiased"><TabProvider>{children}</TabProvider></body>
    </html>
  );
}
