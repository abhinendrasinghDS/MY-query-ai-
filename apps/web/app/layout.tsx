import type { Metadata } from "next";
import "./light-dashboard.css";

export const metadata: Metadata = {
  title: "My Query AI — Reliable Answers from Messy Data",
  description:
    "My Query AI is an AI-powered data analyst that converts natural language questions into safe SQL and delivers verified answers from your data — no SQL required.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
