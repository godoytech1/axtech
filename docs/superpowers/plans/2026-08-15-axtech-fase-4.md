# Fase 4 — Sync automático, tests y CI

> **Para agentes:** ejecutar con `superpowers:executing-plans`, tarea por tarea.
> Los pasos usan casillas (`- [ ]`).

**Objetivo:** que el catálogo se actualice solo, todas las noches, desde la
lista oficial del proveedor, sin que nadie toque nada — y que si la descarga
sale mal, el sync **aborte** en vez de destruir el catálogo.

**Arquitectura:** un módulo `src/sync/` con tres piezas puras y testeables
(descargar / verificar / aplicar) y un orquestador delgado. El script actual
`src/migrate/importar-lista.js` mezcla las tres cosas con E/S y `console.log`,
por eso hoy no se puede testear ni una línea de la lógica de importación.

**Stack:** Node ≥20 ESM, `node:test`, cero dependencias de producción.

**Spec:** `docs/superpowers/specs/2026-08-14-axtech-overhaul-design.md`

## Hallazgo que habilita esta fase

La lista de precios se descarga **sin login, sin sesión y sin cookies** desde
una URL fija del proveedor. Verificado el 2026-08-15:

```
HTTP/1.1 200 OK
Content-Type: application/force-download
Content-Disposition: attachment; filename="DD_MM_AAAA_<proveedor>.txt"
574.805 bytes, 6.007 líneas, codificación latin1
```

Por eso el sync puede ser **totalmente automático**, no semiautomático. La URL
contiene el dominio del proveedor: vive en el secreto `SUPPLIER_LIST_URL` y en
`.env`, nunca en el código ni en la documentación.

## Restricciones globales

- Node ≥ 20. Sin dependencias de producción. `sharp` sigue siendo la única
  devDependency.
- Ningún dato de costo, margen, dominio ni nombre del proveedor entra al
  repositorio ni a `dist/`. Las fixtures de test son **sintéticas**.
- La lista descargada se escribe solo en `.local-legacy/listas-proveedor/`
  (ignorada por git) o en un temporal del runner. Nunca en el árbol versionado.
- Todo módulo nuevo bajo `src/sync/` es **puro** salvo `ejecutar.js`: sin
  `fetch`, sin `fs`, sin `console.log` dentro de la lógica de negocio.
- Los tests corren sin red.

## Errores reales que esta fase corrige

Encontrados al leer el código antes de planear:

1. **Reutilización de ids tras la purga.** `importar-lista.js` calcula
   `maxId = Math.max(...ids)`. Si la purga borra los ids más altos, un producto
   nuevo recibe un id ya usado y **hereda la imagen cacheada del producto
   borrado** (`public/img/{id}.webp`). Se arregla con `data/meta.json`, que
   guarda un `ultimoId` monótono.
2. **`data/sin-imagen.json` se sobreescribe.** `src/images/ejecutar.js` lo
   reemplaza con los fallos de *esa* corrida. Una corrida interrumpida trunca
   la lista y publica productos sin imagen. Se arregla fusionando.
3. **El tipo de cambio está clavado en el código** (`6164`). Con un sync diario
   eso congela los precios contra la realidad. Pasa a `pricing.config.json`
   (que ya es secreto), con validación de rango.
