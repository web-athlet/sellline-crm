/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@sellline/shared-types', '@sellline/ui-components'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
