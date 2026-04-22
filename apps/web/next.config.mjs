/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sellline/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
