import React from 'react';
import { X, BookOpen, Layers, Cpu, Radio, GitBranch } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-sky-400" />
            <h2 className="font-bold text-sm text-white">
              Guía de Usuario y Teoría de Webmulink DSP
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300 leading-relaxed custom-scrollbar">
          {/* Quick Start */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-sky-400 flex items-center space-x-1.5">
              <span>🚀 Inicio Rápido</span>
            </h3>
            <p className="text-slate-400">
              Webmulink es un entorno de simulación web interactivo inspirado en Simulink para
              el estudio de <strong>Señales y Sistemas</strong> y <strong>Procesamiento Digital de Señales (DSP)</strong>.
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
              <li>
                <strong>Agregar bloques:</strong> Arrastra desde el panel lateral izquierdo o haz clic en (+).
              </li>
              <li>
                <strong>Conectar señales:</strong> Arrastra desde el puerto de salida azul (derecha) hacia el puerto de entrada verde (izquierda).
              </li>
              <li>
                <strong>Configurar parámetros:</strong> Haz doble clic sobre cualquier bloque para editar frecuencias, coeficientes de filtro, funciones de transferencia, bits de cuantización, etc.
              </li>
              <li>
                <strong>Ejecutar:</strong> Pulsa el botón verde <span className="text-emerald-400 font-semibold">Ejecutar</span> en la barra superior.
              </li>
              <li>
                <strong>Ver resultados:</strong> Haz doble clic o pulsa "Ver Gráfico" en los bloques <em>Osciloscopio</em>, <em>Analizador FFT</em> o <em>Reproductor de Audio</em>.
              </li>
            </ul>
          </section>

          {/* DSP & Signals Theory */}
          <section className="space-y-3 border-t border-slate-800 pt-3">
            <h3 className="text-sm font-bold text-purple-400 flex items-center space-x-1.5">
              <Cpu className="w-4 h-4" />
              <span>Bloques DSP y Teoría de Señales</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-slate-200">Filtros FIR (Finite Impulse Response)</span>
                <p className="text-[11px] text-slate-400">
                  Respuesta y[n] = Σ b[k]·x[n-k]. Ofrece fase lineal estricta y estabilidad incondicional.
                  Incluye diseñador por ventana (Hamming, Hann, Blackman) o entrada manual de coeficientes.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-slate-200">Filtros IIR (Infinite Impulse Response)</span>
                <p className="text-[11px] text-slate-400">
                  Implementa Forma Directa II Transpuesta con coeficientes de numerador (b) y denominador (a).
                  Diseña filtros tipo Butterworth y Biquad con factor Q configurable.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-slate-200">Retenedor ZOH y ADC (Cuantización)</span>
                <p className="text-[11px] text-slate-400">
                  Muestrea a tasa F_hold para visualizar escalones y réplicas espectrales. El bloque ADC
                  cuantiza a N bits y calcula la señal de error e[n] y la relación SQNR ≈ 6.02·N + 1.76 dB.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-slate-200">Sistemas Continuos H(s)</span>
                <p className="text-[11px] text-slate-400">
                  Convierte automáticamente funciones continuas H(s) a su equivalente en tiempo discreto
                  H(z) mediante la Transformada Bilineal (Tustin) evaluada a la frecuencia Fs.
                </p>
              </div>
            </div>
          </section>

          {/* Audio Processing */}
          <section className="space-y-2 border-t border-slate-800 pt-3">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center space-x-1.5">
              <Radio className="w-4 h-4" />
              <span>Entrada y Salida de Audio Real (.WAV)</span>
            </h3>
            <p className="text-slate-400">
              Puedes subir canciones, notas de voz o muestras en formato .WAV o .MP3 al bloque <strong>Fuente WAV</strong>.
              El motor las decodifica con Web Audio API, las procesa a través de tu red de bloques y las reproduce
              en tiempo real en el bloque <strong>Reproductor Parlantes</strong>.
            </p>
          </section>

          {/* GitHub Pages Deployment */}
          <section className="space-y-2 border-t border-slate-800 pt-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            <h3 className="text-sm font-bold text-sky-400 flex items-center space-x-1.5">
              <GitBranch className="w-4 h-4" />
              <span>Despliegue Gratuito en GitHub Pages</span>
            </h3>
            <p className="text-slate-400">
              Webmulink está diseñado 100% en el lado cliente (sin necesidad de servidores backend). Para publicarlo en GitHub Pages:
            </p>
            <ol className="list-decimal list-inside space-y-1 font-mono text-[11px] text-slate-300">
              <li>Ejecuta: <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">npm run build</code></li>
              <li>Sube el repositorio a GitHub</li>
              <li>En GitHub: entra a <strong>Settings → Pages</strong>, selecciona la rama <code>main</code> o <code>gh-pages</code> y ¡listo!</li>
            </ol>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
