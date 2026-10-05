# Mundo Geranio — contexto del proyecto

## Visión

Mundo abierto social en 2D dentro de un geranio gigante. Los niños exploran como Soso, Lili o Guvú; más adelante habrá zonas conectadas, casas, muebles y misiones. La prioridad inmediata es un tramo pequeño y jugable que siente bien antes de ampliar el mapa.

## Stack y ejecución

- Cliente: Phaser 3.90.0, TypeScript, Vite y `@colyseus/sdk` 0.18.
- Servidor: Node.js, TypeScript y Colyseus 0.18.
- Sala: `geranio_room`; puerto `2567`.
- Fondo y recursos: `client/public/assets/`.
- El cliente deriva `ws:`/`wss:` del host actual para admitir desarrollo local y acceso desde otros dispositivos de la misma red.
- Arranque habitual: servidor desde `server/` con `npx tsx src/index.ts`; cliente desde `client/` con `npm run dev -- --host 0.0.0.0`.

## Movimiento actual

- `shared/world.ts` define el espacio canónico 800×600, el área transitable trazada sobre el borde superior de la hoja del fondo y la simulación compartida de aceleración, fricción, velocidad máxima y salto.
- El cliente envía la intención direccional mediante `move` aproximadamente 10 veces por segundo; el servidor simula el movimiento a 30 Hz y es dueño de la posición sincronizada. El cliente interpola las posiciones entre actualizaciones de red y no usa cuerpos Arcade para mover jugadores.
- El cliente habilita dos punteros táctiles: puede mantener un dedo para guiar el movimiento y tocar el botón de salto con otro. La escena selecciona para moverse cualquier puntero presionado que no esté sobre el botón.
- El salto es vertical respecto al plano de la hoja: el servidor sincroniza su altura y el cliente desplaza el sprite y aplana su sombra. Se activa con Espacio o el botón táctil.
- La escala de Phaser se adapta al tamaño de pantalla, mientras que mundo, fondo y colisiones conservan las mismas coordenadas en móvil y PC.
- El cliente pasa la clase `State` real a `joinOrCreate` como esquema raíz; el tipo genérico por sí solo no permite al SDK Colyseus 0.18 decodificar el mapa sincronizado.
- El servidor asigna personajes, coloca jugadores y gotas sobre la zona transitable, valida recogidas, actualiza puntuación y regenera las gotas.

## Recursos

- `client/public/assets/fondo_geranio.jfif`: ilustración 2752×1536.
- `client/public/assets/soso.png`, `lili.png`, `guvu.png`: arte de personajes.
- `client/public/assets/lili3.png` y `guvu3.png`: variantes estáticas; no son fotogramas de un ciclo de caminar.
- `client/public/assets/guvu_walk.png`: spritesheet transparente horizontal de 12 fotogramas, 8016×377 px (668×377 px por fotograma).
- `client/public/assets/guvu_idle.png`: spritesheet transparente horizontal de 30 fotogramas, 20040×377 px (668×377 px por fotograma).
- `client/public/assets/guvuSalta.png`: spritesheet transparente horizontal de 27 fotogramas (51894×1082 px, 1922×1082 px por fotograma).
- `client/public/assets/guvuSaltaQuieto.png`: spritesheet transparente horizontal de 24 fotogramas (46128×1082 px, 1922×1082 px por fotograma).
- `client/public/assets/lili_walk.png`: spritesheet transparente horizontal de 21 fotogramas (26922×722 px, 1282×722 px por fotograma; versión reemplazada actual).
- Los atlas derivados `guvu_*_atlas*.png` y `lili_walk_atlas_v2_0.png` / `_v2_1.png` usan celdas de 668×377 y miden menos de 2048×2048 para compatibilidad móvil; no reemplazan las hojas fuente horizontales.
- `client/public/assets/collect.wav`: efecto de recogida.

## Animación de personajes — estado y siguiente trabajo

