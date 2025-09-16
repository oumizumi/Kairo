"use client";

import Link from 'next/link';
import Navbar, { TopNavigation } from '@/components/Navbar';
import Features from '@/components/Features';
import Footer from '@/components/Footer';
import TypewriterHeading from '@/components/TypewriterHeading';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { APP_CONFIG } from '@/config/app.config';
import { MessageSquare, User } from 'lucide-react';

export default function Home() {
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();

  const phrases = ["Made by students", "For students"];

  // Switching text animation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhrase((prev) => (prev + 1) % phrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [phrases.length]);



  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.error("NEXT_PUBLIC_API_URL is not defined. Cannot test backend connection.");
      return;
    }

    const healthCheckUrl = apiUrl.endsWith('/') ? apiUrl + 'api/health-check/' : apiUrl + '/api/health-check/';

    fetch(healthCheckUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("Backend health-check successful:", data);
      })
      .catch(error => {
        console.error("Backend health-check failed:", error);
      });
  }, []); // Empty dependency array ensures this runs only once on mount



  return (
    <main className="font-mono min-h-screen flex flex-col bg-white dark:bg-[rgb(var(--background-rgb))] text-black dark:text-[rgb(var(--text-primary))] transition-colors duration-300">
      <TopNavigation />
      <Navbar />

      {/* Hero Section - Light Mode Clean, Dark Mode Refined */}
      <section className="flex-1 flex items-center py-16 sm:py-24 bg-white dark:refined-dark-grid square-grid-bg-light relative overflow-hidden min-h-[80vh]">
        {/* Light Mode: Original clean gradient effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-transparent to-purple-50/60 dark:from-transparent dark:via-transparent dark:to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent dark:from-transparent"></div>

        {/* Dark Mode: Subtle ambient center glow */}
        <div className="absolute inset-0 flex items-center justify-center">
           <div className="w-[700px] h-[700px] bg-gradient-radial from-blue-200/10 via-purple-200/5 to-transparent dark:from-white/6 dark:via-white/[0.03] dark:to-transparent rounded-full blur-2xl"></div>
        </div>

        {/* Dark Mode: Very subtle corner glows */}
        <div className="absolute inset-0 hidden dark:block">
          <div className="absolute top-1/4 left-1/4 w-[320px] h-[320px] bg-gradient-radial from-white/6 to-transparent rounded-full blur-2xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[240px] h-[240px] bg-gradient-radial from-white/4 to-transparent rounded-full blur-2xl"></div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <TypewriterHeading text="Meet Kairo." />

          {/* Animated Switching Text */}
          <div className="mt-3 h-8 sm:h-9 md:h-10 flex items-center justify-center relative">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentPhrase}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{
                  duration: 0.6,
                  ease: [0.4, 0, 0.2, 1],
                  opacity: { duration: 0.3 }
                }}
               className="font-mono text-slate-600 dark:text-[rgb(var(--text-secondary))] text-base sm:text-lg md:text-xl font-medium absolute"
              >
                {phrases[currentPhrase]}
              </motion.span>
            </AnimatePresence>
          </div>

          <p className="font-mono text-gray-700 dark:text-[rgb(var(--text-primary))] text-base sm:text-lg text-center mt-4 px-2 font-medium">
            The AI-powered platform transforming university productivity and academic success.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-6 text-sm">
            <span className="font-mono px-3 py-1 bg-blue-100 dark:bg-blue-600/15 dark:border dark:border-blue-500/30 text-blue-800 dark:text-blue-200 rounded-full font-medium">Smart Scheduling</span>
            <span className="font-mono px-3 py-1 bg-purple-100 dark:bg-purple-600/15 dark:border dark:border-purple-500/30 text-purple-800 dark:text-purple-200 rounded-full font-medium">AI Assistant</span>
            <span className="font-mono px-3 py-1 bg-green-100 dark:bg-green-600/15 dark:border dark:border-green-500/30 text-green-800 dark:text-green-200 rounded-full font-medium">Course Intelligence</span>
            <span className="font-mono px-3 py-1 bg-orange-100 dark:bg-orange-600/15 dark:border dark:border-orange-500/30 text-orange-800 dark:text-orange-200 rounded-full font-medium">Smart Mail</span>
          </div>
          
          {/* Get Started Button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => {
                setIsNavigating(true);
                // Navigate immediately for fast response
                router.push('/chat/?view=split');
                
                // Initialize guest session in background (non-blocking)
                setTimeout(async () => {
                  try {
                    const { guestLogin } = await import('@/lib/api');
                    await guestLogin();
                  } catch (err) {
                    console.warn('Background guest login failed:', err);
                    // User can still use the app, guest login will happen later if needed
                  }
                }, 100);
              }}
              disabled={isNavigating}
              className={`font-mono font-semibold py-3 px-8 rounded-lg shadow-lg transform transition-all duration-200 text-lg ${
                isNavigating 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white hover:shadow-xl hover:-translate-y-0.5'
              }`}
            >
              {isNavigating ? 'Loading...' : 'Get Started'}
            </button>
          </div>
          
          {/* Guest Mode Info */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
              Try Kairo for free - no signup required
            </p>
          </div>
        </div>
      </section>

      <Features />

      <Footer />
      

    </main>
  );
}