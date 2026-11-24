import type { Meta, StoryObj } from '@storybook/html-vite';

const meta = { title: 'Image audit' } satisfies Meta;
export default meta;

export const Canvas: StoryObj = {
  render: () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the example image.');

    const sky = context.createLinearGradient(0, 0, 0, 500);
    sky.addColorStop(0, '#4852a7');
    sky.addColorStop(1, '#f2b383');
    context.fillStyle = sky;
    context.fillRect(0, 0, 800, 500);

    context.fillStyle = '#ffe3a7';
    context.beginPath();
    context.arc(610, 140, 52, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#34365e';
    context.beginPath();
    context.moveTo(0, 500);
    context.lineTo(235, 205);
    context.lineTo(382, 396);
    context.lineTo(530, 270);
    context.lineTo(800, 500);
    context.fill();

    const image = new Image();
    image.alt = 'Illustrated mountain landscape';
    image.src = canvas.toDataURL('image/jpeg', 0.85);
    image.style.cssText = 'width: min(400px, 100%); height: auto;';
    return image;
  },
};
