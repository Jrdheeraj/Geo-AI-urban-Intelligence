import os
import rasterio
from glob import glob

def compress_rasters(directory):
    print(f"Compressing rasters in {directory}")
    pattern = os.path.join(directory, "**", "*.tif")
    files = glob(pattern, recursive=True)
    
    for file_path in files:
        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
        if file_size_mb < 5:
            print(f"Skipping {file_path} (already small: {file_size_mb:.2f} MB)")
            continue
            
        print(f"\nCompressing {file_path} (Original: {file_size_mb:.2f} MB)")
        temp_path = file_path + ".temp"
        
        with rasterio.open(file_path) as src:
            profile = src.profile
            profile.update(compress='lzw', tiled=True)
            
            with rasterio.open(temp_path, 'w', **profile) as dst:
                dst.write(src.read())
                
        os.replace(temp_path, file_path)
        new_size_mb = os.path.getsize(file_path) / (1024 * 1024)
        print(f"Done! New size: {new_size_mb:.2f} MB (Reduced by {100 - (new_size_mb/file_size_mb*100):.1f}%)")

if __name__ == "__main__":
    tirupati_dir = os.path.join("data", "gee_outputs", "tirupati")
    compress_rasters(tirupati_dir)