4. **No hay ningún freno.** Hoy, si la descarga devolviera una página de error,
   `importar-lista.js` ocultaría los 5.279 productos activos y el sitio
   quedaría vacío. La tarea 3 es exactamente eso: los frenos.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/sync/descargar.js` | Bajar la lista. Reintentos, timeout, latin1. Único que toca la red. |
| `src/sync/verificar.js` | Frenos de seguridad. Puro: recibe números, devuelve problemas. |
| `src/sync/aplicar.js` | Fusionar lista + catálogo y purgar. Puro: sin E/S. |
| `src/sync/ejecutar.js` | Orquestador CLI. Único con `fs`, red y `console.log`. |
| `data/meta.json` | `ultimoId` monótono y estado de la última sync. |
| `test/fixtures/lista-*.txt` | Fixtures **sintéticas** en latin1. |
| `.github/workflows/sync.yml` | Cron nocturno. |
| `src/migrate/importar-lista.js` | **Se borra.** Lo reemplaza `ejecutar.js --archivo`. |

---

### Tarea 1: Fixtures sintéticas y endurecimiento del parser

**Archivos:**
- Crear: `test/fixtures/generar.js`, `test/fixtures/lista-ok.txt`, `test/fixtures/lista-rota.txt`
- Modificar: `src/lib/lista-precios.js`
- Test: `test/lib/lista-precios.test.js`

**Interfaces:**
- Produce: `parsearLista(texto) -> Map<string,{titulo,usd}>` (sin cambio de firma).

Las fixtures reproducen el formato real con datos inventados: encabezado de
tres líneas, separadores de `=`, relleno con puntos, refs de 5 y 6 dígitos,
coma decimal con punto de miles, acentos en latin1, pie con líneas de texto
libre. **Ningún ref, título, precio ni nombre real del proveedor.**

- [ ] **Paso 1: escribir el generador de fixtures**

`test/fixtures/generar.js` escribe los `.txt` en latin1 (no se pueden tipear a
mano: llevan bytes >127).

```js
import { writeFileSync } from 'node:fs';

const OK = [
    'Distribuidora Ejemplo - lista de demostracion',
    'Para melhor visualizacao use a fonte Lucida Console.',
    '='.repeat(94),
    '',
    'Lista de precos 01/01/2026 - 09:00:00 ',
    '='.repeat(94),
    linea('100001', 'CABLE DE PRUEBA ACME 1M NEGRO', '1,50'),
    linea('100002', 'MEMÓRIA DDR5 16GB 6000MHZ ACME', '48,90'),
    linea('99999', 'MOUSE ACME M100 ÓPTICO', '9,00'),
    linea('100003', 'PLACA DE VIDEO ACME 8GB', '5.220,00'),
    linea('100004', 'PRODUCTO SIN PRECIO ACME', '0,00'),
    linea('100002', 'MEMÓRIA DDR5 16GB 6000MHZ ACME REV2', '49,90'),
    'linea de basura que no matchea',
    '='.repeat(94),
    '* Todos os precos estao sujeitos a alteracao sem aviso previo.',
    ''
].join('\r\n');

function linea(ref, titulo, precio) {
    const izq = ref + '.'.repeat(Math.max(1, 12 - ref.length));
    const der = 'U$' + precio;
    const relleno = '.'.repeat(Math.max(1, 94 - izq.length - titulo.length - der.length));
    return izq + titulo + relleno + der;
}

writeFileSync('test/fixtures/lista-ok.txt', Buffer.from(OK, 'latin1'));

// Lo que devuelve el servidor cuando algo sale mal: una pagina, no una lista.
const ROTA = '<!DOCTYPE html><html><body><h1>503 Service Unavailable</h1></body></html>\r\n';
writeFileSync('test/fixtures/lista-rota.txt', Buffer.from(ROTA, 'latin1'));

console.log('OK: fixtures generadas.');
```

- [ ] **Paso 2: generarlas y verlas**

```bash
node test/fixtures/generar.js && node -e "console.log(require('fs').readFileSync('test/fixtures/lista-ok.txt','latin1'))"
```

Esperado: el mismo formato de la lista real, con datos inventados.

- [ ] **Paso 3: escribir los tests que fallan**

Agregar a `test/lib/lista-precios.test.js`:

```js
import { readFileSync } from 'node:fs';

const fixtura = readFileSync('test/fixtures/lista-ok.txt', 'latin1');

test('parsea la fixtura completa ignorando encabezado y pie', () => {
    const m = parsearLista(fixtura);
    assert.equal(m.size, 4);              // 5 lineas validas, una duplicada
    assert.equal(m.get('100001').usd, 1.5);
    assert.equal(m.get('100003').usd, 5220);
    assert.equal(m.has('100004'), false); // precio 0 se descarta
});

