#!/usr/bin/env python3
"""
generate_tags.py

Generate object tags for specific intervals of a video using YOLO for robust detection,
and fallback to LLaVA if needed.

Usage:
    python generate_tags.py --video-path <video_file> \
        [--out-file <output_json>] \
        [--yolo-model <yolo_weights.pt>] \
        [--clip-model <clip_model.gguf>] \
        [--llava-model <llava_model.gguf>]

Requirements:
    pip install ultralytics llama-cpp-python pillow
Ensure you have downloaded the .gguf models via download_models.sh.
"""
import argparse
import json
import base64
import subprocess
import os
from io import BytesIO

from PIL import Image
from ultralytics import YOLO
from llama_cpp import Llama
from llama_cpp.llama_chat_format import Llava16ChatHandler

# Intervals to sample
SAMPLES = [
    ('0:10', '0:20'),
    ('1:15', '1:40'),
]

# Map YOLO classes to canonical labels
YOLO_MAP = {
    'car': 'car', 'truck': 'bus', 'bus': 'bus',
    'person': 'people', 'tank': 'tank'
}

# LLaVA fallback prompt
PROMPT = (
    "You are an assistant that identifies objects in an image. "
    "Allowed labels: car, bus, tank, people. "
    "If multiple objects of the same type appear, list once. "
    "If none, reply nothing. Respond comma-separated labels."
)


def minutes_to_seconds(tstr: str) -> float:
    m, s = map(int, tstr.split(':'))
    return m*60 + s


def extract_frame(path: str, sec: float, size=(800,512)) -> Image.Image:
    cmd = [
        'ffmpeg','-ss',str(sec),'-i',path,
        '-frames:v','1','-vf',f'scale={size[0]}:{size[1]}:flags=lanczos',
        '-f','image2pipe','-vcodec','png','pipe:1'
    ]
    pr = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if pr.returncode or not pr.stdout:
        raise RuntimeError(f"FFmpeg failed at {sec}s")
    return Image.open(BytesIO(pr.stdout))


def to_data_uri(img: Image.Image) -> str:
    buf=BytesIO(); img.save(buf,format='PNG')
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"


def llava_detect(img_uri: str, llm) -> list[str]:
    msgs=[
        {'role':'system','content':PROMPT},
        {'role':'user','content':[{'type':'image_url','image_url':{'url':img_uri}},
                                  {'type':'text','text':'Which labels?'}]}
    ]
    resp = llm.create_chat_completion(messages=msgs, max_tokens=20, temperature=0)
    raw=resp['choices'][0]['message']['content'].strip().lower()
    return [x for x in [lbl.strip().rstrip('.') for lbl in raw.replace(';',',').split(',')] if lbl in YOLO_MAP.values()]


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--video-path',required=True)
    p.add_argument('--out-file',default='tags.json')
    p.add_argument('--yolo-model',default='models/yolov8n.pt')
    p.add_argument('--clip-model',default='models/mmproj-model-f16.gguf')
    p.add_argument('--llava-model',default='models/llava-v1.6-mistral-7b.Q4_K_M.gguf')
    args=p.parse_args()

    # validate
    for fp in (args.video_path, args.clip_model, args.llava_model):
        if not os.path.exists(fp): p.error(f"Missing file: {fp}")
    if not os.path.exists(args.yolo_model):
        p.error(f"YOLO weights not found: {args.yolo_model}")

    # init detectors
    yolo=YOLO(args.yolo_model)
    handler=Llava16ChatHandler(clip_model_path=args.clip_model)
    llm=Llama(model_path=args.llava_model, chat_handler=handler, n_ctx=4096)

    results={}
    for start,end in SAMPLES:
        t0=minutes_to_seconds(start); t1=minutes_to_seconds(end)
        secs=max(1,int(t1-t0))
        for i in range(secs):
            sec=t0+i+0.5
            try: frame=extract_frame(args.video_path,sec)
            except: continue
            # YOLO detection
            yres=yolo.predict(source=frame, save=False, verbose=False)[0]
            labels=set()
            for cls in yres.boxes.cls:
                name=yres.names[int(cls)]
                if name in YOLO_MAP:
                    labels.add(YOLO_MAP[name])
            if not labels:
                uri=to_data_uri(frame)
                try: labels=llava_detect(uri, llm)
                except: labels=[]
            results[f"{int(sec//60):02d}:{int(sec%60):02d}"]=sorted(labels) or ['nothing']
            print(f"{sec:.1f}s -> {results[f'{int(sec//60):02d}:{int(sec%60):02d}']}")

    with open(args.out_file,'w',encoding='utf-8') as f:
        json.dump(results,f,ensure_ascii=False,indent=2)
    print(f"Saved to {args.out_file}")

if __name__=='__main__': main()
