import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  stories: ['./*.stories.ts'],
  addons: ['storybook-addon-image-audit'],
  framework: '@storybook/html-vite',
};

export default config;