test('acepta refs de 5 digitos', () => {
    assert.equal(parsearLista(fixtura).get('99999').titulo, 'MOUSE ACME ÓPTICO'.replace(' Ó', ' M100 Ó'));
});

test('ante un ref repetido gana la ultima aparicion', () => {
    assert.match(parsearLista(fixtura).get('100002').titulo, /REV2$/);
});

test('una pagina HTML no produce ningun producto', () => {
    const rota = readFileSync('test/fixtures/lista-rota.txt', 'latin1');
    assert.equal(parsearLista(rota).size, 0);
});
```

- [ ] **Paso 4: correr y confirmar que fallan**

```bash
node --test test/lib/lista-precios.test.js
```

Esperado: FAIL (las fixtures no existían al escribir el parser).

- [ ] **Paso 5: ajustar el parser si hace falta y confirmar verde**

```bash
node --test test/lib/lista-precios.test.js
```

- [ ] **Paso 6: commit**

```bash
git add test/fixtures src/lib/lista-precios.js test/lib/lista-precios.test.js
git commit -m "test: fixtures sinteticas del parser de la lista"
```

---

### Tarea 2: `src/sync/aplicar.js` — la fusión, pura y testeable

**Archivos:**
- Crear: `src/sync/aplicar.js`
- Test: `test/sync/aplicar.test.js`

**Interfaces:**
- Consume: `parsearLista` (tarea 1), `precioFinal`, `clasificar`, `detectarMarca`,
  `normalizarTitulo`, `slugDeProducto`.
- Produce:
  ```js
  aplicarLista({ catalogo, lista, hoy, config, ultimoId })
    -> { catalogo, ultimoId, reporte: { nuevos, revividos, actualizados,
         sinCambio, ocultados, sinClasificar, saltos: [{id,antes,despues,delta}] } }

  purgar({ catalogo, hoy, diasGracia })
    -> { catalogo, purgados: number[] }   // ids borrados
  ```

`aplicarLista` **no muta** el catálogo que recibe: devuelve uno nuevo. Eso es
lo que permite verificar los cambios *antes* de escribirlos a disco.

- [ ] **Paso 1: escribir los tests que fallan**

`test/sync/aplicar.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { aplicarLista, purgar } from '../../src/sync/aplicar.js';

const config = { umbralBarato: 200000, minimoBarato: 20000, minimoBase: 60000, pct: { default: 0.13 }, tipoDeCambio: 6000 };
const lista = new Map([['500001', { titulo: 'MOUSE LOGITECH G203 LIGHTSYNC RGB', usd: 20 }]]);

test('un ref nuevo entra como activo y no reutiliza ids', () => {
    const { catalogo, ultimoId } = aplicarLista({ catalogo: [], lista, hoy: '2026-01-01', config, ultimoId: 7 });
    assert.equal(catalogo.length, 1);
    assert.equal(catalogo[0].id, 8);
    assert.equal(ultimoId, 8);
    assert.equal(catalogo[0].status, 'active');
    assert.equal(catalogo[0].firstSeen, '2026-01-01');
});

test('no muta el catalogo recibido', () => {
    const original = [];
    aplicarLista({ catalogo: original, lista, hoy: '2026-01-01', config, ultimoId: 0 });
    assert.equal(original.length, 0);
});

test('un activo ausente de la lista se oculta y pierde el precio', () => {
    const previo = [{ id: 1, ref: '999', title: 'X', status: 'active', price: 5000, specs: [], lastSeen: '2025-12-01' }];
    const { catalogo, reporte } = aplicarLista({ catalogo: previo, lista, hoy: '2026-01-01', config, ultimoId: 1 });
    const x = catalogo.find((p) => p.ref === '999');
    assert.equal(x.status, 'hidden');
    assert.equal(x.price, undefined);
    assert.equal(x.lastSeen, '2025-12-01', 'lastSeen no se toca al ocultar');
    assert.equal(reporte.ocultados, 1);
});

