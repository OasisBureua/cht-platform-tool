import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
 title: "CHM · Medicine moves through shared knowledge",
 description:
 "Peer-led video, podcasts and editorial for oncology, organised by disease state and by format.",
};

const THEME_INIT = "try{var t=localStorage.getItem('chm-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
 return (
 <html
      lang="en"
      className={`${geistSans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Stamps the appearance before first paint, so the page never
            flashes the wrong theme. It must run here, not in an effect. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full bg-ground">
 {/* The search dialog portals outside this element and marks it
 inert, so the background is unreachable while it is open. */}
 <div id="app-root" className="flex min-h-full flex-col">
 <SiteHeader />
 <main id="main" tabIndex={-1} className="flex-1 scroll-mt-28 outline-none">
 {children}
 </main>
 <SiteFooter />
 </div>
 </body>
 </html>
 );
}
