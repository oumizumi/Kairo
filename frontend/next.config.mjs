/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // output: 'export', // Temporarily disabled for dynamic routes
    trailingSlash: true,
    // Enable CSS optimization
    transpilePackages: ['@fullcalendar'],
    images: {
        unoptimized: true, // Required for static export
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    },
    compiler: {
        removeConsole: true,
    },
}

export default nextConfig; 