test('un oculto que reaparece revive con precio nuevo', () => {
    const previo = [{ id: 1, ref: '500001', title: 'viejo', status: 'hidden', lastSeen: '2025-12-01' }];
    const { catalogo, reporte } = aplicarLista({ catalogo: previo, lista, hoy: '2026-01-01', config, ultimoId: 1 });
    assert.equal(catalogo[0].status, 'active');
    assert.equal(catalogo[0].lastSeen, '2026-01-01');
    assert.ok(catalogo[0].price > 0);
    assert.equal(reporte.revividos, 1);
});

test('reporta los saltos de precio grandes', () => {
    const previo = [{ id: 1, ref: '500001', title: 'v', status: 'active', price: 10000, specs: [], lastSeen: '2025-12-01' }];
    const { reporte } = aplicarLista({ catalogo: previo, lista, hoy: '2026-01-01', config, ultimoId: 1 });
    assert.equal(reporte.saltos.length, 1);
    assert.ok(reporte.saltos[0].delta > 1);
});

test('purgar borra los ocultos con mas de 30 dias y respeta a los activos', () => {
    const cat = [
        { id: 1, status: 'hidden', lastSeen: '2025-12-01' },
        { id: 2, status: 'hidden', lastSeen: '2025-12-25' },
        { id: 3, status: 'active', lastSeen: '2025-01-01' }
    ];
    const { catalogo, purgados } = purgar({ catalogo: cat, hoy: '2026-01-01', diasGracia: 30 });
    assert.deepEqual(purgados, [1]);
    assert.equal(catalogo.length, 2);
});
```

- [ ] **Paso 2: correr y confirmar que fallan**

```bash
node --test test/sync/aplicar.test.js
```

Esperado: FAIL, `Cannot find module '../../src/sync/aplicar.js'`.

- [ ] **Paso 3: implementar `src/sync/aplicar.js`**

Portar la lógica de `src/migrate/importar-lista.js` a dos funciones puras:
copia del catálogo con `structuredClone`, `ultimoId` como parámetro en vez de
`Math.max`, `lastSeen` intacto al ocultar (es lo que la purga mide), y el
reporte devuelto en vez de impreso.

- [ ] **Paso 4: correr y confirmar verde**

```bash
node --test test/sync/aplicar.test.js
```

- [ ] **Paso 5: commit**

```bash
git add src/sync/aplicar.js test/sync/aplicar.test.js
git commit -m "feat: aplicar.js, fusion de lista y catalogo pura y testeable"
```

---

### Tarea 3: `src/sync/verificar.js` — los frenos

**Archivos:**
- Crear: `src/sync/verificar.js`
- Test: `test/sync/verificar.test.js`

**Interfaces:**
- Produce:
  ```js
  LIMITES = { minimoLineas: 4000, caidaMaxima: 0.15, ocultadosMaximo: 0.10,
              saltoMaximo: 0.30, saltosMaximo: 0.05,
              tipoDeCambioMin: 3000, tipoDeCambioMax: 15000, purgaMaxima: 0.05 }
  verificarLista({ productosEnLista, productosEnListaPrevia, tipoDeCambio, limites }) -> string[]
  verificarCambios({ reporte, activosPrevios, purgados, totalPrevio, limites }) -> string[]
  ```
  Ambas devuelven un array de problemas. Vacío = seguir. No vacío = abortar.

Sin estos frenos el sync es una bomba: una respuesta 503 del proveedor parsea
como cero productos, y cero productos oculta el catálogo entero.

- [ ] **Paso 1: escribir los tests que fallan**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { verificarLista, verificarCambios, LIMITES } from '../../src/sync/verificar.js';

const base = { productosEnLista: 6000, productosEnListaPrevia: 6000, tipoDeCambio: 6164, limites: LIMITES };

test('una lista sana no reporta problemas', () => {
    assert.deepEqual(verificarLista(base), []);
});

test('una lista vacia se rechaza', () => {
    assert.equal(verificarLista({ ...base, productosEnLista: 0 }).length > 0, true);
});

test('una caida del 20% respecto de la corrida anterior se rechaza', () => {
    const p = verificarLista({ ...base, productosEnLista: 4800 });
    assert.match(p.join(' '), /caida/i);
});

test('un tipo de cambio absurdo se rechaza', () => {
    assert.equal(verificarLista({ ...base, tipoDeCambio: 1 }).length > 0, true);
    assert.equal(verificarLista({ ...base, tipoDeCambio: 90000 }).length > 0, true);
});

test('ocultar mas del 10% de los activos se rechaza', () => {
    const p = verificarCambios({
        reporte: { ocultados: 600, saltos: [], actualizados: 100 },
        activosPrevios: 5000, purgados: [], totalPrevio: 15000, limites: LIMITES
    });
    assert.match(p.join(' '), /ocultar/i);
});

test('purgar mas del 5% del catalogo se rechaza', () => {
    const p = verificarCambios({
        reporte: { ocultados: 0, saltos: [], actualizados: 0 },
        activosPrevios: 5000, purgados: new Array(1000).fill(0), totalPrevio: 15000, limites: LIMITES
    });
    assert.match(p.join(' '), /purga/i);
});

test('un dia normal pasa', () => {
    assert.deepEqual(verificarCambios({
        reporte: { ocultados: 12, saltos: [{}, {}], actualizados: 300 },
        activosPrevios: 5000, purgados: [1, 2], totalPrevio: 15000, limites: LIMITES
    }), []);
});
```

