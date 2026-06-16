import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quill — AI Agent Marketplace on Arc",
  description: "Pay per call. No account. No subscription. USDC on Arc blockchain via x402.",
  openGraph: {
    title: "Quill — AI Agent Marketplace",
    description: "The first AI agent marketplace where payment = authentication. Built on Arc + USDC.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceGrotesk.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('quill-theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
      </head>
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }} suppressHydrationWarning>
        <Providers>
          <ThemeProvider>
            <Header />
            <main style={{ flex: 1 }}>{children}</main>
            <Footer />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
