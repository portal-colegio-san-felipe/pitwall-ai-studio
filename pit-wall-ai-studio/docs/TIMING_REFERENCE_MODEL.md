# Modelo de Referencia y Cronometraje Autoritativo (Hito M3)

## 1. Principio Autoritativo Central
- **Reloj Central del Servidor**: El tiempo de carrera es determinado exclusivamente por el servidor Node.js mediante `Date.now()` en el instante en que el intent del cliente es recibido y validado.
- **Clientes Pasivos**: Los clientes (Pit Wall, Race Control, Display) envían únicamente **intenciones de registro** (`POST /api/sessions/:sessionId/laps`). Los relojes locales de los dispositivos móviles o navegadores **nunca** se emplean como fuente de verdad para el cronometraje oficial.

## 2. Ciclo de Vida de la Sesión / Manga
Una sesión deportiva transita por los siguientes estados:
1. **`SCHEDULED`**: Manga configurada, equipos participantes asignados, vueltas objetivo definidas. Los controles de registro de vueltas están inactivos.
2. **`RUNNING`**: Manga iniciada por Dirección de Carrera (`POST /api/sessions/:sessionId/start`). Se fija el sello de tiempo autoritativo `startedAt` (en milisegundos). Los controles de cronometraje quedan habilitados para las escuderías participantes.
3. **`TIMING_CLOSED`**: Cronometraje detenido por Dirección de Carrera (`POST /api/sessions/:sessionId/close`). No se admiten nuevas vueltas; se abre la fase de revisión y oficialización.
4. **`OFFICIAL`**: Resultados definitivos sellados e inmutables.

## 3. Modelo de Salida y Referencia de Vuelta (Lap Timing Model)
- **Salida Parada / Cronometrada**:
  - Al iniciarse la sesión, se fija `session.startedAt`.
  - La **Vuelta 1** de cada escudería se calcula con respecto a `startedAt` o al primer cruce de referencia autorizado.
  - Para cada cruce subsiguiente $n$, el tiempo de vuelta es:
    $$\Delta t_n = \text{timestamp}_n - \text{timestamp}_{n-1}$$
  - Cada vuelta registrada genera un `LapRecord` inmutable y un evento auditable `LAP_REGISTERED`.

## 4. Protección Anti-Doble Pulsación (Deduplication / Double-Tap Protection)
- **Umbral de Seguridad**: Se define un umbral de paso mínimo de **3500 ms (3.5 segundos)** entre cruces sucesivos para una misma escudería.
- Si un operador de box presiona dos veces rápidamente el botón "REGISTRAR VUELTA", el servidor descarta el segundo intento devolviendo un error controlado `DUPLICATE_LAP_INTENT` con mensaje claro en español: *"Intento duplicado detectado (protección anti-doble pulsación activa)"*.
- Se permite opcionalmente enviar un identificador de idempotencia (`clientIntentId`).

## 5. Proyecciones en Tiempo Real
- **Lap Count**: Total de vueltas válidas registradas por la escudería.
- **Last Lap (Última Vuelta)**: Duración en milisegundos de la vuelta válida más reciente.
- **Best Lap (Mejor Vuelta)**: Menor tiempo de vuelta registrado por la escudería en la manga.
- **Fastest Lap (Vuelta Rápida / Vuelta Morada)**: Menor tiempo absoluto entre todas las escuderías en pista.
- **Leaderboard (Clasificación)**:
  - Ordenado por número de vueltas (descendente).
  - En caso de empate en vueltas, ordenado por tiempo de cruce de la última vuelta (quien completó antes la vuelta va por delante).
  - En sesiones clasificatorias, ordenado por tiempo de mejor vuelta (ascendente).
