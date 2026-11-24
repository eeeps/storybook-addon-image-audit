import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  stories: ['./*.stories.ts'],
  addons: ['storybook-addon-img-info'],
  framework: '@storybook/html-vite',
};

export default config;
