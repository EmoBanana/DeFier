export const size = 32;
export const contentType = "image/svg+xml";

export default function Icon() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="6" fill="#111827"/>
  <path d="M8 16c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8" stroke="#22D3EE" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M8 16h8v8" stroke="#A78BFA" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;
  return new Response(svg, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}


