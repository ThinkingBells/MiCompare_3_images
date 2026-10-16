# MiCompare 3 images

A small ComfyUI custom node to compare **up to three images** inside the node itself.

## Features

- Three optional `IMAGE` inputs: `image1`, `image2`, `image3` (a muted or unconnected branch never raises an error).
- **Show 1 / Show 2 / Show 3** buttons switch the image displayed.
- **Wipe 1-2 / Wipe 1-3 / Wipe 2-3** buttons compare a pair of images: hover the viewer and a bar follows the cursor from left to right, revealing one image or the other.
- **Save 1 / Save 2 / Save 3** buttons save the matching image to ComfyUI's default `output` folder as `Compare3_imgN_00001_.png`.
- The resolution of each image is shown under its Save button.
- The viewer fills the node and scales when you resize it.
- The images and the selected view are remembered when you switch workflow tabs or reload.

The node appears as **MiCompare 3 images** in the `image/compare` category.

## Installation

Clone into your ComfyUI `custom_nodes` folder (the folder name must not contain spaces):

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/thinkingbells/MiCompare_3_images.git
```

Restart ComfyUI and refresh the browser.

## Usage

1. Add **MiCompare 3 images** (double-click the canvas and search "MiCompare").
2. Connect up to three `IMAGE` outputs.
3. Run the workflow, then pick an image with **Show N**, compare two of them with **Wipe A-B**, and save with **Save N**.

## Notes

Only the images are saved (no workflow metadata is embedded). Previews live in ComfyUI's `temp` folder, so they disappear after a restart until the workflow is run again.

## Credits

Inspired by the **Image Compare Pixaroma** node from [ComfyUI-Pixaroma](https://github.com/pixaroma/ComfyUI-Pixaroma) by [pixaroma](https://github.com/pixaroma) (MIT License). This is an independent, simplified reimplementation with three inputs; it does not depend on that package.

## License

MIT
