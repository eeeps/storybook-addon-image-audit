# Storybook Image Overlay

Add `'storybook-addon-img-info'` to the `addons` array in `.storybook/main.js` or `.storybook/main.ts` after installing the package. To install from this checkout, run `npm install -D /path/to/storybook-addon-img-info` in your Storybook project.

Click **Images** in the Canvas toolbar to toggle translucent overlays over the preview's images. Click the rating badge at the top right of an image to open its measurements in the **Image audit** panel. The panel shows a fit-to-width preview of the selected image, and a ring marks its rating badge in the Canvas. The toggle starts off. This add-on targets Storybook 10 and loads the [OddBird CSS Anchor Positioning polyfill](https://github.com/oddbird/css-anchor-positioning) when the browser lacks native support.

The panel shows the selected image’s format above the size when identifiable. It prefers the original response’s MIME type, labels formats from a refetch or proxy, and marks filename or data URL guesses as **(URL hint)**.

It also shows the selected resource’s intrinsic dimensions, measured from its URL without `srcset` or `sizes`. The probe may make another image request and can read dimensions without CORS access to the response body. The panel also shows the image’s layout width and height in CSS pixels, including padding and borders, and updates when the image resizes. It also shows the selected image file size in bytes, after removing any HTTP content encoding such as gzip. The add-on first uses Resource Timing. If it has no size for a loaded image, the add-on tries a direct CORS fetch and measures the response body. This can make another download. The label marks that result **(refetch)** because the new request can receive a different image variant. The original image URL stays in use. If all available lookups fail, the label reads **Filesize: Unavailable**.

## Optional size proxy

For Vite-based Storybook development, opt in by listing the exact HTTPS image
hostnames in the add-on options in `.storybook/main.ts` or `.storybook/main.js`:

```js
addons: [
  {
    name: 'storybook-addon-img-info',
    options: { imageSizeProxyHosts: ['images.unsplash.com', 'images.pexels.com'] },
  },
],
```

Restart Storybook after changing the list. If both Resource Timing and direct CORS fetch fail, the add-on can look up the selected URL through the dev server. It reuses the lookup while the toggle is on. The label marks the result as
**(proxy)** because it measures a separate request, which can receive a
different negotiated variant. The displayed image keeps its original URL.
The endpoint accepts only the configured hostnames, rejects redirects, and
limits responses to 25 MiB and requests to five seconds.

## Optional hosted fallback

The add-on has no default hosted service. To connect one later, set
`parameters.imgInfo.hostedSizeEndpoint` to its HTTPS URL in `.storybook/preview.js`
or `.storybook/preview.ts`. The add-on sends a GET with the full selected HTTPS
image URL in the `url` query parameter. The endpoint must allow the preview
origin via CORS and return JSON such as `{ "bytes": 123456 }`. It can also return an optional `contentType` string. This fallback runs
after direct CORS and the local proxy, if configured. A failed request leaves
**Filesize: Unavailable**.

The panel reports density (resource width divided by layout width) alongside the browser’s DPR, plus bits per resource pixel based on the displayed file size. The Canvas overlay and its rating badge use the worse available rating. Images without a rating use a neutral tint and an **Unrated** badge.

**Bits/resource pixel** uses compression ratings for JPEGs identified by
response MIME type. Good is ≤ 1.5, Needs Improvement is > 1.5 through 2.4,
and Poor is > 2.4. Ratings use the unrounded value. The metric’s **?** button
opens an explanation of the calculation and thresholds.

**Density** is Poor below 1× or above 2 × DPR. Good starts at 1× below DPR
1.5 and at 1.5× otherwise, and extends through 1.5 × DPR. The remaining
values are Needs Improvement. The thresholds treat DPR below 1 as 1.
The metric’s **?** button shows the cutoffs for the current preview DPR.
