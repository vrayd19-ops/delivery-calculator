import type {
  NextConfig,
} from 'next';


const nextConfig: NextConfig = {
  reactStrictMode:
    true,

  /*
   * Для Docker нам нужен standalone.
   *
   * На Vercel standalone не нужен,
   * и в Next.js 16.3.0 он сейчас
   * конфликтует с Vercel build adapter.
   */
  output:
    process.env.VERCEL
      ? undefined
      : 'standalone',
};


export default nextConfig;