- Los tres PNG principales son ilustraciones individuales de 512×512 con transparencia; no contienen capas separadas ni poses de movimiento. Por eso intercambiar su posición en pantalla siempre parecerá una imagen deslizándose.
- Se probó una animación procedural de rebote, respiración, escala e inclinación en el cliente. Se retiró porque hacía saltar al personaje y mover la cámara, dando vibración al fondo. No volver a añadir deformaciones al sprite que sigue la cámara.
- El cliente conserva ahora interpolación de posición sincronizada para suavizar la red, sin oscilación, rebote ni cambio de escala. El movimiento sigue siendo autoritativo en el servidor.
- Guvú permanece en el fotograma 0 de `guvu_idle_atlas_0` cuando está quieto. Cada 7 segundos de reposo reproduce una vez `guvu-idle` (30 fotogramas a 15 fps) y vuelve al fotograma estático; si empieza a caminar durante el gesto, se cancela. `guvu-walk` sigue a 12 fps mientras cambia su posición de red. Lili reproduce `lili-walk-v2` (21 fotogramas a 12 fps, hoja de arte reemplazada) mientras camina y vuelve a su imagen `lili.png` al parar. Ambos spritesheets laterales miran a la derecha de forma nativa y se espejan al caminar a la izquierda. Soso sigue estático.
- Cuando Guvú inicia un salto mientras camina, reproduce `guvu-jump-walk` (27 fotogramas a 36 fps); si despega quieto, reproduce `guvu-jump-idle` (24 fotogramas a 36 fps). Ambas animaciones vuelven a `guvu-walk` o al fotograma idle al aterrizar. Las hojas fuente horizontales se reducen a celdas 668×377 y se empaquetan en atlas aptos para móviles.
- El próximo ajuste de animación debe ser una revisión visual de la alineación entre los pies de los spritesheets y las sombras, y del instante en que arrancan/paran los ciclos; no añadir rebote, respiración, inclinación o cambios de escala al personaje/cámara.
- Después de validar Guvú, preparar arte real para sus poses de reposo/salto y para Soso/Lili antes de ampliar direcciones. Revisar el giro horizontal de cada diseño antes de espejar, porque caparazón, manchas y otros detalles son asimétricos.
- Alternativa: rig 2D con huesos si se separa cada personaje en piezas articulables. Da animación reutilizable, pero requiere recortar/redibujar piezas y preparar un rig; no se obtiene un ciclo de calidad directamente de los PNG actuales.

### Recursos que debe preparar el arte

Para la opción de fotogramas:

- Un archivo fuente editable por personaje (por ejemplo `.kra` de Krita o `.aseprite`), con lienzo y punto de apoyo iguales en todos los fotogramas, fondo transparente y margen suficiente para antenas/patas.
- Ciclo `idle` de 2–4 poses; ciclo `walk` de 6–8 poses coherentes y en bucle; y ciclo `jump` de 3–4 poses (impulso, subida, ápice/caída y aterrizaje). Dibujar las partes que realmente deben moverse: patas de Lili/Guvú, cuerpo y antenas; cuerpo y pie de Soso además del ajuste del caparazón.
- Entrega exportada como PNG spritesheet y, si se usan etiquetas/metadatos, JSON de atlas. Mantener el original editable dentro del proyecto, por ejemplo en `client/art/characters/`; poner las exportaciones consumidas por Phaser bajo `client/public/assets/characters/`.
- Para el primer piloto, basta un personaje, `idle` y `walk` lateral. Acordar el estilo/dirección y revisar un GIF o previsualización antes de dibujar los otros dos.

### Herramientas candidatas

- **Krita**: opción gratuita para dibujar fotogramas raster con línea de tiempo y onion skin; exportar la secuencia de imágenes y empaquetarla como spritesheet. Buena opción para respetar el acabado ilustrado de estos PNG.
- **Aseprite**: alternativa orientada a spritesheets y etiquetas de animación; conserva capas/fotogramas en `.aseprite` y exporta hojas con JSON.
- **Spine**: opción comercial para rig 2D si el arte se entrega separado por piezas; tiene runtime oficial para Phaser 3. Añade integración y requisitos de licencia, por lo que no lo elegiría antes de confirmar el presupuesto y preparar el arte por capas.
- **Phaser 3**: reproduce clips por fotogramas. El estado online solo necesita sincronizar dirección/velocidad y altura del salto; cada cliente reproduce localmente el clip correspondiente. No se sincronizan los fotogramas por red.

Referencias oficiales: [animaciones de Phaser](https://docs.phaser.io/phaser/concepts/animations), [animación en Krita](https://docs.krita.org/en/user_manual/animation.html), [spritesheets de Aseprite](https://www.aseprite.org/docs/sprite-sheet/) y [runtime Spine para Phaser](https://en.esotericsoftware.com/spine-phaser).

## Geometría

`shared/world.ts` contiene la única definición de suelo que consumen servidor y cliente; no se usan cajas de colisión ni límites de Arcade. La silueta es una primera traza del borde superior visible de la hoja y llega hasta la parte inferior del lienzo. Si se modifica el encuadre o el arte del fondo, hay que revisar esa forma junto con la posición de inicio y la generación de gotas.

## Comprobaciones

- `npm run build` en `client/` valida TypeScript y genera el bundle de Vite.
- Para el servidor, comprobar tipos en modo estricto con TypeScript usando módulos `preserve` y resolución `bundler` (dependencias Colyseus ESM).
- No hay todavía pruebas automatizadas de la simulación.
