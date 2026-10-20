# Webmulink 🎛️⚡
### Clon Web de Simulink enfocado en Procesamiento Digital de Señales (DSP) y Señales y Sistemas

**Webmulink** es una plataforma web interactiva inspirada en MATLAB/Simulink que corre **100% en el navegador**, diseñada específicamente para la simulación y análisis gráfico de señales y sistemas en tiempo discreto y continuo.

---

## ✨ Características Principales

### 1. Diagramas de Bloques Gráficos Interactivos
- **Lienzo Infinito:** Zoom con la rueda del ratón, paneo fluido y cuadrícula estilo Simulink.
- **Conexiones Inteligentes:** Arrastra desde puertos de salida (azules) a puertos de entrada (verdes) con curvas de Bézier dinámicas y detección de bucles.
- **Gestión de Modelos:** Guardar y Cargar diagramas en formato `.json`, centrar vista y limpiar lienzo.

### 2. Biblioteca de Bloques DSP y Señales y Sistemas
- **Fuentes de Señal:**
  - `Generador Senoidal`: Amplitud, frecuencia, fase y offset DC.
  - `Onda Cuadrada`: Frecuencia y ciclo de trabajo (duty cycle).
  - `Onda Triangular y Diente de Sierra`.
  - `Ruido Blanco`: Distribución normal Gaussiana (Box-Muller) o uniforme.
  - `Escalón Unitario u(t)` e `Impulso δ(t)`.
  - `Constante (K)`.
  - **`Fuente Archivo WAV`**: Permite subir cualquier archivo `.wav` o `.mp3` real desde el disco, decodificarlo con Web Audio API y procesarlo en la simulación con opción de reproducción original.
- **Operaciones Matemáticas:**
  - `Ganancia K`.
  - `Sumador / Restador`: Con configuración de signos dinámicos (`++`, `+-`, `+++`).
  - `Multiplicador (Producto)`: Ideal para modulación AM, mezcladores y modulación por anillo.
  - `Función Matemática`: Valor absoluto $|u|$, $\exp$, $\ln$, $\sqrt{u}$, cuadrado, $\sin$, $\cos$.
  - `Derivada temporal`: $\frac{du}{dt}$.
  - `Integrador`: $\int u(t)\,dt + y_0$ con condición inicial.
- **Filtros y Sistemas LTI:**
  - **`Filtro FIR`**:
    - **Modo Coeficientes Manuales:** Introduce directamente el vector $b = [b_0, b_1, \dots, b_m]$.
    - **Modo Diseñador Automático:** Diseño por método de Ventana (Hamming, Hann, Blackman, Rectangular) para filtros Pasa-Bajos, Pasa-Altos, Pasa-Banda o Rechaza-Banda con previsualización en vivo de la respuesta en frecuencia $|H(e^{j\omega})|$ (dB).
  - **`Filtro IIR`**:
    - Forma Directa II Transpuesta con coeficientes $b$ y $a$ directos.
    - Diseñador Biquad / Butterworth con frecuencia de corte $f_c$ y factor de calidad $Q$.
  - **`Función de Transferencia Discreta H(z)`**: Numerador $B(z)$ y denominador $A(z)$.
  - **`Retardo Unitario (z⁻¹ / z⁻ᵏ)`**: Retardo de $k$ muestras con valor inicial.
  - **`Media Móvil (Moving Average)`**: Filtro suavizador de $N$ puntos.
  - **`Función de Transferencia Continua H(s)`**: Convierte automáticamente polinomios continuos $H(s) = \frac{B(s)}{A(s)}$ a tiempo discreto mediante la **Transformada Bilineal (Tustin)**.
