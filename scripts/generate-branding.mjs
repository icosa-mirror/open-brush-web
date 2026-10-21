// Render branding from the supplied Open Brush logo and icon.
// Sources: Logo.svg and icon.png from the project branding folder.
// Copyright the Open Brush contributors / Icosa Foundation, Apache-2.0.
import fs from "node:fs/promises";
import sharp from "sharp";

const logo = await fs.readFile(new URL("../public/branding/open-brush-icon.png", import.meta.url));
const svg = await fs.readFile(new URL("../public/branding/open-brush-logo.svg", import.meta.url));
const root = new URL("../", import.meta.url);
await fs.writeFile(new URL("public/openbrush/intro/wordmark.png", root), await sharp(svg).resize({ width: 1600 }).png().toBuffer());

async function card(path, width, height) {
  const mark = await sharp(svg).resize(Math.round(width * 0.86)).png().toBuffer();
  await fs.writeFile(new URL(path, root), await sharp({
    create: { width, height, channels: 4, background: "#0e0f1c" },
  }).composite([{ input: mark, gravity: "centre" }]).png().toBuffer());
}

await card("docs/banner.png", 2000, 564);
await card("public/og-image.png", 1200, 630);
await card("public/openbrush/intro/thumbnail.png", 512, 512);
for (const size of [32, 192, 512]) {
  const path = size === 32 ? "public/favicon-32x32.png" : `public/icon-${size}x${size}.png`;
  await fs.writeFile(new URL(path, root), await sharp(logo)
    .resize(Math.round(size * 0.78), Math.round(size * 0.78))
    .extend({
      top: Math.floor((size - Math.round(size * 0.78)) / 2),
      bottom: Math.ceil((size - Math.round(size * 0.78)) / 2),
      left: Math.floor((size - Math.round(size * 0.78)) / 2),
      right: Math.ceil((size - Math.round(size * 0.78)) / 2),
      background: "#0e0f1c",
    }).png().toBuffer());
}
