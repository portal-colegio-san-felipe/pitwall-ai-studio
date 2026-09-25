# Manual de Operaciones · Pit Wall & Race Control

Guía operativa integral del sistema para directores de carrera, operadores de escudería, operadores de pantalla y administradores técnicos en eventos escolares de karts.

---

## 1. Arquitectura y Superficies Operativas

El sistema opera bajo un modelo de **servidor autoritativo central** con cinco superficies diferenciadas:

1. **Dirección de Carrera (Race Control)**:
   - Configura el evento escolar (nombre, edición, responsable).
   - Registra escuderías (sin límite rígido de 4) con nombre, sigla, color identificativo, dorsal y kart asignado.
   - Crea mangas o rondas (Clasificación, Carrera principal o Entrenamientos) con número de vueltas objetivo y asignación de participantes.
   - Supervisa la presencia y dispositivos conectados por cada equipo en tiempo real.
   - Gestiona incidentes, banderas de seguridad, corrección y auditoría de tiempos.
   - Oficializa resultados finales.

2. **Pit Wall (Operadores de Escudería)**:
   - Acceso seguro mediante **enlace único con token inconfundible** (ej. `/pit-wall?token=...`).
   - Admite **múltiples dispositivos o tabletas simultáneos** por escudería.
   - Botón ergonómico de gran formato para registro de vueltas con protección contra pulsaciones dobles o involuntarias.
   - Consulta de telemetría de estrategia: calzado actual, vueltas de stint y relevos de pilotos.
   - Avisos en directo emitidos por Dirección de Carrera.

3. **Pantalla de Pista (Display 16:9)**:
   - Diseñada específicamente para pantallas gigantes de pista y proyectores.
   - Proporción 16:9 fija, sólo lectura, de alta legibilidad a distancia para público y pilotos.
   - **Modo Pantalla Completa**: Botón dedicado para ocultar completamente la interfaz del navegador, barras y notas de desarrollo.

4. **Transmisión (Broadcast Overlay)**:
   - Salida limpia para ingesta en OBS Studio, vMix o streaming en directo.
   - Información esencial sincronizada en tiempo real con fondo adaptable (croma o transparente).

5. **Administración Técnica**:
   - Diagnóstico de persistencia y base de datos autoritativa.
   - Verificación de políticas de seguridad: cero datos simulados en producción y garantía de idioma español.

---

## 2. Guía Rápida para el Director de Carrera

### Paso 1: Configurar el Evento
1. Diríjase a **Race Control**.
2. Si el evento no existe, pulse **"Configurar Evento"**.
3. Ingrese el nombre oficial (ej. *Gran Premio Escolar 2026*), edición y nombre del director responsable.

### Paso 2: Dar de Alta Escuderías, Registrar Pilotos y Compartir Enlaces
1. En la sección **Escuderías Registradas**, pulse **"+ Registrar Escudería"**.
2. Ingrese el nombre del equipo, sigla (2-4 caracteres), color del kart, dorsal y modelo del kart.
3. **Registro Previo de Pilotos**: En el campo *"Pilotos del Equipo"*, añada los nombres de los alumnos que correrán (ej. Lucas, Sofía, Mateo). También puede pulsar el botón **"Pilotos"** en la tarjeta de cualquier escudería para actualizar la alineación de pilotos en cualquier instante previo al inicio.
4. Copie el **enlace de acceso único** generado para cada equipo pulsando el icono de enlace/copiar y compártalo con los alumnos u operadores de dicho equipo.
5. *Seguridad*: Si un enlace se comparte erróneamente, pulse **"Regenerar Token"** para revocar el acceso anterior de forma inmediata.

### Paso 3: Configurar Rondas o Sesiones
1. En **Sesiones y Mangas**, pulse **"+ Nueva Ronda / Sesión"**.
2. Seleccione el tipo: *Clasificación* (ej. 2 vueltas), *Carrera* (ej. 25 vueltas) o *Libre*.
3. Defina las vueltas objetivo y marque las escuderías que participan en la manga.

