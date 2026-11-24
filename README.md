# Storybook Addon: Image Audit

Analyze image compression and layout density within Storybook.

## Installation

```sh
yarn add -D storybook-addon-image-audit
```

```sh
npm install -D storybook-addon-image-audit
```

```sh
pnpm install -D storybook-addon-image-audit
```

In your .storybook/main.ts file, add the following:

```js
// .storybook/main.ts
export default {
  addons: ['storybook-addon-image-audit'],
}
```


## Usage

Click **Images** in the Canvas toolbar to toggle translucent overlays over the preview's images. Green signifies that the image is well-compressed and well-embedded ("Good"); yellow ("Needs improvement") or red ("Poor") indicate that images are sub-optimally encoded or embedded.

Click the labeled rating button at the top right of an image to open its measurements in the **Image audit** panel.

The panel reports the following metrics:

| name                | description                                                       |
|---------------------|-------------------------------------------------------------------|
| Format              | MIME type                                                         |
| Filesize            | …in bytes                                                         |
| Resource dimensions | Dimensions of the embedded asset in pixels                        |
| Layout dimensions   | Layout dimensions of the `<img>` that embeds the asset, in CSS px |
| Layout density      | Resource width ÷ layout width                                     |
| Bits/resource pixel | Filesize in bits ÷ number of resource pixels in the asset         |


These metrics are only relevant for bitmap images, so SVGs are excluded.

### Ratings

Two of the metrics – bits/resource pixel and layout density – are used to evaluate the encoding and embedding efficency of the iamge. They are evaluated using the following ranges:

#### Bits/resource pixel

The embedded resource’s file size in bits divided by its total pixel count (resource width × height). Lower values signify an image has been “more compressed” (risking visual artifacts); higher values signify an image has been “less compressed” (risking overly-large files).

Without evaluating image quality, we can only check for images that have been obviously “under-compressed“, and could likely be significantly smaller with minimal quality loss if they were encoded using modern formats (like AVIF or JPEG-XL) and/or lower quality settings. The qualitative thresholds thresholds are:

| rating | value | 
|--|--|
| Good | x ≤ 1.5 |
| Needs Improvement | 1.5 < x ≤ 2.5 |
| Poor | x > 2.5 |


#### Layout density

The embedded resource’s width in pixels divided by the image’s layout width in CSS pixels. A density below the current window.devicePixelRatio (DPR) means the image is being upscaled, and may look blurry. A density above the current DPR means the image is being downscaled, wasting bytes.

When image width is fluid, layout density will almost never exactly match DPR. The qualitative thresholds are:

(DPR = `window.devicePixelRatio`)

| rating | value (DPR below 1.5) | value (DPR 1.5 or higher) |
|---|---|---|
| Good | 1 ≤ x ≤ 1.5 × DPR | 1.5 ≤ x ≤ 1.5 × DPR |
| Needs Improvement | 1.5 × DPR < x ≤ 2 × DPR | 1 ≤ x < 1.5 or 1.5 × DPR < x ≤ 2 × DPR |
| Poor | x < 1 or x > 2 × DPR | x < 1 or x > 2 × DPR |


## Development

The build follows Storybook’s [Addon Kit](https://github.com/storybookjs/addon-kit) with separate ESM bundles for the manager, preview, and Node preset. The TypeScript source lives in `src/manager` for the panel and toolbar, `src/preview` for Canvas overlays and image measurements, `src/server` for the optional Vite proxy, and `src/shared` for channel messages and rating rules.

```sh
npm ci
npm run typecheck
npm run build
npm run storybook
```

Run `npm run build:watch` alongside Storybook while editing the add-on. `npm run build-storybook` builds the demo as a static site. `npm pack` builds the publishable package and includes the preview’s TypeScript declarations.

## Releasing

[Auto](https://intuit.github.io/auto/) uses pull-request labels to determine version bumps and generate release notes. Before the first release, add the actual GitHub repository URL to the `repository` field in `package.json`, push the project to GitHub, and add a publish-capable npm token as the
repository’s `NPM_TOKEN` secret. Run `npx auto create-labels` once with a GitHub token that can manage
repository labels, then use those labels on pull requests.

Run the **Release** workflow from the default branch in GitHub Actions. It
uses GitHub’s workflow token and runs type checking and the build before
`auto shipit` versions and publishes the package. The workflow is manually
dispatched.
