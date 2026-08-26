import type {
  NextConfig,
} from 'next';


const nextConfig: NextConfig = {
  reactStrictMode:
    true,

  output:
    process.env.VERCEL
      ? undefined
      : 'standalone',
};


export default nextConfig;
