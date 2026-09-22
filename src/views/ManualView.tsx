import React, { useState } from 'react';
import { BookOpen, Shield, Flag, Monitor, Tv, Wifi, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export const ManualView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'general' | 'director' | 'equipos' | 'pantalla' | 'contingencia'>('general');

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6">
      {/* Cabecera del Manual */}
      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
              DOCUMENTACIÓN OPERATIVA OFICIAL
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Manual de Operaciones & Uso
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              Protocolos de uso para Dirección de Carrera, Escuderías, Pantallas y Soporte
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-gray-400 bg-[#0a0c10] border border-gray-800 px-3 py-2 rounded-lg">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Versión 2.0 · Hito M2 Activo</span>
        </div>
      </div>

      {/* Navegación por Secciones del Manual */}
      <div className="flex overflow-x-auto space-x-2 pb-1 border-b border-gray-800 text-xs font-medium">
        <button
          onClick={() => setActiveSection('general')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
            activeSection === 'general'
              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-bold'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>1. Resumen de Arquitectura</span>
        </button>

        <button
          onClick={() => setActiveSection('director')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
            activeSection === 'director'
              ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 font-bold'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>2. Dirección de Carrera</span>
        </button>

        <button
          onClick={() => setActiveSection('equipos')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
            activeSection === 'equipos'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <Flag className="w-4 h-4" />
          <span>3. Operadores de Pit Wall</span>
        </button>

        <button
          onClick={() => setActiveSection('pantalla')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
            activeSection === 'pantalla'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>4. Pantalla 16:9 & Transmisión</span>
        </button>

        <button
          onClick={() => setActiveSection('contingencia')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
            activeSection === 'contingencia'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 font-bold'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>5. Contingencias & Fallos</span>
        </button>
      </div>

      {/* Contenido Dinámico según sección */}
      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6">
        {activeSection === 'general' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
                <span className="text-cyan-400 font-mono text-sm font-bold">01 //</span>
                <span>Modelo Autoritativo Centralizado</span>
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                El sistema Pit Wall & Race Control opera bajo una arquitectura de <strong>servidor autoritativo</strong>. Esto significa que los cálculos de tiempos, vueltas rápidas, diferencias y clasificaciones no se calculan de manera aislada en los navegadores de los usuarios, sino en el motor central del servidor para garantizar estricta equidad y cero desincronizaciones entre dispositivos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-[#0a0c10] border border-gray-800 rounded-xl p-4 space-y-2">
                <div className="text-xs font-mono font-bold text-cyan-400 uppercase">Superficies Operativas</div>
                <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Race Control:</strong> Configuración, gestión deportiva, control de mangas y penalizaciones.</li>
                  <li><strong>Pit Wall:</strong> Pantalla táctil móvil para operadores de escudería con botón de vueltas.</li>
                  <li><strong>Pantalla 16:9:</strong> Modo sólo lectura de alta visibilidad para pantallas gigantes de pista.</li>
                  <li><strong>Transmisión:</strong> Overlay limpio para emisión por streaming o TV escolar.</li>
                </ul>
              </div>

              <div className="bg-[#0a0c10] border border-gray-800 rounded-xl p-4 space-y-2">
                <div className="text-xs font-mono font-bold text-emerald-400 uppercase">Invariantes de Calidad</div>
                <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
                  <li><strong>Cero datos simulados:</strong> Todo lo mostrado proviene de datos reales guardados en el servidor.</li>
                  <li><strong>Persistencia duradera:</strong> Los datos sobreviven a reinicios de pestañas o del servidor.</li>
                  <li><strong>Sin límite arbitrario de 4 escuderías:</strong> Soporta cualquier cantidad de equipos requeridos.</li>
                  <li><strong>Interfaz 100% en español:</strong> Todo el texto, botones y estados están en idioma español.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'director' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
                <span className="text-purple-400 font-mono text-sm font-bold">02 //</span>
                <span>Guía para el Director de Carrera (Race Control)</span>
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                El Director de Carrera es la autoridad deportiva que inicializa el evento, supervisa a las escuderías y activa las mangas.
              </p>
            </div>

            <div className="space-y-4 text-xs text-gray-300">
              <div className="p-4 rounded-xl bg-[#0a0c10] border border-gray-800 space-y-2">
                <div className="font-bold text-white text-sm">Paso 1: Dar de alta el evento escolar</div>
                <p>Ingrese al panel <strong>Race Control</strong>. Si el evento no está inicializado, pulse <em>Configurar Evento</em> e ingrese el nombre del Gran Premio, edición y su nombre como director responsable.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#0a0c10] border border-gray-800 space-y-2">
                <div className="font-bold text-white text-sm">Paso 2: Registrar escuderías y compartir enlaces seguros</div>
                <p>Pulse <em>+ Registrar Escudería</em> para agregar a cada equipo con su nombre, sigla (2-4 letras), color representativo y dorsal. Al crearse, el sistema genera automáticamente un <strong>token inconfundible de acceso único</strong>. Pulse el botón de copiar enlace y envíelo a la escudería correspondiente.</p>
                <p className="text-amber-300">Si un equipo sospecha que su enlace fue comprometido, pulse <em>Regenerar Token</em> para revocar el acceso anterior de inmediato.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#0a0c10] border border-gray-800 space-y-2">
                <div className="font-bold text-white text-sm">Paso 3: Crear mangas o sesiones</div>
                <p>Configure las mangas de clasificación (ej. 2 vueltas rápidas) o carrera principal (ej. 25 o 30 vueltas). Puede seleccionar qué escuderías participan en cada tanda.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#0a0c10] border border-gray-800 space-y-2">
                <div className="font-bold text-white text-sm">Paso 4: Supervisión de presencia y dispositivos</div>
                <p>Verifique en la tabla de presencia que cada equipo tenga al menos una tableta o móvil conectada. Si detecta una conexión indebida o duplicada erróneamente, use el botón <em>Desconectar (Kick)</em> para expulsar ese dispositivo en particular.</p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'equipos' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
                <span className="text-emerald-400 font-mono text-sm font-bold">03 //</span>
                <span>Guía para Operadores de Escudería (Pit Wall)</span>
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Cada equipo dispone de una interfaz optimizada para teléfonos móviles y tabletas táctiles en el box de meta.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#0a0c10] border border-gray-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Wifi className="w-4 h-4" />
                </div>
                <div className="font-bold text-white text-xs">Estados de Conexión</div>
                <p className="text-xs text-gray-400">
                  <strong>EN LÍNEA (Verde):</strong> Listo para marcar.<br />
                  <strong>RECONECTANDO (Amarillo):</strong> Sincronizando con el servidor.<br />
                  <strong>SIN CONEXIÓN (Rojo):</strong> Bloqueo preventivo de seguridad.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0a0c10] border border-gray-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Flag className="w-4 h-4" />
                </div>
                <div className="font-bold text-white text-xs">Múltiples Dispositivos</div>
                <p className="text-xs text-gray-400">
                  Varios alumnos del mismo equipo pueden tener el enlace abierto simultáneamente (ej. cronometrador y estratega de neumáticos) sin conflicto de tokens.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0a0c10] border border-gray-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div className="font-bold text-white text-xs">Pulsación Segura</div>
                <p className="text-xs text-gray-400">
                  El botón gigante de vueltas cuenta con filtro anti-doble pulsación para evitar registros accidentales dobles cuando el kart cruza meta.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'pantalla' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
                <span className="text-amber-400 font-mono text-sm font-bold">04 //</span>
                <span>Modo Pantalla Completa & Transmisión</span>
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Diseñado para proyectores, televisores de pista y directos de streaming escolar.
              </p>
            </div>

            <div className="space-y-4 text-xs text-gray-300">
              <div className="p-4 rounded-xl bg-[#0a0c10] border border-gray-800 space-y-2">
                <div className="font-bold text-white text-sm flex items-center space-x-2">
                  <Monitor className="w-4 h-4 text-amber-400" />
                  <span>Botón de Pantalla Completa (Inmersión Total)</span>
                </div>
                <p>
                  En la pestaña <strong>Pantalla 16:9</strong>, haga clic en el botón <strong>"PANTALLA COMPLETA"</strong> ubicado en la esquina superior del marco. Al activarse, la pantalla entra en modo nativo fullscreen, ocultando automáticamente la barra de navegación superior, los encabezados y las notas técnicas de desarrollo para que el público solo aprecie la tabla de tiempos y el estado de la pista.
                </p>
                <p className="text-gray-400 font-mono">
                  Presione la tecla <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-white">Esc</kbd> o pulse el botón flotante para salir del modo inmersivo.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0a0c10] border border-gray-800 space-y-2">
                <div className="font-bold text-white text-sm flex items-center space-x-2">
                  <Tv className="w-4 h-4 text-cyan-400" />
                  <span>Integración de Transmisión (OBS / vMix)</span>
                </div>
                <p>
                  Utilice la ruta <code>/broadcast</code> como navegador en su software de transmisión (ej. OBS Studio). Proporciona gráficos limpios sin elementos de control interactivos, listos para croma o superposición directa sobre la señal de video.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'contingencia' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
                <span className="text-rose-400 font-mono text-sm font-bold">05 //</span>
                <span>Protocolo de Contingencias & Fallos en Carrera</span>
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Pasos a seguir ante cualquier incidencia de hardware, red o corte eléctrico durante el evento.
              </p>
            </div>

            <div className="space-y-3 text-xs text-gray-300">
              <div className="p-3.5 rounded-xl bg-[#0a0c10] border border-rose-900/30 space-y-1">
                <div className="font-bold text-rose-300">Pérdida de señal Wi-Fi en un móvil</div>
                <p className="text-gray-400">
                  La interfaz mostrará <em>SIN CONEXIÓN</em>. No cierre la pestaña; en cuanto vuelva la señal, pulse <em>REINTENTAR CONEXIÓN</em>. El sistema solicitará al servidor el estado actual oficial sin perder ninguna vuelta previa.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0a0c10] border border-rose-900/30 space-y-1">
                <div className="font-bold text-rose-300">El teléfono se queda sin batería</div>
                <p className="text-gray-400">
                  Cualquier otro alumno del equipo puede abrir el enlace de la escudería en un segundo dispositivo y continuar operando inmediatamente sin necesidad de autorización previa.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0a0c10] border border-rose-900/30 space-y-1">
                <div className="font-bold text-rose-300">Discrepancia o error en el registro de una vuelta</div>
                <p className="text-gray-400">
                  Solo Dirección de Carrera tiene potestad reglamentaria para invalidar o corregir un tiempo en el registro de auditoría deportivo (Hito M5). Nunca intente manipular la base de datos directamente durante la carrera.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
