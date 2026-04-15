import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";
import { cookies } from "next/headers";

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
  const cookieStore = await cookies(); // async in Next 15+ [1](https://nextjs.org/docs/app/api-reference/functions/cookies)
  const theme = cookieStore.get("theme")?.value;

  const safeTheme = theme === "dark" ? "dark" : "light";

  return (
    <html lang="en" data-theme={safeTheme}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}