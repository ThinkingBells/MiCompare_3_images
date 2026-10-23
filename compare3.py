# Inspired by "Image Compare Pixaroma" from https://github.com/pixaroma/ComfyUI-Pixaroma (MIT).
import json
import os
from datetime import datetime

import numpy as np
from aiohttp import web
from PIL import Image
from PIL.PngImagePlugin import PngInfo

import folder_paths
from comfy.cli_args import args
from server import PromptServer


def unique_name(directory, stamp, slot):
    """MM-dd-HH-mm-ss-imageN.png, with _2, _3... if that name is already taken."""
    file = f"{stamp}-image{slot}.png"
    n = 1
    while os.path.exists(os.path.join(directory, file)):
        n += 1
        file = f"{stamp}-image{slot}_{n}.png"
    return file


class Compare3:
    DESCRIPTION = (
        "MiCompare 3 images - wire up to three IMAGE outputs and switch between them "
        "with Show 1 / Show 2 / Show 3. SaveO 1/2/3 save the matching image to the "
        "default ComfyUI output folder. All inputs are optional."
    )

    def __init__(self):
        self.output_dir = folder_paths.get_temp_directory()
        self.type = "temp"

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
    CATEGORY = "MI nodes"

    def compare_images(self, image1=None, image2=None, image3=None):
        present = [(i, t) for i, t in enumerate((image1, image2, image3), 1) if t is not None]
        results = []
        stamp = datetime.now().strftime("%m-%d-%H-%M-%S")
        for slot, tensor in present:
            arr = 255.0 * tensor[0].cpu().numpy()
            img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
            file = unique_name(self.output_dir, stamp, slot)
            img.save(os.path.join(self.output_dir, file), compress_level=4)
            results.append({"filename": file, "subfolder": "",
                            "type": self.type, "slot": slot})
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
        file = unique_name(out_dir, datetime.now().strftime("%m-%d-%H-%M-%S"), slot)
        pnginfo = None
        if not getattr(args, "disable_metadata", False):
            workflow, prompt = data.get("workflow"), data.get("prompt")
            if workflow is not None or prompt is not None:
                pnginfo = PngInfo()
                if prompt is not None:
                    pnginfo.add_text("prompt", json.dumps(prompt))
                if workflow is not None:
                    pnginfo.add_text("workflow", json.dumps(workflow))
        img.save(os.path.join(out_dir, file), pnginfo=pnginfo, compress_level=4)
        return web.json_response({"filename": file, "subfolder": ""})
    except Exception as e:  # noqa: BLE001
        return web.json_response({"error": str(e)}, status=500)


NODE_CLASS_MAPPINGS = {"Compare3": Compare3}
NODE_DISPLAY_NAME_MAPPINGS = {"Compare3": "MI Compare 3 Images"}
