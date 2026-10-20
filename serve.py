import os
import sys
import webbrowser
from pathlib import Path
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import numpy as np
import scipy.signal as signal

app = FastAPI(title="Webmulink DSP Server", version="1.0.0")

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"

# ================= PYTHON DSP API ENDPOINTS =================
class FIRDesignRequest(BaseModel):
    filter_type: str = "lowpass"  # lowpass, highpass, bandpass, bandstop
    order: int = 32
    cutoff: float = 200.0
    cutoff2: float | None = 800.0
    fs: float = 4000.0
    window: str = "hamming"

@app.post("/api/dsp/fir_design")
def design_fir_endpoint(req: FIRDesignRequest):
    """Calculates FIR filter taps using SciPy."""
    try:
        numtaps = req.order + 1
        if req.filter_type == "lowpass":
            b = signal.firwin(numtaps, req.cutoff, fs=req.fs, window=req.window, pass_zero="lowpass")
        elif req.filter_type == "highpass":
            b = signal.firwin(numtaps, req.cutoff, fs=req.fs, window=req.window, pass_zero="highpass")
        elif req.filter_type == "bandpass":
            f1 = min(req.cutoff, req.cutoff2 or req.cutoff * 2)
            f2 = max(req.cutoff, req.cutoff2 or req.cutoff * 2)
            b = signal.firwin(numtaps, [f1, f2], fs=req.fs, window=req.window, pass_zero="bandpass")
        elif req.filter_type == "bandstop":
            f1 = min(req.cutoff, req.cutoff2 or req.cutoff * 2)
            f2 = max(req.cutoff, req.cutoff2 or req.cutoff * 2)
            b = signal.firwin(numtaps, [f1, f2], fs=req.fs, window=req.window, pass_zero="bandstop")
        else:
            raise ValueError(f"Tipo de filtro no soportado: {req.filter_type}")

        w, h = signal.freqz(b, worN=512, fs=req.fs)
        return {
            "b": b.tolist(),
            "frequencies": w.tolist(),
            "magnitude_db": (20 * np.log10(np.maximum(np.abs(h), 1e-6))).tolist(),
            "phase_deg": (np.angle(h) * 180 / np.pi).tolist(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class IIRDesignRequest(BaseModel):
    filter_type: str = "lowpass"
    order: int = 2
    cutoff: float = 250.0
    fs: float = 4000.0

@app.post("/api/dsp/iir_design")
def design_iir_endpoint(req: IIRDesignRequest):
    """Calculates IIR Butterworth filter taps using SciPy."""
    try:
        b, a = signal.butter(req.order, req.cutoff, btype=req.filter_type, fs=req.fs)
        w, h = signal.freqz(b, a, worN=512, fs=req.fs)
        return {
            "b": b.tolist(),
            "a": a.tolist(),
            "frequencies": w.tolist(),
            "magnitude_db": (20 * np.log10(np.maximum(np.abs(h), 1e-6))).tolist(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ================= STATIC FILES & FRONTEND =================
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")
else:
    @app.get("/")
    def index():
        return {
            "message": "Webmulink server corriendo con uv. Ejecuta 'npm run build' para generar la interfaz compilada.",
            "status": "ready"
        }

def main():
    port = int(os.environ.get("PORT", 8000))
    url = f"http://localhost:{port}"
    print(f"🚀 Iniciando Webmulink con uv en {url} ...")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    uvicorn.run("serve:app", host="0.0.0.0", port=port, reload=False)

if __name__ == "__main__":
    main()
