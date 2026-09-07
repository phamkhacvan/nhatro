import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Legaleader · Quản lý nhà trọ",
  description: "Quản lý tiền trọ, phiếu thu và công nợ người thuê",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const themeScript =
    "try{var t=localStorage.getItem('theme');var h=new Date().getHours();var night=h>=18||h<5;if(t==='dark'||(t===null&&night))document.documentElement.classList.add('dark')}catch(e){}";
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
