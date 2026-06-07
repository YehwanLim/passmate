import os
from PIL import Image

files = ['report-step-1.png', 'report-step-2.png', 'report-step-2b.png', 'report-step-3.png', 'report-step-4.png']
for f in files:
    path = os.path.join('client/public', f)
    if os.path.exists(path):
        try:
            img = Image.open(path).convert('RGBA')
            w, h = img.size
            # crop 2 pixels from each side
            crop_amount = 2
            cropped = img.crop((crop_amount, crop_amount, w - crop_amount, h - crop_amount))
            cropped.save(path)
            print(f'Cropped {f}')
        except Exception as e:
            print(f'Error cropping {f}: {e}')