- [ ] **Paso 2: correr y confirmar que fallan**

```bash
node --test test/sync/verificar.test.js
```

- [ ] **Paso 3: implementar `src/sync/verificar.js`**

- [ ] **Paso 4: correr y confirmar verde**

- [ ] **Paso 5: commit**

```bash
git add src/sync/verificar.js test/sync/verificar.test.js
git commit -m "feat: frenos de seguridad del sync"
```

---

### Tarea 4: `src/sync/descargar.js` — la única pieza con red

**Archivos:**
- Crear: `src/sync/descargar.js`
- Test: `test/sync/descargar.test.js`

**Interfaces:**
- Produce:
  ```js
  descargarLista({ url, intentos = 3, timeoutMs = 60000, buscar = fetch })
    -> Promise<{ texto: string, nombreArchivo: string|null, bytes: number }>
  nombreDesdeCabecera(contentDisposition) -> string|null
  ```

`buscar` se inyecta para poder testear sin red. El cuerpo se decodifica con
`TextDecoder('latin1')`: la lista no es UTF-8 y leerla como tal produce
mojibake que `normalize.js` no espera.

- [ ] **Paso 1: escribir los tests que fallan**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { descargarLista, nombreDesdeCabecera } from '../../src/sync/descargar.js';

const respuestaOk = (cuerpo) => ({
    ok: true, status: 200,
    headers: { get: (k) => (k.toLowerCase() === 'content-disposition' ? 'attachment; filename="01_01_2026_Ejemplo.txt"' : null) },
    arrayBuffer: async () => Buffer.from(cuerpo, 'latin1')
});

test('extrae el nombre de la cabecera', () => {
    assert.equal(nombreDesdeCabecera('attachment; filename="01_01_2026_Ejemplo.txt"'), '01_01_2026_Ejemplo.txt');
    assert.equal(nombreDesdeCabecera(null), null);
});

test('decodifica latin1, no utf8', async () => {
    const r = await descargarLista({ url: 'x', buscar: async () => respuestaOk('MEMÓRIA') });
    assert.equal(r.texto, 'MEMÓRIA');
    assert.equal(r.nombreArchivo, '01_01_2026_Ejemplo.txt');
});

