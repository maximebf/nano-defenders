// App icons for the home screen, made from Pixel's picture.
import sharp from 'sharp';
const OUT = new URL('../public/assets/icons/', import.meta.url).pathname;
const bg = (size) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffd6e0"/><stop offset=".6" stop-color="#f08aa5"/><stop offset="1" stop-color="#c4577f"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
for (const [name, size, pad] of [['icon-192.png', 192, 0.14], ['icon-512.png', 512, 0.14], ['apple-touch-icon.png', 180, 0.1], ['maskable-512.png', 512, 0.24]]) {
  const inner = Math.round(size * (1 - pad * 2));
  const pixel = await sharp(new URL('../public/assets/img/pixel.png', import.meta.url).pathname).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp(bg(size)).composite([{ input: pixel, gravity: 'center' }]).png().toFile(OUT + name);
  console.log(name);
}
