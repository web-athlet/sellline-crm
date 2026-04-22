import preset from '@sellline/config-tailwind/preset';
import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [preset as Config],
  content: ['./src/**/*.{ts,tsx}'],
};

export default config;
