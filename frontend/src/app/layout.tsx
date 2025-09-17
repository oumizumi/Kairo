import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import SeasonalEffects from "@/components/SeasonalEffects";

const inter = Inter({ subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Kairo - Your AI University Assistant",
  description: "A private, AI-powered assistant to help you stay organized and ahead at university.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={jetbrains.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Zen+Dots&family=Orbitron:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('kairo-theme');
                  let theme = savedTheme || 'system';
                  let actualTheme = 'dark';
                  
                  if (theme === 'light') {
                    actualTheme = 'light';
                  } else if (theme === 'dark') {
                    actualTheme = 'dark';
                  } else if (theme === 'system') {
                    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  
                  document.documentElement.classList.add(actualTheme);
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var noop = function(){};
                  var methods = ['log','info','warn','error','debug','trace','group','groupCollapsed','groupEnd','table','time','timeEnd'];
                  for (var i = 0; i < methods.length; i++) {
                    if (typeof console !== 'undefined' && console[methods[i]]) {
                      console[methods[i]] = noop;
                    }
                  }
                } catch (e) { /* ignore */ }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-white dark:bg-[rgb(var(--background-rgb))] text-black dark:text-[rgb(var(--text-primary))] antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <main className="flex min-h-screen flex-col">
              <SeasonalEffects />
              {children}
            </main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