### Paso 4: Monitorear Presencia y Conectividad
1. Revise el panel **Conectividad y Presencia de Dispositivos**.
2. Verifique que cada equipo tenga al menos un dispositivo en estado **EN LÍNEA**.
3. Si un dispositivo ajeno o no autorizado intenta operar, utilice el botón **"Desconectar" (Kick)** para expulsar la sesión específica de dicho dispositivo sin afectar al resto del equipo.

### Paso 5: Limpieza, Cierre y Reinicio de Eventos
1. **Regla de Inactividad de 6 Horas**: Si una sesión queda en estado `RUNNING` sin cruces ni actividad durante más de 6 horas (por ejemplo, tras pruebas de desarrollo o abandono fortuito), el servidor la cierra automáticamente (`TIMING_CLOSED`) para evitar que el reloj siga corriendo de forma ficticia.
2. **Eliminación y Reinicio**: En la barra superior de Dirección de Carrera, el botón **"Eliminar Evento"** permite reiniciar la plataforma por completo con confirmación previa, eliminando mangas y escuderías para comenzar una nueva jornada deportiva limpia.

---

## 3. Guía para Operadores de Pit Wall (Alumnos y Equipos)

1. **Acceso al Box**:
   - Abra el enlace provisto por el Director de Carrera en su móvil o tableta.
   - La pantalla validará automáticamente su token de escudería y mostrará el nombre y color de su equipo.
2. **Estado de Conexión**:
   - **EN LÍNEA (Verde)**: Conexión confirmada con el servidor autoritativo. Todos los controles operativos.
   - **RECONECTANDO (Amarillo)**: Pérdida momentánea de señal Wi-Fi; el sistema reintenta la sincronización automáticamente en segundo plano.
   - **SIN CONEXIÓN (Rojo)**: Sin comunicación. Los botones de cronometraje se bloquean por seguridad para evitar datos desfasados. Pulse **"REINTENTAR CONEXIÓN"** tan pronto recupere cobertura.
3. **Registro de Vueltas**:
   - Cuando el kart de su escudería cruce la línea de meta, pulse el botón central **"REGISTRAR VUELTA"**.
   - El sistema registra la marca con marca de tiempo autoritativa del servidor y actualiza instantáneamente el contador y mejores tiempos.

---

## 4. Guía para Pantalla Gigante (Display) y Comportamiento de Posiciones

1. En la computadora conectada a la pantalla gigante o proyector, acceda a la pestaña **Pantalla 16:9**.
2. Pulse el botón **"PANTALLA COMPLETA"** situado en la esquina superior derecha del marco.
3. El sistema solicitará al navegador la entrada en modo inmersivo nativo (F11), eliminando barras de pestañas, marcadores y elementos de navegación web.
4. **Comportamiento de Posiciones y Adelantamientos (Surpassing)**:
   - La tabla se reordena estrictamente en tiempo real de acuerdo a la clasificación autoritativa del servidor (P1 líder arriba, seguido de P2, P3, etc.).
   - Al producirse un adelantamiento en pista (un kart completa la vuelta antes que el rival que le precedía), la fila del kart sube de posición de inmediato, señalando la ganancia con un indicador visual verde.
   - La columna de diferencia muestra la brecha temporal respecto al líder para karts en la misma vuelta (`+X.XXXs`) o el número de vueltas perdidas (`+1 Vta`, `+2 Vtas`) para karts doblados.
5. Para salir del modo inmersivo en cualquier momento, presione la tecla `Escape` o haga clic en el botón de salida flotante.

---

## 5. Protocolo de Recuperación ante Fallos Técnicos

- **Cierre accidental del navegador**: Al volver a abrir la pestaña, el servidor restaura automáticamente la sesión sin pérdida de vueltas ni tiempos registrados.
- **Cambio o rotación de dispositivo**: El nuevo teléfono o tableta solo necesita abrir el enlace original de la escudería para quedar inmediatamente sincronizado con el cronometraje oficial.
- **Discrepancia en cronometraje**: Cualquier ajuste debe ser solicitado formalmente a Dirección de Carrera, quien registrará la rectificación en el registro de auditoría sin borrados destructivos.
