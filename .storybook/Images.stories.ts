import type { Meta, StoryObj } from '@storybook/html-vite';
import './images.css';

const meta = { title: 'Image audit' } satisfies Meta;
export default meta;

export const Canvas: StoryObj = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'image-audit-demo';
    container.innerHTML = `
      <p>Some of these images are well-compressed; some of them are well-sized for the layout; some of them are both; some of them are neither!</p>
      <p>Toggling the "Images" tool overlays each image with ratings badges showing which images are "Good" and which need attention ("Needs improvement" or "Poor"). Click the ratings badges to see more info about the image in the "Image audit" panel.</p>
      <p>Images with subpar "bits/resource pixel" could benefit form being encoded in a more modern format and/or with lower quality settings. Images with subpar "layout density" could benefit from being more-appropriately scaled to fit the layout.</p>
      <p>As the viewport width changes, the ratings and underlying metrics update in real time.</p>
      <div class=grid>
        <img src="https://o.img.rodeo/c_auto,ar_1,w_1920/f_webp,q_auto/m5f4aydycavuektwb5s0" width=1 height=1>
        <img src="https://o.img.rodeo/c_auto,ar_1,w_600/f_jpg,q_90/n8cmergegeildamhuwfj" width=1 height=1>
        <img src="https://o.img.rodeo/c_auto,ar_1,w_512/f_avif,q_auto/iine0qgsbcdpbj43syb2" width=1 height=1>
        <img src="https://o.img.rodeo/c_auto,ar_1,w_250/f_avif,q_auto/kzqh48ljjyxadbsvwfcu" width=1 height=1>
        <img src="https://o.img.rodeo/c_auto,ar_1,w_900/f_jpg,q_auto:best/y4wmbkxlvaxdgsuwscfb" width=1 height=1>
        <img src="https://o.img.rodeo/c_auto,ar_1,w_1000/f_jpg,q_85/urzzywszhlhjpjg76kht" width=1 height=1>
      </div>
    `;
    return container;
  },
};
