/**
 * Tailwind CSS configuration. The `content` array lists all files that
 * should be scanned for class names. Adjust these globs as your project
 * grows. See https://tailwindcss.com/docs/content-configuration for more
 * details.
 */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};