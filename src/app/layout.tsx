import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

const ibmPlexMono = IBM_Plex_Mono({
    weight: ["500", "600"],
    subsets: ["latin"],
    variable: "--font-mono",
});

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
}

export const metadata: Metadata = {
    title: "Growsary — Pricebook & Store Catalog",
    description: "Quick price lookup and customer catalog for store counter & ordering",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} ${ibmPlexMono.variable} antialiased`}>
                {children}
            </body>
        </html>
    );
}