test('reintenta ante un fallo transitorio', async () => {
    let n = 0;
    const buscar = async () => { n++; if (n < 3) throw new Error('ECONNRESET'); return respuestaOk('ok'); };
    const r = await descargarLista({ url: 'x', buscar, esperaMs: 0 });
    assert.equal(n, 3);
    assert.equal(r.texto, 'ok');
});

test('se rinde tras agotar los intentos', async () => {
    await assert.rejects(
        descargarLista({ url: 'x', intentos: 2, esperaMs: 0, buscar: async () => { throw new Error('caido'); } }),
        /caido/
    );
});

test('un 500 no se toma como exito', async () => {
    const buscar = async () => ({ ok: false, status: 500, headers: { get: () => null }, arrayBuffer: async () => Buffer.from('') });
    await assert.rejects(descargarLista({ url: 'x', intentos: 1, esperaMs: 0, buscar }), /500/);
});
```

- [ ] **Paso 2: correr y confirmar que fallan**

- [ ] **Paso 3: implementar `src/sync/descargar.js`**

- [ ] **Paso 4: correr y confirmar verde**

- [ ] **Paso 5: commit**

```bash
git add src/sync/descargar.js test/sync/descargar.test.js
git commit -m "feat: descarga de la lista con reintentos y latin1"
```

---

### Tarea 5: tipo de cambio en la config e ids monótonos

**Archivos:**
- Modificar: `src/lib/pricing.js`, `src/lib/lista-precios.js`, `config/pricing.config.json` (local, no versionado), `.env.example`
- Crear: `data/meta.json`
- Test: `test/lib/pricing.test.js`

**Interfaces:**
- Produce: `cargarConfig()` devuelve además `tipoDeCambio`; `leerMeta()/escribirMeta()`
  viven en `src/sync/ejecutar.js` (tarea 6), no en un módulo aparte.

- [ ] **Paso 1: test que falla**

```js
test('la config expone un tipo de cambio dentro de rango', () => {
    const c = cargarConfig();
    assert.equal(typeof c.tipoDeCambio, 'number');
    assert.ok(c.tipoDeCambio > 3000 && c.tipoDeCambio < 15000);
});
```

- [ ] **Paso 2: correr, confirmar FAIL**

- [ ] **Paso 3: agregar `tipoDeCambio: 6164` a `config/pricing.config.json`**

- [ ] **Paso 4: crear `data/meta.json` con el `ultimoId` actual**

```bash
node -e "const c=JSON.parse(require('fs').readFileSync('data/catalog.json','utf8'));const m={ultimoId:Math.max(...c.map(p=>p.id||0)),ultimaSync:null,productosEnLista:null,activos:c.filter(p=>p.status==='active').length};require('fs').writeFileSync('data/meta.json',JSON.stringify(m,null,2)+'\n');console.log(m)"
```

- [ ] **Paso 5: correr toda la suite y commitear**

```bash
npm test && git add data/meta.json src/lib/pricing.js test/lib/pricing.test.js && git commit -m "feat: tipo de cambio configurable e ids monotonos"
```

---

### Tarea 6: `src/sync/ejecutar.js` — el orquestador

**Archivos:**
- Crear: `src/sync/ejecutar.js`
- Borrar: `src/migrate/importar-lista.js`
- Modificar: `package.json` (script `sync`), `src/images/ejecutar.js` (fusión de `sin-imagen.json`), `AGENTS.md`

**Interfaces:**
- Consume: `descargarLista`, `parsearLista`, `verificarLista`, `verificarCambios`,
  `aplicarLista`, `purgar`, `cargarConfig`.

Banderas:
- (ninguna) → simulación: descarga, calcula, informa, no escribe.
- `--aplicar` → escribe `data/catalog.json` y `data/meta.json`.
- `--archivo <ruta>` → usa un `.txt` local en vez de descargar (el runbook manual).
- `--forzar` → ignora los frenos. Solo a mano, nunca en CI.

Orden obligatorio: descargar → parsear → `verificarLista` → `aplicarLista` →
`purgar` → `verificarCambios` → **recién ahí** escribir. Verificar después de
calcular y antes de escribir es lo que hace que un mal día no rompa nada.

- [ ] **Paso 1: implementar el orquestador**

- [ ] **Paso 2: correr en simulación contra la lista real**

```bash
node --env-file=.env src/sync/ejecutar.js --archivo "$(ls -1 .local-legacy/listas-proveedor/*.txt | tail -1)"
```

Esperado: 0 nuevos, 0 ocultados, 0 purgados. Ya está aplicada; cualquier
cambio significaría que la portación de la lógica no es fiel.

- [ ] **Paso 3: correr en simulación descargando**

```bash
node --env-file=.env src/sync/ejecutar.js
```

Esperado: descarga la lista del día, sin cambios grandes.

- [ ] **Paso 4: arreglar la fusión de `sin-imagen.json`**

En `src/images/ejecutar.js`, leer el archivo existente y unir los ids en vez de
reemplazarlos, quitando los que ya tienen imagen en disco.

- [ ] **Paso 5: borrar `importar-lista.js`, actualizar `package.json` y el runbook de `AGENTS.md`**

- [ ] **Paso 6: suite completa y commit**

```bash
npm test && git add -A && git commit -m "feat: orquestador del sync; reemplaza importar-lista"
```

---

### Tarea 7: el workflow nocturno

**Archivos:**
- Crear: `.github/workflows/sync.yml`
- Borrar: `.local-legacy/daily_sync.yml` (queda obsoleto)

Secretos requeridos: `SUPPLIER_LIST_URL`, `SUPPLIER_IMG_BASE`, `PRICING_CONFIG`,
`SUPPLIER_NAME`.

- [ ] **Paso 1: escribir el workflow**

Cron `0 7 * * *` (04:00 de Paraguay) más `workflow_dispatch` con una entrada
`simular` para poder probarlo sin escribir. Pasos: checkout → node → `npm ci`
→ `npm test` → sync `--aplicar` → imágenes de lo nuevo → `git commit` solo si
hay cambios → push. El push dispara `deploy.yml`.

- [ ] **Paso 2: cargar los secretos que falten**

```bash
gh secret set SUPPLIER_LIST_URL --repo <repo>
gh secret set PRICING_CONFIG --repo <repo> < config/pricing.config.json
```

- [ ] **Paso 3: correrlo a mano en modo simulación**

```bash
gh workflow run sync.yml -f simular=true && gh run watch
```

Esperado: verde, sin commit.

- [ ] **Paso 4: commit**

```bash
git add .github/workflows/sync.yml && git rm .local-legacy/daily_sync.yml 2>/dev/null; git commit -m "ci: sync nocturno del catalogo"
```

---

### Tarea 8: las cuatro skills del proyecto

**Archivos:**
- Crear: `.claude/skills/axtech-sync/SKILL.md`, `.claude/skills/axtech-catalog/SKILL.md`,
  `.claude/skills/axtech-pricing/SKILL.md`, `.claude/skills/axtech-release/SKILL.md`

Cada una con frontmatter `name` + `description` y el procedimiento concreto:
qué comando correr, qué esperar, qué hacer cuando falla. Las skills no repiten
lo que ya dice `AGENTS.md`: describen **procedimientos**, no reglas.

- [ ] **Paso 1: escribir las cuatro**
- [ ] **Paso 2: verificar que `npm test` y el build siguen verdes**
- [ ] **Paso 3: commit**

```bash
git add .claude/skills && git commit -m "docs: skills de operacion del proyecto"
```

---

### Tarea 9: cierre

- [ ] Actualizar la tabla de estado y la sección "qué falta" de `AGENTS.md`.
- [ ] `npm test` + `node --env-file=.env src/build/index.js` verdes.
- [ ] Push a `main` y confirmar que el deploy pasa.
