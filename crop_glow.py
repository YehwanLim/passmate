import os
from PIL import Image

def is_blue_glow(r, g, b):
    # If it's pure black or very dark, it's not glow
    if r < 15 and g < 15 and b < 25:
        return False
    # If blue is significantly higher than red and green, it's blue glow
    if b > r + 15 and b > g + 5:
        return True
    # Or if it's generally bright blue-ish
    if r < 100 and g < 150 and b > 180:
        return True
    return False

def crop_blue_glow(img_path):
    with Image.open(img_path) as img:
        img = img.convert("RGBA")
        width, height = img.size
        pixels = img.load()
        
        # Find left bound
        min_x = 0
        for x in range(width):
            has_content = False
            for y in range(height):
                r, g, b, a = pixels[x, y]
                if a > 0 and not is_blue_glow(r, g, b):
                    has_content = True
                    break
            if has_content:
                min_x = x
                break
                
        # Find right bound
        max_x = width - 1
        for x in range(width - 1, -1, -1):
            has_content = False
            for y in range(height):
                r, g, b, a = pixels[x, y]
                if a > 0 and not is_blue_glow(r, g, b):
                    has_content = True
                    break
            if has_content:
                max_x = x
                break

        # Find top bound
        min_y = 0
        for y in range(height):
            has_content = False
            for x in range(width):
                r, g, b, a = pixels[x, y]
                if a > 0 and not is_blue_glow(r, g, b):
                    has_content = True
                    break
            if has_content:
                min_y = y
                break

        # Find bottom bound
        max_y = height - 1
        for y in range(height - 1, -1, -1):
            has_content = False
            for x in range(width):
                r, g, b, a = pixels[x, y]
                if a > 0 and not is_blue_glow(r, g, b):
                    has_content = True
                    break
            if has_content:
                max_y = y
                break

        # Pad slightly to avoid cutting the actual border if any, but wait, the glow IS the border.
        # Let's crop it tightly
        bbox = (min_x, min_y, max_x+1, max_y+1)
        print(f'{img_path} bbox: {bbox}')
        
        # Save a backup and crop
        backup_path = img_path + '.bak'
        if not os.path.exists(backup_path):
            img.save(backup_path)
            
        cropped = img.crop(bbox)
        cropped.save(img_path)
        print(f'Cropped and saved {img_path}')

files = ['report-step-1.png', 'report-step-2.png', 'report-step-2b.png', 'report-step-3.png', 'report-step-4.png']
for f in files:
    path = os.path.join('client/public', f)
    if os.path.exists(path):
        crop_blue_glow(path)
