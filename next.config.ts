import type { NextConfig } from 'next';

const imageRemotePatterns: NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> = [
  {
    protocol: 'https',
    hostname: '**.supabase.co',
    pathname: '/storage/v1/object/public/**',
  },
];

if (process.env.SUPABASE_URL) {
  try {
    const parsed = new URL(
      process.env.SUPABASE_URL.startsWith('http')
        ? process.env.SUPABASE_URL
        : `https://${process.env.SUPABASE_URL}`,
    );
    imageRemotePatterns.push({
      protocol: (parsed.protocol.replace(':', '') as 'http' | 'https') || 'https',
      hostname: parsed.hostname,
      pathname: '/storage/v1/object/public/**',
    });
  } catch {
    // Invalid SUPABASE_URL
  }
}

const nextConfig: NextConfig = {
  trailingSlash: false,
  staticPageGenerationTimeout: 120,
  experimental: {
    proxyClientMaxBodySize: '500mb',
  },
  images: {
    remotePatterns: imageRemotePatterns,
  },

  outputFileTracingIncludes: {
    '**/*': [
      './node_modules/pg-cloudflare/dist/**',
      './node_modules/pg-cloudflare/esm/**',
    ],
  },

  serverExternalPackages: [
    'oracledb',
    'mysql',
    'mysql2',
    'sqlite3',
    'better-sqlite3',
    'tedious',
    'pg-query-stream',
  ],

  turbopack: {
    resolveAlias: {
      'oracledb': './lib/stubs/db-driver-stub.ts',
      'mysql': './lib/stubs/db-driver-stub.ts',
      'mysql2': './lib/stubs/db-driver-stub.ts',
      'sqlite3': './lib/stubs/db-driver-stub.ts',
      'better-sqlite3': './lib/stubs/db-driver-stub.ts',
      'tedious': './lib/stubs/db-driver-stub.ts',
      'pg-query-stream': './lib/stubs/db-driver-stub.ts',
      'sharp': './lib/stubs/sharp-stub.ts',
    },
  },

  async redirects() {
    return [
      { source: '/editor', destination: '/projects', permanent: false },
      { source: '/editor/:path*', destination: '/ycode/:path*', permanent: false },
    ];
  },

  async rewrites() {
    return [];
  },

  async headers() {
    return [
      {
        source: '/a/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path((?!ycode|projects|_next|a/).*)*',
        headers: [
          {
            key: 'Link',
            value: '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
          },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'oracledb': 'commonjs oracledb',
        'mysql': 'commonjs mysql',
        'mysql2': 'commonjs mysql2',
        'sqlite3': 'commonjs sqlite3',
        'better-sqlite3': 'commonjs better-sqlite3',
        'tedious': 'commonjs tedious',
        'pg-query-stream': 'commonjs pg-query-stream',
      });
    }

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/knex\/lib\/migrations\/util\/import-file\.js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  },
};

export default nextConfig;
