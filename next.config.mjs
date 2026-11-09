/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;
const localSupabase = supabaseHost === '127.0.0.1' || supabaseHost === 'localhost';
const localSupabasePort = localSupabase ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).port : undefined;

const nextConfig = {
  images: {
    ...(localSupabase ? { dangerouslyAllowLocalIP: true } : {}),
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: localSupabase ? 'http' : 'https',
              hostname: supabaseHost,
              ...(localSupabase ? { port: localSupabasePort } : {}),
              pathname: '/storage/v1/object/**',
            },
          ]
        : []),
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (!dev && process.platform === 'win32') {
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;
