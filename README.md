# Storybook Image Overlay

Add `'storybook-addon-img-info'` to the `addons` array in `.storybook/main.js` or `.storybook/main.ts` after installing the package. To install from this checkout, run `npm install -D /path/to/storybook-addon-img-info` in your Storybook project.

Click **Images** in the Canvas toolbar to toggle translucent red overlays over the preview's images. The toggle starts off. This add-on targets Storybook 10 and loads the [OddBird CSS Anchor Positioning polyfill](https://github.com/oddbird/css-anchor-positioning) when the browser lacks native support.
