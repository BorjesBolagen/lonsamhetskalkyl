import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";
import { cookies } from "next/headers";

// LAYOUT FÖR ALLA SIDOR

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lönsamhetskalkyl",
  description: "Trafikledningssystem för lönsamhetsanalys av leveranser",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies(); 
  const theme = cookieStore.get("theme")?.value;

  const safeTheme = theme === "dark" ? "dark" : "light";

  return (
    <html lang="en" data-theme={safeTheme}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ margin: 0, padding: 0 }}
      >
        {children}
      </body>
    </html>
  );
}