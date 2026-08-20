---
name: axtech-catalog
description: Usar al agregar o corregir categorias y marcas, al investigar productos mal clasificados o que quedaron como GENERIC, al revisar la distribucion del catalogo, o al tocar data/catalog.json, src/lib/taxonomy.js y src/lib/exclusiones.js. Tambien cuando alguien pregunta por que un producto esta en la categoria equivocada, o cuando aparece en la tienda algo que no es un producto de tecnologia y hay que sacarlo del rubro.
---

# Catalogo y taxonomia

`data/catalog.json` es la fuente de verdad. No se edita a mano: lo escribe el
sync. Editarlo a mano sobrevive hasta la proxima corrida nocturna y nada mas.

## El orden de las reglas ES la logica

`src/lib/taxonomy.js` clasifica con la **primera regla que matchea**. El orden
no es estetico:

```
1. accesorios      antes que el aparato al que acompanan
                   ("CAPA PARA NOTEBOOK" no es una notebook)
2. dispositivos    antes que los componentes que mencionan
                   ("NB HP ... RTX3050" es una notebook, no una placa de video)
3. componentes     procesadores ANTES que tarjetas-de-video
                   (los APU dicen "Radeon Graphics" en el titulo)
4. perifericos
5. resto
```

Mover una regla de lugar cambia miles de clasificaciones. Medido: con las
reglas de componentes antes que las de dispositivos, se clasificaban 15
notebooks en vez de 149.

## Agregar o cambiar una regla

Siempre con test primero, y siempre con un caso que verifique que **no se
lleva por delante** lo que ya funcionaba:

```js
test('un controlador ARGB es refrigeracion, no una consola', () => {
    assert.equal(clasificar({ titulo: 'CONTROLADOR SATE ARGB ACB-5 BLACK 9X3PIN 9XPWM' }), 'refrigeracion');
});

test('un control de consola sigue siendo consola', () => {
    assert.equal(clasificar({ titulo: 'CONTROLE XBOX SERIES X WIRELESS BLACK' }), 'consolas-y-videojuegos');
});
```

Despues, medir el efecto real antes de commitear:

```bash
node --env-file=.env src/sync/ejecutar.js   # simula: cuantos cambian de categoria
```

## Abreviaturas del proveedor

Los titulos vienen abreviados y las abreviaturas se **anclan al inicio**, si no
matchean cualquier cosa:

`^nb ` notebooks · `^tec ` teclados · `^hd ` y `^cartao ` almacenamiento ·
`^cel ` celulares · `^mem ` memorias · `^imp ` y `^tinta ` impresoras ·
`^cpu\b` procesadores · `^mb (am\d|\d{3,4})\b` placas madre ·
`^mon \d{2}` monitores · `^estab` UPS · `^receptor ` televisores ·
`^camera ` smart home · `^ui\. ` Ubiquiti (redes)

`^mb ` exige el numero de socket: sin eso, "8 MB" seria una placa madre.

## Reglas que no se negocian

- **No existe categoria de descarte.** Lo que no clasifica se oculta y se
  reporta. Asi fue como el 41,3% del catalogo termino en "Perifericos".
- **Ninguna categoria deberia pasar del 15%** de los activos. El informe del
  sync lo muestra en cada corrida.
- **Los modelos se conservan integros**: `RTX 4070`, `Ryzen 7 7800X3D`,
  `i7-14700K`. Normalizar no puede comerse un modelo.
- **Solo fabricantes reales en `MARCAS`.** Agregar "CABLE", "SMART" o "GAMER"
  agrupa productos de distintas marcas bajo una etiqueta falsa.

## Clasificar mal y no pertenecer al rubro son dos problemas distintos

Si un producto esta en la categoria equivocada, se arregla en `taxonomy.js`.
Si el producto **no deberia estar en la tienda**, eso se decide en
`src/lib/exclusiones.js`, que es otra cosa.

La diferencia importa porque arreglar la taxonomia no saca nada de la tienda.
El caso real: un collar de adiestramiento para perros aparecia en Consolas y
Videojuegos porque su titulo decia "C/CONTROLE". Corregir la regla lo saco de
esa categoria, pero al no clasificar en ninguna otra, el sync le conservo la
que ya tenia (`categoriaHeredada` en `aplicar.js`). Esa herencia existe a
proposito — que el proveedor recorte un titulo no puede borrar un producto —
asi que la decision de no vender algo hay que decirla aparte.

El proveedor no es solo una tienda de tecnologia: en su lista hay articulos
para mascotas y otras cosas del rubro equivocado. Antes de agregar un patron a
`exclusiones.js`, la pregunta es "¿esto es un producto de tecnologia?", no
"¿esto se vende poco?".

**Los dos errores no cuestan lo mismo.** Excluir de mas saca de la tienda algo
vendible; excluir de menos deja un producto raro en una categoria, que se ve
feo y se arregla despues. Por eso los patrones son especificos. Ejemplo real:
"gato" parecia inofensivo hasta que aparecio `PAINEL LED EL GATO NEO KEY
LIGHTS`, que es un panel de luz de ELGATO. Correr siempre el patron nuevo
contra la lista real y mirar **que** saca antes de commitear.

Un producto excluido no entra si es nuevo, se marca `hidden` si ya estaba
publicado, y lo borra la purga a los 30 dias. Se cuenta aparte de los ocultados
normales para no disparar el freno de `verificar.js` por el motivo equivocado.

## Investigar

```bash
# Distribucion por categoria
node -e "const c=require('./data/catalog.json').filter(p=>p.status==='active');const m={};for(const p of c)m[p.category]=(m[p.category]||0)+1;console.table(Object.entries(m).sort((a,b)=>b[1]-a[1]))"

# Productos activos sin marca
node -e "const c=require('./data/catalog.json').filter(p=>p.status==='active'&&p.brand==='GENERIC');console.log(c.length);c.slice(0,20).forEach(p=>console.log(p.title.slice(0,70)))"

# Que clasifica un titulo concreto
node --input-type=module -e "import{clasificar}from'./src/lib/taxonomy.js';console.log(clasificar({titulo:process.argv[1]}))" "TITULO ACA"
```

## Normalizacion

`src/lib/normalize.js` repara dos danios opuestos del origen: la vocal
acentuada perdida (lista explicita de 63 palabras reales) y el separador
perdido (`MSI�PRO` -> `MSI PRO`, con espacio como respaldo). El respaldo
es un espacio y no vacio porque vaciar mutilaba palabras (`C�MBIO` ->
`CMBIO`).

La fuente es ASCII pura: los caracteres no ASCII van como `�` o
`String.fromCharCode`, para no depender de como lea el archivo el editor.
