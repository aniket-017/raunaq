# Raunaq Engineering: animated website

Static site with no build step. Open `index.html` in a browser to preview, or host the whole folder anywhere.

## Publish
Copy this whole folder to the server and run `server.js` (Node 18+, no `npm install` needed). It serves the site on port 1723 (override with `PORT`).

    node server.js                          # http://localhost:1723
    pm2 start server.js --name raunaq-website
    pm2 save && pm2 startup                 # restart on reboot

Enquiry form submissions are appended to `data/enquiries.jsonl`, one JSON object per line (`tail -f data/enquiries.jsonl` to watch). `server.js`, this README and `data/` are never served. The WhatsApp button pre-fills the message for +91 77588 12578.

The form markup is also still compatible with Netlify Forms if you drag this folder onto https://app.netlify.com/drop instead.

## How the scroll film works
- The 11 Veo clips were joined in story order with 0.5 s crossfades, then exported at 15 fps as 592 WebP frames:
  - `assets/frames/d/`: 1920x1080, for desktop
  - `assets/frames/m/`: 960x540, for phones and save-data connections
- `main.js` draws the frame that matches the scroll position onto a canvas. Frames load coarse-to-fine, so scrubbing works before every frame has arrived.
- Chapter text appears over frame ranges set by `data-a` / `data-b` in `index.html`. The stage rail on the right uses `data-f`.

Clip order: walk-in, factory transition, welder (cutting into welding), metal grid structure, aligning on machine, milling, machined block, worker spraying, inspection probe, engineer inspecting, plant with world map.

## Replacing or adding clips
Re-run the ffmpeg merge, export frames, update `N` in `main.js`, then adjust the chapter frame ranges.

## Facts to confirm with the client
- Covered area: 7,600 sq ft or sq m (the old site uses both)
- Lathes "8 ft to 100 ft", and the drilling arm "up to 2 m" (the old site says 2 mm)
- Whether +91 77588 12578 is on WhatsApp
- "50+ years" is counted from 1975
