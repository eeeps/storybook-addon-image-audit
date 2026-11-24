import { defineConfig, type Options } from 'tsup';
import { bundler } from './package.json';

const shared: Options = {
  format: ['esm'],
  // Manager JSX uses createElement from Storybook's own React instance.
  external: ['storybook', 'react', 'react-dom'],
  splitting: true,
  treeshake: true,
};

export default defineConfig([
  { ...shared, entry: bundler.managerEntries, platform: 'browser', target: 'esnext' },
  { ...shared, entry: bundler.previewEntries, platform: 'browser', target: 'esnext', dts: true },
  { ...shared, entry: bundler.nodeEntries, platform: 'node', target: 'node20.19' },
]);
