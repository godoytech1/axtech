---
name: axtech-filtros
description: Usar al tocar cualquier funcion getXxx() de app.js, al agregar o corregir una opcion de la barra lateral de filtros, cuando un producto aparece bajo un filtro que no le corresponde, cuando un filtro devuelve cero resultados, o cuando hay que agregar un tramo nuevo de capacidad, vatios o pulgadas. Tambien cuando alguien pregunta por que el contador de una opcion no coincide con lo que se ve.
---

# Barra de filtros (app.js)

La barra lateral clasifica los productos **leyendo el titulo en el navegador**,
en tiempo de render. No hay campo guardado: `getGpuChip('VGA RTX5070 12GB')`
corre cada vez que se dibuja la barra.

Esto es una capa distinta de la taxonomia. `src/lib/taxonomy.js` decide en que
**categoria** vive un producto y corre en el build. Las funciones `getXxx()` de
`app.js` deciden que **opciones de filtro** lo reclaman y corren en el cliente.
Las dos clasifican por titulo y las dos se equivocan igual, pero se arreglan en
archivos distintos. Para categorias, ver `axtech-catalog`.

## La regla: evidencia positiva

**Una opcion de filtro solo puede reclamar un producto si el titulo lo prueba.
Sin evidencia, `null`.**

Esta regla existe porque se rompio. Una funcion que termina en un `return` fijo
no falla nunca: la pagina carga, la consola queda limpia, los tests pasan, y lo
unico que pasa es que el filtro miente. Estuvo publicado meses.

Lo que habia en produccion antes de que existiera esta regla:

| Sintoma | Causa |
|---|---|
| 54 memorias SODIMM aparecian al filtrar "PC" | `getRamType` terminaba en `return 'PC'` y buscaba "SODIMM", que el proveedor escribe en 22 de 77 |
| 9 placas AMD listadas como NVIDIA | el patron pedia `rx ` con espacio; el proveedor escribe `RX580` |
| 3 Intel Arc listadas como AMD | no habia rama INTEL |
| 19 placas madre socket 1851 y 775 salian Intel | por el `return` del final, o sea por casualidad |
| 5 receptores IPTV en el filtro de pulgadas | `IPTV 16GB` daba un televisor de 16" |

Ninguno de esos productos rompio nada. Por eso duraron.

## Cuando un `return` fijo SI es correcto

No todo fallback es un bug. La pregunta es **si ya se extrajo evidencia antes**.

- `getPsuWattage` devuelve `'1000W+'` al final, pero solo despues de haber
  sacado un numero del titulo. El numero es la evidencia; el ultimo tramo es
  el techo de una escala, no una adivinanza. Igual `getStorageCapacity` con
  `'4TB+'` y `getProjectorBrightness`.
- `getNotebookType` devuelve `'Ofimática'` al final. Aca la ausencia de marcas
  gamer **es** evidencia: toda notebook es una cosa o la otra, y no tener GPU
  dedicada ni linea gamer en el titulo dice algo real.
- `getRamType` devolvia `'PC'` al final y eso **era** un bug: que el titulo no
  diga "notebook" no prueba que sea de escritorio, solo prueba que el titulo es
  corto.

Criterio: si al llegar al `return` final no se leyo **nada** del titulo, es una
adivinanza. Devolver `null`.

## Una caracteristica nunca le gana a lo que el producto es

El proveedor mete caracteristicas en el titulo con la misma palabra que usa
para el producto. `C/Cable`, `S/Fuente`, `Con Fuente`, `C/CONTROLE`, `FOR XBOX`.

Una fuente de poder es un producto. "Con fuente" es una caracteristica de un
gabinete. Los patrones tienen que mirar el prefijo:

```js
/(?<![cs]\/|con |sin |com |sem )\b(fuente|fonte|psu)\b/i
```

El caso que abrio esta regla fue un collar de adiestramiento para perros
publicado en Consolas y Videojuegos porque su titulo decia "C/CONTROLE".

## Tramos: contiguos, sin huecos y sin solaparse

Los filtros de rango (`ORDEN_CAPACIDAD`, vatios, pulgadas) son una particion.
Si hay un hueco, los productos que caen ahi desaparecen de todas las opciones y
nadie se entera: el filtro se ve completo.

Al agregar un tramo, verificar que el limite superior de uno sea exactamente el
inferior del siguiente. `ORDEN_CAPACIDAD` ademas define el orden de la lista a
mano, porque ordenar `'1TB'` y `'480GB - 512GB'` alfabeticamente da cualquier
cosa.

## Las opciones se derivan del catalogo, no se escriben a mano

```js
const chipsPresentes = ['NVIDIA', 'AMD', 'INTEL']
    .filter((c) => chips[c])
    .concat(Object.keys(chips).filter((c) => !['NVIDIA','AMD','INTEL'].includes(c)).sort());
```

Los tres conocidos van primero y en ese orden; cualquier chip nuevo aparece solo
al final. Antes NVIDIA y AMD estaban fijas y las Intel Arc no tenian donde caer.
Mismo patron en `plataformasPresentes`.

El contador `(N)` de cada opcion sale del **mismo** conteo que despues filtra.
Si se calculan por separado, un dia dicen numeros distintos.

## Antes de tocar un clasificador

1. Correr la funcion contra `products.js` real y mirar **que** cambia, no
   cuantos. Un patron nuevo suele arrastrar productos que ya estaban bien.
2. Cuidado con los `\b` en titulos pegados: `\brtx\b` **no** matchea `RTX5070`.
   Este error ya dio numeros falsos en una auditoria.
3. Agregar el caso a `test/front/filtros.test.js`. Ese archivo extrae la funcion
   **real** de `app.js` con `new Function`, no una copia, para que no se
   despeguen. Si escribis una copia en el test, el test valida el test.
4. Si un producto sale de un filtro, confirmar que no sale tambien de la tienda:
   la exclusion de rubro se decide en `src/lib/exclusiones.js`, no aca.

## Verificacion en vivo

Los filtros corren en el navegador, asi que el unico check real es contra lo
publicado:

```
curl -s https://axtech.pages.dev/app.js -o app-vivo.js
curl -s https://axtech.pages.dev/products.js -o products-vivo.js
```

y correr la funcion extraida sobre los titulos reales. Los tests prueban la
regla; esto prueba el catalogo de hoy.