- **Conversión A/D y D/A (Señales Mixtas):**
  - **`Retenedor de Orden Cero (ZOH)`**: Muestreo y retención a tasa $F_{hold}$ configurable para observar efectos de cuantización temporal, armónicos en escalera y **aliasing** cuando $F_{hold} < 2 f_{in}$.
  - **`Convertidor A/D (ADC & Cuantizador)`**:
    - Resolución configurable de 1 a 24 bits.
    - Rango de voltaje $\pm V_{ref}$ y modos *Mid-Tread*, *Mid-Riser* y *Truncamiento*.
    - Salidas simultáneas de señal digitalizada $D_{out}$ y **señal de error de cuantización $e[n]$**, con cálculo de paso $\Delta$ y relación SQNR ($6.02N + 1.76$ dB).
  - **`Convertidor D/A (DAC)`**: Reconstrucción mediante escalón ZOH, interpolación lineal FOH o filtro analógico pasa-bajos anti-imaging.
- **Instrumentación y Salidas (Sinks):**
  - **`Osciloscopio (Dominio del Tiempo)`**:
    - Hasta 4 canales simultáneos con colores estándar (Amarillo, Cian, Magenta, Verde).
    - Zoom temporal, desplazamiento (pan), activación/desactivación de canales y retícula calibrada.
    - Tabla de mediciones automáticas: $V_{pp}$, $V_{max}$, $V_{min}$, $V_{rms}$ y frecuencia estimada.
    - Botón de exportación a imagen **PNG**.
  - **`Analizador de Espectro (FFT)`**:
    - Algoritmo FFT Radix-2 rápido con tamaños de 1024 a 8192 puntos.
    - Escala logarítmica en decibeles (**dB**) o escala lineal de voltaje.
    - Ventanas espectrales seleccionables: Hann, Hamming, Blackman, Rectangular.
    - Detector automático de picos de frecuencia con etiquetas dinámicas.
  - **`Reproductor de Audio (Parlantes)`**:
    - Escucha en tiempo real la señal resultante procesada a través del sistema Web Audio API.
    - Control de volumen, reproducción en bucle (loop) y botón para **Descargar la señal procesada como archivo .WAV estándar (16-bit PCM)**.

---

## 🎯 Modelos Predefinidos de Demostración (Presets)

1. **Filtro FIR Pasabajos vs Ruido de Alta Frecuencia:** Suma de señal deseada (50 Hz) + interferencia (600 Hz), filtrada mediante un filtro FIR con ventana Hamming.
2. **Conversión A/D: Muestreo ZOH y Cuantización (4-bits):** Visualización del efecto de retención ZOH, cuantizador de 4 bits, señal de error $e[n]$ y espectro de armónicos/réplicas.
3. **Modulación de Amplitud (AM) y Demodulación:** Portadora (400 Hz) modulada por mensaje (30 Hz) con multiplicador, detector de envolvente $|u|$ y filtro IIR de recuperación.
4. **Sistema Continuo H(s) - Respuesta al Escalón:** Función de transferencia de segundo orden subamortiguada $H(s) = \frac{2500}{s^2 + 20s + 2500}$ discretizada mediante Tustin.
5. **Entrada WAV y Reproductor con Filtro IIR:** Carga de audio con filtro ecualizador y reproducción por parlantes.

---

## 🚀 Despliegue en GitHub Pages (Paso a Paso)

Este proyecto está 100% optimizado para ejecutarse en GitHub Pages con rutas relativas (`./`):

### Opción Automática (GitHub Actions ya incluido):
1. Crea un nuevo repositorio en GitHub (ej: `webmulink`).
2. Sube el código:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Webmulink DSP"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/webmulink.git
   git push -u origin main
   ```
3. En GitHub, ve a **Settings** → **Pages** → en **Build and deployment / Source**, selecciona **GitHub Actions**.
4. ¡El workflow `.github/workflows/deploy.yml` compilará y desplegará la web automáticamente en `https://TU_USUARIO.github.io/webmulink/`!

### Opción Manual (Local build):
```bash
npm install
npm run build
```
La carpeta generada `dist/` contiene todo el sitio web estático listo para ser alojado en cualquier servidor o en la rama `gh-pages`.

---

## 🛠️ Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build
```

---

Desarrollado para la enseñanza y experimentación práctica de **Señales y Sistemas** y **DSP**.
