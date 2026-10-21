import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Pastikan path import ini sesuai dengan lokasi file Anda
import { Providers } from "./Providers"; 
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agri App",
  description: "Aplikasi rantai pasok pertanian",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}