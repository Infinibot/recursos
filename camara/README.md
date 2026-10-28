# CAMARA 3D · Desmonta un producto con IA

Visor 3D interactivo de **CAM-01**, una cámara fotográfica original y sin marca (modelo conceptual) que se puede girar y desmontar pieza a pieza.

## Cómo abrirlo
Descarga `index.html` y ábrelo con doble clic en cualquier navegador moderno. Es un único archivo: lleva Three.js 0.170.0 dentro, no usa claves API,
no pide inicio de sesión y funciona sin internet.

## Qué hace (todo funciona de verdad)
- **Arrastrar** sobre el modelo: lo gira. Un toque corto en una pieza la destaca y muestra su nombre.
- **Separación** (0–100): 0 ensamblada · 25 lente frontal separada · 50 objetivo parcialmente desmontado · 75 componentes separados · 100 despiece completo. Suave y reversible.
- **Rotar**: giro automático. **Separar**: abre o cierra el despiece. **Reiniciar**: vuelve a la vista y a la separación iniciales. **Demo automática**: despiece y montaje en bucle.
- **Lista de componentes**: LENTE FRONTAL, ANILLO EXTERIOR, GRUPO ÓPTICO, BARRIL DEL OBJETIVO, MONTURA, CUERPO, SENSOR CONCEPTUAL y PANTALLA TRASERA.

## Hacer el tuyo
Copia el prompt de la página (o `fuente/prompt.txt`), cambia lo que va entre corchetes (tipo de producto, nombre, colores, materiales, piezas, estilo) y pégalo en Claude Code.

## Reconstruir el archivo (opcional)
El código vive en `fuente/` (`camara.mjs` = modelo, `visor.mjs` = interfaz, `plantilla.html` = página). `fuente/construir.py` lo empaqueta en `index.html`
con esbuild y Three.js 0.170.0 (`npm i three@0.170.0 esbuild`).

## Aviso
Modelo conceptual: no representa la construcción interna de ninguna cámara real y no es un plano técnico ni un despiece exacto. Si usas imágenes, modelos
o diseños de terceros, comprueba sus licencias.
