import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  serverExternalPackages: [
    'pdf-parse',
    '@napi-rs/canvas',
  ],

  /*
   * Для Docker нам нужен standalone.
   *
   * На Vercel standalone не нужен,
   * поэтому при сборке на Vercel output не задаём.
   */
  output: process.env.VERCEL
    ? undefined
    : 'standalone',
};

export default nextConfig;