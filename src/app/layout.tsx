import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Public_Sans } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "CareerIO: get your CV graded and matched to jobs that fit",
  description:
    "Upload your CV, see an honest score with clear fixes, and get jobs ranked by how well they actually match you.",
};

export const viewport: Viewport = {
  themeColor: "#F6F1E7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${publicSans.variable} antialiased`}>
      <body className="min-h-dvh">
        <SmoothScroll />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
