---
name: axtech-pricing
description: Usar al cambiar margenes o el tipo de cambio, al revisar si los precios siguen siendo competitivos, al investigar un precio que se ve raro, o al tocar src/lib/pricing.js y config/pricing.config.json. Tambien cuando alguien pregunta cuanto ganamos con un producto.
---

# Precios y margenes

## La formula

```
precio = redondearArribaAlMillar( costo + max(minimo, costo * pct[categoria]) )
```

El maximo entre un piso fijo y un porcentaje existe porque ninguno de los dos
solo funciona. El modelo viejo era un recargo fijo de Gs. 100.000: daba 0,5%
de margen en una placa de 25 millones y 1622% en un cable de 6.000.

El redondeo al millar superior existe porque `Gs. 1.067.683` en una tarjeta de
producto se lee como un error del sistema, no como un precio.

## Los numeros son secretos y no van a este repositorio

`config/pricing.config.json` esta en `.gitignore`. **La formula es invertible**:
con los porcentajes y un precio publicado se reconstruye el costo exacto de
cada producto. Publicar los porcentajes es publicar la lista de costos del
proveedor.

En CI llega por el secreto `PRICING_CONFIG`. El workflow del sync lo
materializa, lo usa y lo borra en un paso `if: always()`, antes de que git vea
nada.

Nunca escribir un porcentaje, un costo ni un margen en:
- un commit, un comentario de codigo, un test o un archivo de `docs/`
- `.gitignore` (esta versionado: nombrar algo ahi es publicarlo)
- un mensaje de chat o un issue

## Cambiar el tipo de cambio

Vive en `config/pricing.config.json` como `tipoDeCambio` (Gs por USD). Es lo
que mas se toca: la lista del proveedor viene en dolares.

```bash
# 1. editar config/pricing.config.json (local, no versionado)
# 2. ver el impacto ANTES de aplicar
node --env-file=.env src/sync/ejecutar.js
```

Si el informe muestra que salta el precio de casi todo, **es el tipo de
cambio**, no el proveedor. El freno de `verificar.js` aborta arriba del 5% de
saltos justamente por esto.

Despues de cambiarlo hay que actualizar el secreto, si no el sync nocturno
sigue usando el viejo:

```bash
node <script de secretos> PRICING_CONFIG "$(cat config/pricing.config.json)"
```

`validarConfig()` rechaza cualquier valor fuera de 3.000-15.000 Gs/USD al
cargar. Una config a medias no rompe nada visible: publica precios
equivocados, que en una tienda es peor que caerse.

## Cambiar margenes

El objetivo calibrado contra el mercado es quedar **15-17% por debajo del
minorista de Asuncion**. Referencias usadas: Master Tech, Nissei, Compras
Paraguai.

Datos medidos que sostienen ese rango:
- el costo esta ~4,3% **por encima** del precio minorista de Ciudad del Este
  para los mismos modelos (no hay descuento mayorista)
- el minorista de Asuncion esta ~30% por encima del costo

Esa banda es angosta. Antes de mover un porcentaje conviene volver a medir, no
estimar: los precios se calibran contra el mercado, no a ojo.

## Un precio se ve raro

```bash
# Ver un producto concreto
node -e "const c=require('./data/catalog.json');const p=c.find(x=>x.id==ID);console.log(p)"

# Recalcular a mano
node --input-type=module -e "
import {precioFinal, cargarConfig} from './src/lib/pricing.js';
console.log(precioFinal(COSTO_EN_GS, 'CATEGORIA', cargarConfig()));
"
```

Si el precio del catalogo no coincide con el recalculado, el producto no se
esta actualizando. Casi siempre es porque su titulo dejo de clasificar; ver la
skill `axtech-sync`.

## `costoDesdePrecioLegado` no se usa mas

Existe solo para la migracion unica de la Fase 1A, cuando habia que
reconstruir costos que la Fase 0 habia borrado. Desde la Fase 4 el costo llega
fresco de la lista. No usarla para nada nuevo.
