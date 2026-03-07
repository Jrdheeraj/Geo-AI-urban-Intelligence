import numpy as np

def confidence_summary(conf_array):
    """
    Confidence statistics from probability map
    """
    return {
        "mean_confidence": round(float(np.nanmean(conf_array)), 3),
        "low_confidence_%": round(float((conf_array < 0.4).mean() * 100), 2),
        "high_confidence_%": round(float((conf_array > 0.7).mean() * 100), 2)
    }
