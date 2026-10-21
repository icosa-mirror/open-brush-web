// Render the web branding from Open Brush's upstream logo and SVG typography.
// Source logo: reference/Assets/Resources/DefaultImages/OpenBrushLogo.png
// Copyright the Open Brush contributors / Icosa Foundation, Apache-2.0.
import fs from "node:fs/promises";
import sharp from "sharp";

const logo = await fs.readFile(new URL("../public/branding/open-brush-logo.png", import.meta.url));
const logoUrl = `data:image/png;base64,${logo.toString("base64")}`;
const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="360" viewBox="0 0 1600 360">
  <image href="${logoUrl}" x="10" y="10" width="340" height="340"/>
  <g fill="#ffffff" font-family="Arial, Helvetica, sans-serif">
    <text x="405" y="205" font-size="172" font-weight="700">Open Brush</text>
    <text x="414" y="285" font-size="54" letter-spacing="8">FOR THE WEB</text>
  </g>
</svg>`;
const svg = Buffer.from(wordmark);
const root = new URL("../", import.meta.url);
await fs.writeFile(new URL("public/openbrush/intro/wordmark.png", root), await sharp(svg).png().toBuffer());

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
