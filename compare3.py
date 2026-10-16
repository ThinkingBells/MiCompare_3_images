import os
import random

import numpy as np
from aiohttp import web
from PIL import Image

import folder_paths
from server import PromptServer


class Compare3:
    DESCRIPTION = (
        "MiCompare 3 images - wire up to three IMAGE outputs and switch between them "
        "with Show 1 / Show 2 / Show 3. SaveO 1/2/3 save the matching image to the "
        "default ComfyUI output folder. All inputs are optional."
    )

    def __init__(self):
        self.output_dir = folder_paths.get_temp_directory()
        self.type = "temp"
        self.prefix_append = "_cmp3_" + "".join(
            random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5)
        )

    @classmethod
    def INPUT_TYPES(s):
        return {
            "optional": {
                "image1": ("IMAGE", {"tooltip": "First image (optional)."}),
                "image2": ("IMAGE", {"tooltip": "Second image (optional)."}),
                "image3": ("IMAGE", {"tooltip": "Third image (optional)."}),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "compare_images"
    OUTPUT_NODE = True
    CATEGORY = "image/compare"

    def compare_images(self, image1=None, image2=None, image3=None):
        present = [(i, t) for i, t in enumerate((image1, image2, image3), 1) if t is not None]
        results = []
        if present:
            first = present[0][1]
            prefix = "compare3" + self.prefix_append
            folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
                prefix, self.output_dir, first[0].shape[1], first[0].shape[0]
            )
            for slot, tensor in present:
                arr = 255.0 * tensor[0].cpu().numpy()
                img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
                file = f"{filename}_{counter:05}_.png"
                img.save(os.path.join(folder, file), compress_level=4)
                results.append({"filename": file, "subfolder": subfolder,
                                "type": self.type, "slot": slot})
                counter += 1
        return {"ui": {"compare3": results}}


@PromptServer.instance.routes.post("/compare3/save")
async def compare3_save(request):
    """Copy an already-rendered preview image into the default output folder."""
    try:
        data = await request.json()
        filename = os.path.basename(str(data.get("filename", "")))
        subfolder = str(data.get("subfolder", ""))
        itype = str(data.get("type", "temp"))
        slot = int(data.get("slot", 0))
        if itype not in ("temp", "output", "input") or not filename:
            return web.json_response({"error": "bad request"}, status=400)

        base = os.path.realpath(folder_paths.get_directory_by_type(itype))
        src = os.path.realpath(os.path.join(base, subfolder, filename))
        if os.path.commonpath((base, src)) != base or not os.path.isfile(src):
            return web.json_response({"error": "image not found"}, status=404)

        img = Image.open(src)
        out_dir = folder_paths.get_output_directory()
        folder, name, counter, sub, _ = folder_paths.get_save_image_path(
            f"Compare3_img{slot}", out_dir, img.width, img.height
        )
        file = f"{name}_{counter:05}_.png"
        img.save(os.path.join(folder, file), compress_level=4)
        return web.json_response({"filename": file, "subfolder": sub})
    except Exception as e:  # noqa: BLE001
        return web.json_response({"error": str(e)}, status=500)


NODE_CLASS_MAPPINGS = {"Compare3": Compare3}
NODE_DISPLAY_NAME_MAPPINGS = {"Compare3": "MiCompare 3 images"}
