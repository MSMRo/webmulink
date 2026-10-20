# Webmulink 🎛️⚡
### Clon Web de MATLAB Simulink para Procesamiento Digital de Señales (DSP) y Señales y Sistemas con soporte para `uv`

**Webmulink** es una plataforma web interactiva inspirada fielmente en la interfaz clásica de **MATLAB Simulink**. Se ejecuta tanto de forma estática en **GitHub Pages** como localmente con el gestor de paquetes ultrarrápido **`uv` de Python**.

---

## 📸 Interfaz Fiel a MATLAB Simulink

Webmulink replica con exactitud los elementos clásicos de Simulink:
1. **Simulink Library Browser (Explorador de Librerías):**
   - Ventana clásica con árbol de categorías a la izquierda: `Simulink/Commonly Used Blocks`, `Continuous`, `Discrete`, `Math Operations`, `Sources`, `Sinks`, `DSP System Toolbox` y `Mixed-Signal Toolbox`.
   - Cuadrícula de bloques con los glifos matemáticos vectoriales exactos de Simulink (`1/s`, triángulo de ganancia `K`, círculo sumador `+ -`, `1`, `z⁻¹`, `Scope` CRT monitor, `×`, etc.).
   - Arrastra directamente cualquier bloque al lienzo o haz doble clic para insertarlo.
2. **Lienzo de Simulación (Model Window):**
   - Lienzo blanco puro con cuadrícula sutil.
   - Bloques blancos con borde negro sólido y **nombres de bloque ubicados debajo del bloque** (ej: `Set Point`, `Fahrenheit to Celsius`, `Heater Blower`, `Scope`).
   - **Cables ortogonales estrictos (Manhattan 90°)** con flechas negras direccionales en las entradas de los puertos y puntos de unión rellenos en las bifurcaciones de señal.
   - Barra de menú superior (`File`, `Edit`, `View`, `Simulation`, `Format`, `Tools`, `Help`).
   - Barra de herramientas con iconos clásicos: Iniciar (Play verde), Detener, Selector de modo `Normal`, tiempo de parada y botón del Library Browser.
   - Barra de estado inferior: `Ready | 100% | ode45 / Dormand-Prince`.

---

## ⚡ Cómo Trabajar con `uv` (Python)

El proyecto está 100% configurado para trabajar con **`uv`** (con entorno virtual, dependencias de NumPy, SciPy, FastAPI y Uvicorn).

### 1. Iniciar la aplicación con `uv`
Ejecuta en tu terminal:

```powershell
uv run python serve.py
```
o bien:
```powershell
uv run serve
```

Esto hará lo siguiente:
- Servirá automáticamente la interfaz web de Webmulink en `http://localhost:8000`.
- Abrirá tu navegador automáticamente.
- Habilitará la API de procesamiento digital de señales con **NumPy** y **SciPy** (`/api/dsp/fir_design`, `/api/dsp/iir_design`).

### 2. Sincronizar o instalar nuevas librerías con `uv`
```powershell
uv sync
```

---

## 🌐 Publicación Gratuita en GitHub Pages

Webmulink compila en una aplicación web 100% estática en el directorio `dist/` con rutas relativas (`./`), lo que permite que funcione en GitHub Pages sin necesidad de servidores externos:

```powershell
# Compilar la versión web estática
npm run build
```

### Despliegue con GitHub Actions:
El repositorio ya incluye el archivo [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
1. Sube tu código a un repositorio en GitHub:
   ```bash
   git add .
   git commit -m "Update Webmulink with uv and classic Simulink interface"
   git push -u origin main
   ```
2. En GitHub, ve a **Settings** → **Pages** → en **Build and deployment / Source**, elige **GitHub Actions**.
3. ¡Tu clon de Simulink estará disponible en `https://TU_USUARIO.github.io/webmulink/`!

---

## 🧮 Bloques y Capacidades DSP

* **Filtros FIR:** Entrada directa de coeficientes $b$ o diseñador con ventanas Hamming, Hann, Blackman con vista de espectro $|H(e^{j\omega})|$ en dB.
* **Filtros IIR:** Forma Directa II Transpuesta con coeficientes $b, a$ o diseño Biquad/Butterworth.
* **Conversión A/D y D/A:**
  - **ZOH (Retenedor de Orden Cero):** Demuestra aliasing y escalonamiento temporal.
  - **ADC (Cuantizador):** De 1 a 24 bits, modos *Mid-Tread* y *Mid-Riser*, salida de error de cuantización $e[n]$ y cálculo de SQNR ($6.02N + 1.76$ dB).
  - **DAC:** Reconstrucción suave anti-imaging o escalonada.
* **Sistemas Continuos $H(s)$:** Discretizados automáticamente mediante la **Transformada Bilineal (Tustin)** evaluada a la frecuencia $F_s$.
* **Señales de Audio .WAV:** Carga archivos de audio reales con Web Audio API, procésalos mediante filtros y escúchalos en vivo por los altavoces.
