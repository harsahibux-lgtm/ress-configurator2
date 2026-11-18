# Configurator

Interactive 3D configurator built with Three.js. No build step, no npm install.
It uses your own model, `models/plant.glb`, which was split into three movable units from the original single-mesh file.

## What people can do
- Add or remove Tower, Vessel and Condenser units (up to 5 of each, at least 1 in total)
- Rearrange the order of units by drag and drop, or with the arrow buttons
- Change the color of each unit type separately (or keep the original look), plus a matte, satin or gloss finish
- See live length, width and height in metres and feet
- Export a 3000 px PNG (white background with a summary, or transparent)
- The page only redraws when something changes, so it uses no CPU or GPU when idle

## Put it online (GitHub Pages)
1. Upload everything in this folder to the root of a GitHub repository, including the `models` folder.
2. Settings, then Pages: deploy from branch `main`, folder `/ (root)`.
3. Your site will be at `https://YOUR-USER.github.io/YOUR-REPO/`.

## Add it to Framer
Insert an **Embed** component, choose **URL**, paste the GitHub Pages address, and give it a height of at least 700 px.

## Settings (config.js)
- `M_PER_UNIT`: the model has no real-world size. 1 model unit is set to 0.05 m, which makes the tallest unit about 10.9 m. Change it to match the real size.
- `GAP`: space between units. `MAX_PER_TYPE`: limit per unit type.
- `UNITS`: names shown to visitors. Rename them freely.

## Model credit
The original model, "old oil tank .2" by Kwon_Hyuk (https://sketchfab.com/Kwon_Hyuk), is licensed CC-BY-4.0. If you publish this, credit the author on your site.
