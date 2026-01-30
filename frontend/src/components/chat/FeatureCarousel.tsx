"use client";

import React, { useState } from 'react';
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { FeatureCarouselProps } from '@/types/chat';

function FeatureCarousel({ isOpen, onClose, onSignup, onLogin, isMobile }: FeatureCarouselProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const features = [
        {
            title: "Smart Course Scheduling",
            description: "Build your perfect class schedule in minutes with intelligent course search and interactive calendar visualization.",
            icon: (
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            gradient: "from-purple-600 to-indigo-600",
            bgGradient: "from-purple-600/10 to-indigo-600/10"
        },
        {
            title: "Course Intelligence",
            description: "Access comprehensive course descriptions, prerequisites, and professor ratings for University of Ottawa courses.",
            icon: (
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            ),
            gradient: "from-violet-600 to-purple-600",
            bgGradient: "from-violet-600/10 to-purple-600/10"
        },
        {
            title: "AI Academic Assistant",
            description: "Get instant answers about courses, prerequisites, professors, and academic planning from your personal AI companion.",
            icon: (
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            ),
            gradient: "from-indigo-600 to-blue-600",
            bgGradient: "from-indigo-600/10 to-blue-600/10"
        }
    ];

    const totalSlides = features.length + 1; // +1 for the CTA slide

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
    };

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    // Touch handlers for mobile swipe
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe) {
            nextSlide();
        } else if (isRightSwipe) {
            prevSlide();
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleOverlayClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
        >
            <motion.div
                className="relative bg-cream dark:bg-gradient-to-b dark:from-[#111111] dark:to-[#0f0f0f] rounded-xl shadow-xl w-full max-w-sm h-[480px] overflow-hidden border border-gray-200 dark:border-white/5"
                initial={{ scale: 0.9, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 50, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Close Button */}
                <button
                    className="absolute top-3 right-3 w-8 h-8 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-lg font-bold focus:outline-none z-20 transition-all duration-200"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Navigation Arrows */}
                <button
                    onClick={prevSlide}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-lg font-bold focus:outline-none z-20 transition-all duration-200"
                    aria-label="Previous slide"
                >
                    ‹
                </button>
                <button
                    onClick={nextSlide}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-lg font-bold focus:outline-none z-20 transition-all duration-200"
                    aria-label="Next slide"
                >
                    ›
                </button>

                {/* Carousel Container */}
                <div className="relative h-full">
                    <div
                        className="flex transition-transform duration-500 ease-in-out h-full"
                        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                    >
                        {features.map((feature, index) => (
                            <div key={index} className="w-full flex-shrink-0 h-full">
                                <div className="h-full flex flex-col justify-center items-center text-center p-6">
                                    {/* Feature Icon */}
                                    <motion.div
                                        className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-6 shadow-lg`}
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                        key={`icon-${currentSlide}`}
                                    >
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {feature.icon.props.children}
                                        </svg>
                                    </motion.div>

                                    {/* Feature Content */}
                                    <motion.div
                                        className="max-w-xs"
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.4, duration: 0.6 }}
                                        key={`content-${currentSlide}`}
                                    >
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                            {feature.title}
                                        </h2>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </motion.div>
                                </div>
                            </div>
                        ))}

                        {/* Final Slide - Call to Action */}
                        <div className="w-full flex-shrink-0 h-full">
                            <div className="h-full flex flex-col justify-center items-center text-center p-6">
                                <motion.div
                                    className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg"
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                    key={`cta-icon-${currentSlide}`}
                                >
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </motion.div>

                                <motion.div
                                    className="max-w-xs"
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4, duration: 0.6 }}
                                    key={`cta-content-${currentSlide}`}
                                >
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                        Want to Save Your Work?
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                                        Create an account to save your schedule and preferences permanently!
                                    </p>

                                    <div className="space-y-3">
                                        <button
                                            onClick={onSignup}
                                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                                        >
                                            Sign Up Free
                                        </button>
                                        <button
                                            onClick={onLogin}
                                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium px-6 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                                        >
                                            Login
                                        </button>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">or</div>
                                        <button
                                            onClick={onClose}
                                            className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium underline underline-offset-2 decoration-gray-400/30 dark:decoration-gray-500/30 hover:text-gray-700 dark:hover:text-gray-200 hover:decoration-gray-500/50 dark:hover:decoration-gray-400/50 transition-colors duration-200"
                                        >
                                            Try Kairo first
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pagination Dots */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
                    {[...features, { title: "Get Started" }].map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${currentSlide === index
                                ? 'bg-black dark:bg-cream scale-110 shadow-lg'
                                : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                                }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
}

export default FeatureCarousel;

