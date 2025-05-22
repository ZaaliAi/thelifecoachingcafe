// next.config.ts
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // output: 'export', // This line is now commented out
  // Your existing config options (like typescript, eslint, images) should remain
  // If they were here before, keep them. If not, this is a typical setup.
  typescript: {
    ignoreBuildErrors: true, // Consider removing this for production if possible
  },
  eslint: {
    ignoreDuringBuilds: true, // Consider removing this for production if possible
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
        hostname: 'firebasestorage.googleapis.com', // If you use Firebase Storage for images
        port: '',
        pathname: '/**',
      }
      // Add other image remote patterns if needed
    ],
  },

  // Any other Next.js configurations you might have
  // experimental: {
  //   serverComponentsExternalPackages: ['firebase-admin'], // Might be useful with app router
  // },
};

export default nextConfig;
