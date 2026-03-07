import numpy as np
from PIL import Image
import io

# LULC HSL to RGB approximations
# Forest: 142 50% 35% -> (45, 134, 69)
# Water: 205 70% 45% -> (34, 126, 204)
# Agriculture: 95 55% 45% -> (104, 182, 47)
# Barren: 35 40% 55% -> (202, 169, 79)
# Built-up: 0 0% 45% -> (115, 115, 115)

LULC_COLOR_MAP = {
    1: (45, 134, 69),
    2: (34, 126, 204),
    3: (104, 182, 47),
    4: (202, 169, 79),
    5: (115, 115, 115)
}

def create_lulc_image(data):
    """Convert LULC numpy array to color-coded RGBA PNG bytes."""
    h, w = data.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    
    for val, color in LULC_COLOR_MAP.items():
        mask = (data == val)
        rgba[mask, :3] = color
        rgba[mask, 3] = 255 # Opaque
        
    # Set background/nodata (0) to transparent
    rgba[data == 0, 3] = 0
    
    img = Image.fromarray(rgba, 'RGBA')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

def create_change_image(data):
    """Convert Change numpy array to red-themed RGBA PNG bytes."""
    h, w = data.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    
    # Change raster: 1 = Change detected
    # We'll use a semi-transparent red for changes
    mask = (data != 0)
    rgba[mask] = [220, 38, 38, 180] # Red with some transparency
    
    # Unchanged is transparent
    rgba[~mask, 3] = 0
    
    img = Image.fromarray(rgba, 'RGBA')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

def create_confidence_image(data):
    """
    Convert Confidence numpy array to heat-map RGBA PNG bytes.
    Data is expected to be 0-1 or class-id-like. 
    We'll assume 0 is nodata, and 1-5 or 0-100 values.
    """
    h, w = data.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    
    # Handle both 0-1 and 0-100 ranges
    max_val = data.max()
    if max_val > 0:
        if max_val <= 1.05:
            norm_data = data * 100
        else:
            norm_data = data
            
        # Simple colormap: 
        # < 80: Reddish
        # 80-90: Yellowish
        # > 90: Greenish
        
        # Low confidence (< 80)
        mask_low = (norm_data > 0) & (norm_data < 80)
        rgba[mask_low] = [239, 68, 68, 180] # High-alert red
        
        # Med confidence (80-90)
        mask_med = (norm_data >= 80) & (norm_data < 90)
        rgba[mask_med] = [245, 158, 11, 180] # Amber
        
        # High confidence (>= 90)
        mask_high = (norm_data >= 90)
        rgba[mask_high] = [34, 197, 94, 180] # Green
        
        # Background is transparent
        rgba[norm_data == 0, 3] = 0
    
    img = Image.fromarray(rgba, 'RGBA')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def create_hotspot_image(density):
    """Render urban growth hotspot density to RGBA PNG bytes."""
    h, w = density.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)

    high = density >= 0.4
    medium = (density >= 0.2) & (density < 0.4)
    stable = (density > 0) & (density < 0.2)

    rgba[high] = [220, 38, 38, 200]      # red
    rgba[medium] = [245, 158, 11, 180]   # yellow/orange
    rgba[stable] = [34, 197, 94, 150]    # green

    img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def create_risk_image(high_risk_mask, medium_risk_mask):
    """Render risk mask to RGBA PNG bytes."""
    h, w = high_risk_mask.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)

    rgba[medium_risk_mask] = [249, 115, 22, 190]  # orange
    rgba[high_risk_mask] = [220, 38, 38, 220]     # red

    img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
