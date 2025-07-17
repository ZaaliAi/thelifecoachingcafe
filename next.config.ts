// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Add this redirects function to handle the trailing slash issue
  async redirects() {
    return [
      {
        source: '/api/stripe-webhook/',
        destination: '/api/stripe-webhook',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: '/__/auth/action',
      },
    ];
  },
  // This is the corrected configuration key for your version of Next.js.
  // It tells the server how to correctly handle the firebase-admin package.
  serverExternalPackages: ['firebase-admin'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  devIndicators: {
    position: 'bottom-right',
  },
  allowedDevOrigins: ["3000-firebase-studio-1747477108457.cluster-6vyo4g b53jczovun3dxslzjahs.cloudworkstations.dev", "9003-firebase-studio-1747477108457.cluster-6vyo4gb53jczovun3dxslzjahs.cloudworkstations.dev"],
};

export default nextConfig;
