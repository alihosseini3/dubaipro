import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Silence the benign "Parsing ... failed at 'import(t)'" warning emitted
    // by next-intl 4.x. The dynamic import is only used by its dev-time
    // message extractor and does not affect runtime or production builds.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /node_modules[\\/]next-intl[\\/]/,
        message: /Parsing of .* failed at 'import\(t\)'/
      }
    ];
    return config;
  }
};

export default withNextIntl(nextConfig);
