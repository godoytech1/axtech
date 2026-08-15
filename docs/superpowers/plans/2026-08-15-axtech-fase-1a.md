# AXTECH Fase 1A — Datos: taxonomía, normalización y precios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reparar la calidad del catálogo — texto corrupto, clasificación rota y precios incoherentes — dejando 24 categorías reales en lugar de un cajón de sastre con el 41% de los productos, y precios con margen sano.

**Architecture:** Tres módulos puros y testeables (`normalize`, `taxonomy`, `pricing`) que se aplican al catálogo mediante un script de refinamiento. El script **no escribe nada** sin el flag `--aplicar`: primero emite un reporte para revisión humana. El orden importa y está validado empíricamente: normalizar → clasificar → tasar.

**Tech Stack:** Node.js ≥ 20 (ESM), `node:test`, sin dependencias de producción.

**Spec:** `docs/superpowers/specs/2026-08-14-axtech-overhaul-design.md`

## Global Constraints

- **Sin dependencias de producción.** Tests con `node:test`, incluido en Node.
- **Node.js ≥ 20.** El CI corre Node 24.
- **Campos prohibidos** en `data/catalog.json` y en todo `dist/`: `pyg_orig`, `pyg_orig_str`, `usd`, `brl`, `orig_url`, `title_orig`, `titleOrig`, `cost`, `costo`.
- **Los porcentajes de margen son secretos.** `config/pricing.config.json` está en `.gitignore`; en CI viene del secreto `PRICING_CONFIG`. Motivo: la fórmula es invertible, así que publicar los porcentajes equivale a publicar los costos.
- **El proveedor nunca se nombra en código versionado.** El CI lo verifica contra el secreto `SUPPLIER_NAME`.
- **Formato de precio**: `Gs. 8.050.000`. Todo precio final es múltiplo de 1.000.
- **Código en español**, coherente con el proyecto.
- **Fuente ASCII pura** en los módulos de `src/lib/`: usar `\p{M}`, `\u00XX` o clases Unicode en vez de caracteres acentuados literales dentro de expresiones regulares (una normalización de editor los rompe silenciosamente).
- **Commits frecuentes**, uno por tarea como mínimo.

## Datos de partida (medidos el 2026-08-15)

Todo lo que sigue está medido sobre el catálogo real, no estimado:

| Dato | Valor |
|---|---|
| Productos activos | 2.524 |
| Productos ocultos | 10.448 |
| En `Periféricos` (cajón de sastre) | **1.043 activos, 41,3%** |
| Marca `GENERIC` | 38,9% del catálogo total |
| Títulos con mojibake o portugués | ~971 |
| Cobertura de clasificación por título (prototipo validado) | **94,6%** |
| Ganancia actual (1 unidad de cada activo) | Gs. 225.250.000 |

## Hallazgos del prototipo que condicionan el diseño

Estos tres puntos se descubrieron probando contra los datos reales. Ignorarlos
produce un catálogo peor que el actual:

1. **`normalize` DEBE correr antes que `taxonomy`.** El título
   `MEM�RIA MARKVISION DDR3L` no matchea ninguna regla de memoria porque el
   mojibake rompió la palabra. Clasificar antes de reparar pierde productos.

2. **Las reglas de dispositivo deben ganarle a las de componente.** Un notebook
   se titula `NOTEBOOK HP VICTUS ... 8GB RAM, 512GB SSD`. Con las reglas de
   componente primero, cae en almacenamiento. Medido: con el orden equivocado
   se clasificaron **15** notebooks; con el orden correcto, **149**.

3. **Los CPU con gráficos integrados caen en tarjetas de video.** El título
   `Procesador AMD Ryzen 5 5600G ... Radeon Graphics` matchea `radeon`. Por eso
   `procesadores` va **antes** que `tarjetas-de-video`, y la regla de GPU exige
   una señal de placa discreta (`placa de video`, `vga`, `rtx`, `gtx`) en vez de
   solo el nombre del chip.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/normalize.js` | **Crear.** Reparar mojibake, traducir PT→ES, limpiar títulos |
| `src/lib/taxonomy.js` | **Crear.** 24 categorías, reglas de clasificación, marcas |
| `src/lib/pricing.js` | **Crear.** Motor de precios híbrido |
| `config/pricing.config.example.json` | **Crear.** Plantilla versionada |
| `config/pricing.config.json` | **Crear.** Real, ignorado por git |
| `src/migrate/refinar-catalogo.js` | **Crear.** Aplica los tres módulos + reporte |
| `src/build/index.js` | **Modificar.** Exportar también `CATEGORIES` |
| `index.html` | **Modificar.** Navegación con las 24 categorías nuevas |
| `app.js` | **Modificar.** Resolver nombres desde `CATEGORIES` |
| `test/lib/normalize.test.js` | **Crear.** |
| `test/lib/taxonomy.test.js` | **Crear.** |
| `test/lib/pricing.test.js` | **Crear.** |
| `AGENTS.md` | **Modificar.** Completar la tabla de reglas ejecutables |

---

## Task 1: Rama de trabajo

**Files:** ninguno (solo git)

**Interfaces:**
- Consumes: nada
- Produces: la rama `feat/fase-1a-datos` sobre la que trabajan las tareas siguientes

- [ ] **Step 1: Crear la rama**

Se trabaja en rama, nunca directo en `main`: `main` dispara el despliegue
automático a Cloudflare Pages.

```bash
cd /c/Page
git checkout -b feat/fase-1a-datos
git status --short
```
Expected: sin cambios pendientes, rama nueva activa.

- [ ] **Step 2: Verificar el punto de partida**

```bash
npm test
node --env-file=.env src/build/index.js
```
Expected: 44 tests en verde y `OK: build completo, 2524 productos publicados.`

---

## Task 2: Normalización de texto (`src/lib/normalize.js`)

Repara los datos que el scraper viejo corrompió. El bug de origen (concatenar
Buffers sin `setEncoding`, partiendo caracteres UTF-8 multibyte) se corrige en
la Fase 4; esta tarea repara el daño ya presente en el catálogo.

**Files:**
- Create: `src/lib/normalize.js`
- Test: `test/lib/normalize.test.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `repararMojibake(texto: string) => string`
  - `traducir(texto: string) => string`
  - `limpiarTitulo(texto: string) => string`
  - `normalizarTitulo(texto: string) => string` (compone las tres anteriores)

- [ ] **Step 1: Escribir el test que falla**

Crear `test/lib/normalize.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    repararMojibake, traducir, limpiarTitulo, normalizarTitulo
} from '../../src/lib/normalize.js';

// El caracter de reemplazo U+FFFD es lo que quedo donde habia una vocal
// acentuada cuando el scraper partio un caracter UTF-8 en dos.

test('repara MEMORIA con vocal perdida', () => {
    assert.equal(repararMojibake('MEM�RIA MARKVISION DDR3L'), 'MEMORIA MARKVISION DDR3L');
});

test('repara VIDEO con vocal perdida', () => {
    assert.equal(repararMojibake('PLACA DE V�DEO ZOTAC RTX5090'), 'PLACA DE VIDEO ZOTAC RTX5090');
});

test('repara RECARREGAVEL con vocal perdida', () => {
    assert.equal(repararMojibake('PILHAS RECARREG�VEL PHILIPS AA'), 'PILHAS RECARREGAVEL PHILIPS AA');
});

test('deja intacto el texto sin corrupcion', () => {
    assert.equal(repararMojibake('MONITOR AOC 24 FULL HD'), 'MONITOR AOC 24 FULL HD');
});

test('quita cualquier caracter de reemplazo que no coincida con un patron conocido', () => {
    const r = repararMojibake('COSA � RARA');
    assert.ok(!r.includes('�'), 'no debe quedar ningun U+FFFD');
});

test('traduce colores del portugues', () => {
    assert.equal(traducir('GABINETE PRETO'), 'GABINETE Negro');
    assert.equal(traducir('MOUSE BRANCO'), 'MOUSE Blanco');
});

test('traduce terminos tecnicos del portugues', () => {
    assert.equal(traducir('CONTROLE SEM FIO'), 'CONTROLE Sin Cable');
    assert.equal(traducir('FONTE 650W'), 'Fuente 650W');
    assert.equal(traducir('TECLADO SEM FIO'), 'TECLADO Sin Cable');
});

test('traduce solo palabras completas', () => {
    // "fontela" contiene "fonte" pero no debe traducirse
    assert.equal(traducir('MARCA FONTELA'), 'MARCA FONTELA');
});

test('normaliza unidades de frecuencia y tiempo de respuesta', () => {
    assert.equal(limpiarTitulo('MONITOR 144 hz 1 ms'), 'MONITOR 144Hz 1Ms');
});

test('colapsa espacios repetidos y recorta', () => {
    assert.equal(limpiarTitulo('  SSD   1TB  '), 'SSD 1TB');
});

test('quita separadores colgando al final', () => {
    assert.equal(limpiarTitulo('TV 32 ECOPOWER HD/SMARTV/HDMI -'), 'TV 32 ECOPOWER HD/SMARTV/HDMI');
    assert.equal(limpiarTitulo('MOUSE LOGITECH,'), 'MOUSE LOGITECH');
});

test('normalizarTitulo aplica reparacion, traduccion y limpieza en orden', () => {
    const entrada = 'MEM�RIA KEEPDATA DDR2 2GB, PRETO  -';
    assert.equal(normalizarTitulo(entrada), 'MEMORIA KEEPDATA DDR2 2GB, Negro');
});

test('normalizarTitulo tolera entrada vacia o no textual', () => {
    assert.equal(normalizarTitulo(''), '');
    assert.equal(normalizarTitulo(null), '');
    assert.equal(normalizarTitulo(undefined), '');
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test "test/lib/normalize.test.js"`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implementar**

Crear `src/lib/normalize.js`:

```javascript
const REEMPLAZO = '�';

// Palabras que el scraper viejo corrompio al partir un caracter UTF-8
// multibyte en el borde de un chunk. Se listan las observadas en el catalogo
// real; el patron busca la palabra con el caracter de reemplazo en el lugar
// de la vocal acentuada.
const REPARACIONES = [
    [/MEM�RIA/gi, 'MEMORIA'],
    [/V�DEO/gi, 'VIDEO'],
    [/RECARREG�VEL/gi, 'RECARREGAVEL'],
    [/CART�O/gi, 'CARTAO'],
    [/BOT�O/gi, 'BOTAO'],
    [/L�MPADA/gi, 'LAMPADA'],
    [/C�MERA/gi, 'CAMERA'],
    [/TR�S/gi, 'TRES'],
    [/GR�FICA/gi, 'GRAFICA']
];

const TRADUCCIONES = [
    [/\bsem fio\b/gi, 'Sin Cable'],
    [/\bcom fio\b/gi, 'Con Cable'],
    [/\bsem fonte\b/gi, 'Sin Fuente'],
    [/\bcom fonte\b/gi, 'Con Fuente'],
    [/\bsem cooler\b/gi, 'Sin Cooler'],
    [/\bcom cooler\b/gi, 'Con Cooler'],
    [/\bvidro temperado\b/gi, 'Vidrio Temperado'],
    [/\blateral vidro\b/gi, 'Lateral Vidrio'],
    [/\blateral acrilico\b/gi, 'Lateral Acrilico'],
    [/\btela plana\b/gi, 'Pantalla Plana'],
    [/\btela curva\b/gi, 'Pantalla Curva'],
    [/\btela\b/gi, 'Pantalla'],
    [/\bplaca de video\b/gi, 'Tarjeta de Video'],
    [/\bfonte de alimentacao\b/gi, 'Fuente de Alimentacion'],
    [/\bfonte\b/gi, 'Fuente'],
    [/\bprocessador\b/gi, 'Procesador'],
    [/\bplaca mae\b/gi, 'Placa Madre'],
    [/\barmazenamento\b/gi, 'Almacenamiento'],
    [/\bpreto\b/gi, 'Negro'],
    [/\bpreta\b/gi, 'Negro'],
    [/\bbranco\b/gi, 'Blanco'],
    [/\bbranca\b/gi, 'Blanco'],
    [/\bvermelho\b/gi, 'Rojo'],
    [/\bvermelha\b/gi, 'Rojo'],
    [/\bcinza\b/gi, 'Gris'],
    [/\bprata\b/gi, 'Plata'],
    [/\bazul\b/gi, 'Azul'],
    [/\bverde\b/gi, 'Verde'],
    [/\bamarelo\b/gi, 'Amarillo'],
    [/\broxo\b/gi, 'Violeta'],
    [/\bfone de ouvido\b/gi, 'Auricular'],
    [/\bcarregador\b/gi, 'Cargador'],
    [/\bcabo\b/gi, 'Cable'],
    [/\bcabos\b/gi, 'Cables'],
    [/\bsuporte\b/gi, 'Soporte'],
    [/\broteador\b/gi, 'Router'],
    [/\bnobreak\b/gi, 'UPS'],
    [/\bcaixa de som\b/gi, 'Parlante'],
    [/\bimpressora\b/gi, 'Impresora'],
    [/\bpilhas?\b/gi, 'Pila'],
    [/\bcadeira\b/gi, 'Silla'],
    [/\bventoinha\b/gi, 'Ventilador'],
    [/\brelogio\b/gi, 'Reloj'],
    [/\bpelicula\b/gi, 'Pelicula']
];

/**
 * Repara el texto corrompido por el scraper viejo.
 * Cualquier U+FFFD que no corresponda a un patron conocido se elimina, para
 * que no llegue nunca a la tienda.
 */
export function repararMojibake(texto) {
    if (typeof texto !== 'string') return '';
    let res = texto;
    for (const [patron, reemplazo] of REPARACIONES) res = res.replace(patron, reemplazo);
    return res.split(REEMPLAZO).join('');
}

/** Traduce del portugues al espanol, solo palabras completas. */
export function traducir(texto) {
    if (typeof texto !== 'string') return '';
    let res = texto;
    for (const [patron, reemplazo] of TRADUCCIONES) res = res.replace(patron, reemplazo);
    return res;
}

/** Normaliza unidades, espacios y separadores colgando. */
export function limpiarTitulo(texto) {
    if (typeof texto !== 'string') return '';
    return texto
        .replace(/\b(\d+)\s*hz\b/gi, '$1Hz')
        .replace(/\b(\d+)\s*ms\b/gi, '$1Ms')
        .replace(/\s+/g, ' ')
        .replace(/[\s,;:\-*]+$/, '')
        .trim();
}

/** Composicion en el orden correcto: reparar, traducir, limpiar. */
export function normalizarTitulo(texto) {
    return limpiarTitulo(traducir(repararMojibake(texto)));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test "test/lib/normalize.test.js"`
Expected: PASS — 13 tests.

- [ ] **Step 5: Verificar que el fuente es ASCII puro**

Run: `LC_ALL=C grep -n '[^ -~]' src/lib/normalize.js || echo "ASCII puro"`
Expected: `ASCII puro`. Si aparece alguna línea, reemplazar el carácter literal
por su secuencia de escape `\uXXXX`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/normalize.js test/lib/normalize.test.js
git commit -m "feat: normalizacion de texto con reparacion de mojibake"
```

---

## Task 3: Taxonomía (`src/lib/taxonomy.js`)

Reemplaza el `detectCategory` del scraper viejo, cuyo valor por defecto
`Periféricos` acumuló el 41,3% de los productos activos.

**Files:**
- Create: `src/lib/taxonomy.js`
- Test: `test/lib/taxonomy.test.js`

**Interfaces:**
- Consumes: `normalizarTitulo` de `src/lib/normalize.js`
- Produces:
  - `CATEGORIAS: Array<{id: string, nombre: string, icono: string}>`
  - `SLUG_PROVEEDOR_A_CATEGORIA: Record<string, string>`
  - `clasificar({titulo: string, slugProveedor?: string}) => string | null`
  - `MARCAS: string[]`
  - `detectarMarca(titulo: string) => string | null`

`clasificar` devuelve `null` cuando no puede decidir. **No existe categoría de
descarte**: quien no resuelve se marca `hidden` y se reporta.

- [ ] **Step 1: Escribir el test que falla**

Crear `test/lib/taxonomy.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CATEGORIAS, SLUG_PROVEEDOR_A_CATEGORIA, clasificar, detectarMarca
} from '../../src/lib/taxonomy.js';

test('hay 26 categorias y ninguna se llama Perifericos', () => {
    assert.equal(CATEGORIAS.length, 26);
    assert.ok(!CATEGORIAS.some((c) => /perif/i.test(c.id)));
});

test('toda categoria usada por una regla existe en CATEGORIAS', async () => {
    // Evita que una regla clasifique hacia una categoria que el front no conoce.
    const ids = new Set(CATEGORIAS.map((c) => c.id));
    const fuente = await import('node:fs').then((fs) =>
        fs.readFileSync('src/lib/taxonomy.js', 'utf8'));
    const usadas = [...fuente.matchAll(/^\s*\['([a-z0-9-]+)',\s*\//gm)].map((m) => m[1]);
    assert.ok(usadas.length > 0, 'no se encontraron reglas');
    for (const id of usadas) {
        assert.ok(ids.has(id), `la regla clasifica hacia una categoria inexistente: ${id}`);
    }
});

test('cada categoria tiene id, nombre e icono, y los ids son unicos', () => {
    const ids = new Set();
    for (const c of CATEGORIAS) {
        assert.ok(c.id && c.nombre && c.icono, `categoria incompleta: ${JSON.stringify(c)}`);
        assert.ok(/^[a-z0-9-]+$/.test(c.id), `id no es slug: ${c.id}`);
        assert.ok(!ids.has(c.id), `id duplicado: ${c.id}`);
        ids.add(c.id);
    }
});

test('todo destino del mapa de slugs existe como categoria', () => {
    const ids = new Set(CATEGORIAS.map((c) => c.id));
    for (const destino of Object.values(SLUG_PROVEEDOR_A_CATEGORIA)) {
        assert.ok(ids.has(destino), `el mapa apunta a una categoria inexistente: ${destino}`);
    }
});

test('el slug del proveedor tiene prioridad sobre el titulo', () => {
    // El titulo dice "notebook" pero el slug dice memoria: gana el slug.
    const r = clasificar({ titulo: 'MEMORIA PARA NOTEBOOK 8GB', slugProveedor: 'memoria-ram-notebook' });
    assert.equal(r, 'memorias-ram');
});

test('un dispositivo le gana a sus componentes', () => {
    // Caso medido: sin esta regla se clasificaron 15 notebooks en vez de 149.
    assert.equal(clasificar({ titulo: 'NOTEBOOK HP VICTUS, CORE I5, 8GB RAM, 512GB SSD' }), 'notebooks');
    assert.equal(clasificar({ titulo: 'NOTEBOOK ACER NITRO RTX 4060 16GB DDR5 1TB NVME' }), 'notebooks');
});

test('un procesador con graficos integrados no es una tarjeta de video', () => {
    // Caso medido: "Radeon Graphics" en un APU lo mandaba a tarjetas de video.
    assert.equal(clasificar({ titulo: 'Procesador AMD RYZEN 5 5600G, RADEON GRAPHICS, AM4' }), 'procesadores');
});

test('clasifica tarjetas de video reales', () => {
    assert.equal(clasificar({ titulo: 'Tarjeta de Video ZOTAC GEFORCE RTX 5090 32GB' }), 'tarjetas-de-video');
    assert.equal(clasificar({ titulo: 'VGA 8GB SAPPHIRE RX 7600 PULSE' }), 'tarjetas-de-video');
});

test('un accesorio de un dispositivo no es el dispositivo', () => {
    assert.equal(clasificar({ titulo: 'Cable LIGHTNING A USB 1M Blanco' }), 'adaptadores-y-cables');
    assert.equal(clasificar({ titulo: 'Pelicula DE VIDRIO PARA IPHONE 13 PRO' }), 'peliculas-y-fundas');
});

test('clasifica las fuentes escritas solo como "Fuente NNNW"', () => {
    // Caso medido: 99 fuentes quedaban sin clasificar por exigir "fonte".
    assert.equal(clasificar({ titulo: 'Fuente 650W GIGABYTE GP-P650G 80+Oro' }), 'fuentes-de-poder');
});

test('clasifica pilas y baterias como energia', () => {
    assert.equal(clasificar({ titulo: 'Pila 27A 12V SUNKING ALKALINA CARTELA 5 UNIDADES' }), 'ups-y-energia');
});

test('clasifica dispositivos zigbee como domotica', () => {
    assert.equal(clasificar({ titulo: 'ZIGBEE ZEMISMART LAMPADA RGB ZB-GU53' }), 'smart-home');
    assert.equal(clasificar({ titulo: 'SONOFF INTERRUPTOR SMART PAREDE T3EU1C' }), 'smart-home');
    assert.equal(clasificar({ titulo: 'TOMADA SMART TP-LINK WIFI TAPO P110' }), 'smart-home');
});

test('devuelve null cuando no puede decidir', () => {
    assert.equal(clasificar({ titulo: 'ARTICULO GENERICO XYZ 12345' }), null);
    assert.equal(clasificar({ titulo: '' }), null);
});

test('detecta marcas conocidas', () => {
    assert.equal(detectarMarca('NOTEBOOK HP VICTUS 15'), 'HP');
    assert.equal(detectarMarca('Tarjeta de Video ZOTAC RTX 5090'), 'ZOTAC');
    assert.equal(detectarMarca('COOLER MASTER HYPER 212'), 'COOLER MASTER');
});

test('la marca mas larga gana cuando una contiene a otra', () => {
    // "COOLER MASTER" contiene "MASTER"; debe devolver la completa.
    assert.equal(detectarMarca('GABINETE COOLER MASTER MB520'), 'COOLER MASTER');
});

test('resuelve alias de marca', () => {
    assert.equal(detectarMarca('TECLADO LOGI MX KEYS'), 'LOGITECH');
});

test('devuelve null si no reconoce la marca', () => {
    assert.equal(detectarMarca('PRODUCTO SIN MARCA CONOCIDA'), null);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test "test/lib/taxonomy.test.js"`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implementar**

Crear `src/lib/taxonomy.js`. **El orden del arreglo `REGLAS` es la lógica**:
primero accesorios (mencionan dispositivos), después dispositivos completos,
después componentes, después periféricos, y al final el resto.

```javascript
export const CATEGORIAS = [
    { id: 'notebooks',              nombre: 'Notebooks',              icono: 'la-laptop' },
    { id: 'pcs-de-escritorio',      nombre: 'PCs de Escritorio',      icono: 'la-desktop' },
    { id: 'tarjetas-de-video',      nombre: 'Tarjetas de Video',      icono: 'la-microchip' },
    { id: 'procesadores',           nombre: 'Procesadores',           icono: 'la-microchip' },
    { id: 'placas-madre',           nombre: 'Placas Madre',           icono: 'la-server' },
    { id: 'memorias-ram',           nombre: 'Memorias RAM',           icono: 'la-memory' },
    { id: 'almacenamiento-ssd',     nombre: 'Almacenamiento',         icono: 'la-hdd' },
    { id: 'fuentes-de-poder',       nombre: 'Fuentes de Poder',       icono: 'la-plug' },
    { id: 'gabinetes',              nombre: 'Gabinetes',              icono: 'la-server' },
    { id: 'refrigeracion',          nombre: 'Refrigeracion',          icono: 'la-snowflake' },
    { id: 'monitores',              nombre: 'Monitores',              icono: 'la-tv' },
    { id: 'teclados',               nombre: 'Teclados',               icono: 'la-keyboard' },
    { id: 'mouses-y-mousepads',     nombre: 'Mouses y Mousepads',     icono: 'la-mouse-pointer' },
    { id: 'auriculares-y-headsets', nombre: 'Auriculares y Headsets', icono: 'la-headphones' },
    { id: 'microfonos',             nombre: 'Microfonos',             icono: 'la-microphone' },
    { id: 'parlantes',              nombre: 'Parlantes',              icono: 'la-volume-up' },
    { id: 'televisores',            nombre: 'Televisores',            icono: 'la-tv' },
    { id: 'consolas-y-videojuegos', nombre: 'Consolas y Videojuegos', icono: 'la-gamepad' },
    { id: 'tablets',                nombre: 'Tablets',                icono: 'la-tablet' },
    { id: 'telefonos-y-celulares',  nombre: 'Telefonos y Celulares',  icono: 'la-mobile' },
    { id: 'relojes-smart',          nombre: 'Relojes Smart',          icono: 'la-clock' },
    { id: 'redes-y-conectividad',   nombre: 'Redes y Conectividad',   icono: 'la-wifi' },
    { id: 'ups-y-energia',          nombre: 'UPS y Energia',          icono: 'la-battery-full' },
    { id: 'smart-home',             nombre: 'Smart Home',             icono: 'la-home' },
    { id: 'adaptadores-y-cables',   nombre: 'Adaptadores y Cables',   icono: 'la-plug' },
    { id: 'peliculas-y-fundas',     nombre: 'Peliculas y Fundas',     icono: 'la-mobile' }
];

/**
 * Categoria del proveedor -> categoria de AXTECH.
 *
 * Es la senal MAS confiable: el scraper sabe de que pagina saco cada producto.
 * El scraper viejo la descartaba y clasificaba por titulo, y por eso el 41,3%
 * de los activos termino en un cajon de sastre.
 *
 * Se consume desde la Fase 4; en la Fase 1A el catalogo todavia no guarda el
 * slug de origen, asi que la clasificacion cae en las reglas por titulo.
 */
export const SLUG_PROVEEDOR_A_CATEGORIA = {
    'notebook-e-pc-notebook': 'notebooks',
    'notebook-e-pc-desktop': 'pcs-de-escritorio',
    'placa-de-video-nvidia': 'tarjetas-de-video',
    'placa-de-video-amd': 'tarjetas-de-video',
    'processador-intel': 'procesadores',
    'processador-amd': 'procesadores',
    'placa-mae-intel': 'placas-madre',
    'placa-mae-amd': 'placas-madre',
    'memoria-ram-desktop': 'memorias-ram',
    'memoria-ram-notebook': 'memorias-ram',
    'armazenamento-ssd-2-5': 'almacenamiento-ssd',
    'armazenamento-ssd-nvme': 'almacenamiento-ssd',
    'fonte-de-energia': 'fuentes-de-poder',
    'perifericos-gabinete': 'gabinetes',
    'perifericos-cooler-e-fans': 'refrigeracion',
    'monitores': 'monitores',
    'perifericos-teclado': 'teclados',
    'perifericos-mouse': 'mouses-y-mousepads',
    'perifericos-mouse-pad': 'mouses-y-mousepads',
    'perifericos-fone-e-headset': 'auriculares-y-headsets',
    'perifericos-microfone': 'microfonos',
    'perifericos-cabos-e-adaptadores': 'adaptadores-y-cables',
    'eletronicos-tv': 'televisores',
    'eletronicos-games-e-consoles': 'consolas-y-videojuegos',
    'eletronicos-tablet': 'tablets',
    'telefonia-smartphone': 'telefonos-y-celulares',
    'apple-iphone': 'telefonos-y-celulares',
    'eletronicos-relogio-e-smartwatch': 'relojes-smart',
    'rede-e-internet-hub': 'redes-y-conectividad',
    'rede-e-internet-roteador': 'redes-y-conectividad',
    'rede-e-internet-repetidor': 'redes-y-conectividad',
    'rede-e-internet-cabo-antena-acessorios': 'redes-y-conectividad',
    'energia-ups': 'ups-y-energia',
    'energia-nobreak': 'ups-y-energia',
    'eletronicos-automacao-inteligente': 'smart-home'
};

// EL ORDEN ES LA LOGICA. No reordenar sin correr los tests.
const REGLAS = [
    // 1. Accesorios: mencionan dispositivos, tienen que resolverse primero.
    ['peliculas-y-fundas',     /\b(pelicula|capa para|case para|funda|protetor de tela|protector de pantalla)\b/i],
    ['adaptadores-y-cables',   /\b(cable|cabo|adaptador|adapter|conversor|extensor|docking|dock station)\b/i],

    // 2. Dispositivos completos: le ganan a los componentes que mencionan.
    ['notebooks',              /\b(notebook|laptop|macbook|mac ?air|ultrabook)\b/i],
    ['pcs-de-escritorio',      /\b(desktop|pc gamer|computador completo|all in one|mac ?pro|mac ?mini|mac ?studio)\b/i],
    ['tablets',                /\b(tablet|ipad)\b/i],
    ['telefonos-y-celulares',  /\b(smartphone|celular|iphone|galaxy [asz]\d|redmi|poco |moto ?[ge])\b/i],
    ['televisores',            /(\bsmart ?tv\b|\btelevisor\b|^tv[ ,]|\btv \d{2,3}\b)/i],
    ['monitores',              /\bmonitor\b/i],
    ['relojes-smart',          /\b(smartwatch|smart ?watch|reloj|relogio|mi ?band|apple watch|galaxy watch)\b/i],
    ['consolas-y-videojuegos', /\b(console|consola|playstation|ps[345]|xbox|nintendo|joystick|dualsense|dualshock|controle|volante|flight simulator|painel de instrumentos)\b/i],

    // 3. Componentes. procesadores ANTES que tarjetas-de-video: los APU
    //    mencionan "Radeon Graphics" y caian mal clasificados.
    ['procesadores',           /\b(procesador|processador|ryzen|core i[3579]|core ultra|pentium|celeron|athlon|threadripper)\b/i],
    ['tarjetas-de-video',      /\b(tarjeta de video|placa de video|\bvga\b|rtx ?\d|gtx ?\d|\brx ?[5-9]\d{3}\b|geforce)\b/i],
    ['placas-madre',           /\b(placa madre|placa mae|motherboard|\bmobo\b)\b/i],
    ['memorias-ram',           /\b(memoria|ddr[2345]|sodimm|udimm)\b/i],
    ['almacenamiento-ssd',     /\b(ssd|nvme|m\.?2|hd externo|\bhdd\b|disco duro|disco rigido|pendrive|pen drive|micro ?sd|cartao de mem)\b/i],
    ['fuentes-de-poder',       /\b(fuente|fonte|\bpsu\b)\b/i],
    ['refrigeracion',          /\b(cooler|ventilador|ventoinha|\bfans?\b|dissipador|pasta termica)\b/i],
    ['gabinetes',              /\b(gabinete|chassi)\b/i],

    // 4. Perifericos concretos (ya no existe la bolsa "Perifericos").
    ['auriculares-y-headsets', /\b(headset|auricular|auriculares|\bfones?\b|earbud|airpods|audifono)\b/i],
    ['microfonos',             /\b(microfono|microfone|\bmic\b)\b/i],
    ['teclados',               /\b(teclado|keyboard)\b/i],
    ['mouses-y-mousepads',     /\b(mouse|mousepad|mouse ?pad)\b/i],
    ['parlantes',              /\b(parlante|caixa de som|speaker|sound ?bar)\b/i],

    // 5. Resto.
    ['redes-y-conectividad',   /\b(router|roteador|repetidor|access point|\bhub\b|antena|placa de rede|wi-?fi usb|powerline)\b/i],
    ['ups-y-energia',          /\b(ups|nobreak|no-?break|estabilizador|filtro de linha|power ?bank|cargador|carregador|pila|pilha|bateria)\b/i],
    ['smart-home',            /\b(alexa|echo dot|smart home|zigbee|sonoff|tomada smart|interruptor smart|lampada inteligente|tomada inteligente|camera ip|automacao)\b/i]
];

/**
 * Decide la categoria de un producto.
 *
 * @param {{titulo: string, slugProveedor?: string}} entrada
 * @returns {string|null} id de categoria, o null si no se puede decidir.
 *   NUNCA devuelve una categoria de descarte: quien no resuelve se oculta y
 *   se reporta, para que el problema sea visible en vez de silencioso.
 */
export function clasificar({ titulo, slugProveedor } = {}) {
    if (slugProveedor && SLUG_PROVEEDOR_A_CATEGORIA[slugProveedor]) {
        return SLUG_PROVEEDOR_A_CATEGORIA[slugProveedor];
    }
    if (typeof titulo !== 'string' || !titulo.trim()) return null;
    const t = titulo.normalize('NFD').replace(/\p{M}/gu, '');
    for (const [id, patron] of REGLAS) {
        if (patron.test(t)) return id;
    }
    return null;
}

export const MARCAS = [
    'COOLER MASTER', 'LIAN LI', 'UP GAMER', 'THERMALTAKE', 'WESTERN DIGITAL',
    'MSI', 'GIGABYTE', 'ASROCK', 'ASUS', 'ZOTAC', 'PALIT', 'GALAX', 'XFX',
    'SAPPHIRE', 'POWERCOLOR', 'SATELLITE', 'GAMEMAX', 'AIGO', 'DARKFLASH',
    'CORSAIR', 'COUGAR', 'REDRAGON', 'ANTEC', 'AEROCOOL', 'NZXT', 'DEEPCOOL',
    'HYTE', 'AZZA', 'K-MEX', 'MTEK', 'XIAOMI', 'ECOPOWER', 'SMARTFY', 'SONY',
    'NINTENDO', 'INTEL', 'AMD', 'NVIDIA', 'JVC', 'SAMSUNG', 'TCL', 'PHILIPS',
    'DELL', 'ALIENWARE', 'LENOVO', 'ACER', 'PATRIOT', 'KINGSTON', 'CRUCIAL',
    'ADATA', 'SEAGATE', 'AOC', 'VIEWSONIC', 'BENQ', 'DAHUA', 'KEEPDATA',
    'NAKATOMI', 'APPLE', 'TEROS', 'KOLKE', 'BIOSTAR', 'LOGITECH', 'HYPERX',
    'RAZER', 'JBL', 'TP-LINK', 'SONOFF', 'ZEMISMART', 'MARKVISION', 'SUNKING',
    'MOZA', 'HP', 'LG'
];

const ALIAS_DE_MARCA = {
    LOGI: 'LOGITECH',
    WD: 'WESTERN DIGITAL',
    TPLINK: 'TP-LINK'
};

/**
 * Detecta la marca en el titulo.
 * Evalua de la marca mas larga a la mas corta para que "COOLER MASTER" no se
 * resuelva como "MASTER", ni "ASROCK" como "ASUS".
 */
const MARCAS_ORDENADAS = [...MARCAS].sort((a, b) => b.length - a.length);

export function detectarMarca(titulo) {
    if (typeof titulo !== 'string') return null;
    const t = titulo.toUpperCase();
    for (const marca of MARCAS_ORDENADAS) {
        if (new RegExp(`\\b${marca.replace(/[-]/g, '\\-')}\\b`).test(t)) return marca;
    }
    for (const [alias, marca] of Object.entries(ALIAS_DE_MARCA)) {
        if (new RegExp(`\\b${alias}\\b`).test(t)) return marca;
    }
    return null;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test "test/lib/taxonomy.test.js"`
Expected: PASS — 17 tests.

El spec hablaba de 24 categorías; son **26** porque `adaptadores-y-cables`
(175 productos medidos) y `peliculas-y-fundas` necesitan existir como destino
real de las reglas de accesorios. El test `toda categoria usada por una regla
existe en CATEGORIAS` impide que vuelva a aparecer esta discrepancia.

- [ ] **Step 5: Verificar cobertura real contra el catálogo**

Este paso valida que la taxonomía sirve antes de aplicarla:

```bash
node --input-type=module -e "
import fs from 'node:fs';
import { clasificar } from './src/lib/taxonomy.js';
import { normalizarTitulo } from './src/lib/normalize.js';
const c = JSON.parse(fs.readFileSync('data/catalog.json','utf8')).filter(p=>p.status==='active');
const res={}; let sin=0;
for (const p of c) { const id=clasificar({titulo:normalizarTitulo(p.title)}); if(id) res[id]=(res[id]||0)+1; else sin++; }
console.log('cobertura:', ((1-sin/c.length)*100).toFixed(1)+'%', '| sin resolver:', sin, 'de', c.length);
Object.entries(res).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('  '+k.padEnd(26)+v));
"
```
Expected: cobertura **≥ 95 %**. El prototipo alcanzó 94,6 % sin las reglas de
pilas y zigbee; con ellas debe superar el umbral. Si queda por debajo, agregar
reglas para los grupos que aparezcan y repetir.

- [ ] **Step 6: Verificar que el fuente es ASCII puro**

Run: `LC_ALL=C grep -n '[^ -~]' src/lib/taxonomy.js || echo "ASCII puro"`
Expected: `ASCII puro`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/taxonomy.js test/lib/taxonomy.test.js
git commit -m "feat: taxonomia de 26 categorias sin cajon de sastre"
```

---

## Task 4: Motor de precios (`src/lib/pricing.js`)

**Files:**
- Create: `src/lib/pricing.js`, `config/pricing.config.example.json`, `config/pricing.config.json`
- Test: `test/lib/pricing.test.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `precioFinal(costo: number, categoria: string, config: object) => number | null`
  - `costoDesdePrecioLegado(precio: number, categoria: string) => number | null`
  - `cargarConfig() => object`

`costoDesdePrecioLegado` invierte la fórmula vieja. Se necesita **una sola vez**,
porque la Fase 0 borró los costos y el modelo nuevo los requiere. Verificado
sobre los 2.524 activos: **2.524 reconstruibles sin ambigüedad, 0 ambiguos**,
porque las tres ramas de la fórmula vieja producen rangos de precio disjuntos.

- [ ] **Step 1: Escribir el test que falla**

Crear `test/lib/pricing.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { precioFinal, costoDesdePrecioLegado } from '../../src/lib/pricing.js';

const CFG = {
    umbralBarato: 200000,
    minimoBarato: 50000,
    minimoBase: 100000,
    pct: { 'tarjetas-de-video': 0.12, 'teclados': 0.25, default: 0.15 }
};

test('aplica el porcentaje cuando supera al minimo', () => {
    // 20.000.000 * 12% = 2.400.000 > 100.000
    assert.equal(precioFinal(20000000, 'tarjetas-de-video', CFG), 22400000);
});

test('aplica el minimo cuando el porcentaje se queda corto', () => {
    // 300.000 * 12% = 36.000 < 100.000 -> gana el minimo
    assert.equal(precioFinal(300000, 'tarjetas-de-video', CFG), 400000);
});

test('usa el minimo reducido debajo del umbral barato', () => {
    // 100.000 * 15% = 15.000 < 50.000 -> gana el minimo barato
    assert.equal(precioFinal(100000, 'sin-categoria', CFG), 150000);
});

test('usa el porcentaje por defecto para categorias sin tarifa propia', () => {
    assert.equal(precioFinal(1000000, 'categoria-desconocida', CFG), 1150000);
});

test('el resultado siempre es multiplo de 1000', () => {
    for (const costo of [53082, 167108, 452557, 1067683, 3705699, 25451530]) {
        const p = precioFinal(costo, 'teclados', CFG);
        assert.equal(p % 1000, 0, `${p} no es multiplo de 1000`);
    }
});

test('el precio siempre supera al costo', () => {
    for (const costo of [1, 1000, 199999, 200000, 25451530]) {
        assert.ok(precioFinal(costo, 'teclados', CFG) > costo);
    }
});

test('la ganancia nunca baja del minimo aplicable', () => {
    assert.ok(precioFinal(150000, 'teclados', CFG) - 150000 >= 50000);
    assert.ok(precioFinal(500000, 'teclados', CFG) - 500000 >= 100000);
});

test('es monotona creciente respecto del costo', () => {
    let previo = 0;
    for (const costo of [50000, 100000, 200000, 500000, 1000000, 5000000]) {
        const p = precioFinal(costo, 'teclados', CFG);
        assert.ok(p > previo, `no crecio: ${costo} -> ${p}`);
        previo = p;
    }
});

test('ningun precio supera el doble del costo', () => {
    for (const costo of [200000, 500000, 1000000, 25451530]) {
        assert.ok(precioFinal(costo, 'teclados', CFG) <= costo * 2);
    }
});

test('devuelve null ante costos invalidos', () => {
    assert.equal(precioFinal(0, 'teclados', CFG), null);
    assert.equal(precioFinal(-5, 'teclados', CFG), null);
    assert.equal(precioFinal(NaN, 'teclados', CFG), null);
    assert.equal(precioFinal(null, 'teclados', CFG), null);
    assert.equal(precioFinal('100000', 'teclados', CFG), null);
});

// --- Inversion de la formula vieja ---

test('invierte la rama barata', () => {
    // costo 150.000 < 200.000 -> precio era 200.000
    assert.equal(costoDesdePrecioLegado(200000, 'Monitores'), 150000);
});

test('invierte la rama estandar', () => {
    // costo 500.000 -> precio era 600.000
    assert.equal(costoDesdePrecioLegado(600000, 'Monitores'), 500000);
});

test('invierte la rama de categorias especiales', () => {
    // GPU/CPU/RAM llevaban +150.000
    assert.equal(costoDesdePrecioLegado(650000, 'Tarjetas de Video'), 500000);
});

test('devuelve null en el rango imposible', () => {
    // Entre 250.000 y 300.000 ninguna rama podia producir un precio.
    assert.equal(costoDesdePrecioLegado(270000, 'Monitores'), null);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test "test/lib/pricing.test.js"`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implementar**

Crear `src/lib/pricing.js`:

```javascript
import { readFileSync } from 'node:fs';

const RUTA_CONFIG = 'config/pricing.config.json';

// Categorias que en el modelo VIEJO llevaban +150.000. Se conservan con sus
// nombres de entonces porque solo se usan para invertir la formula legada.
const ESPECIALES_LEGADO = new Set(['Tarjetas de Video', 'Procesadores', 'Memorias RAM']);

/**
 * Carga los porcentajes de margen.
 *
 * El archivo NO se versiona: la formula es invertible, asi que publicar los
 * porcentajes equivale a publicar los costos. En CI se materializa desde el
 * secreto PRICING_CONFIG.
 */
export function cargarConfig() {
    if (process.env.PRICING_CONFIG) return JSON.parse(process.env.PRICING_CONFIG);
    return JSON.parse(readFileSync(RUTA_CONFIG, 'utf8'));
}

/**
 * Precio de venta segun el modelo hibrido: costo + max(minimo, costo * pct).
 *
 * El maximo entre un piso fijo y un porcentaje garantiza ganancia razonable
 * tanto en un cable de 50.000 como en una placa de 25.000.000. El modelo viejo
 * de recargo fijo daba 0,5% de margen en los productos caros.
 *
 * @returns precio multiplo de 1000, o null si el costo no es valido.
 */
export function precioFinal(costo, categoria, config) {
    if (typeof costo !== 'number' || !Number.isFinite(costo) || costo <= 0) return null;
    const pct = config.pct[categoria] ?? config.pct.default;
    const minimo = costo < config.umbralBarato ? config.minimoBarato : config.minimoBase;
    const bruto = costo + Math.max(minimo, costo * pct);
    return Math.ceil(bruto / 1000) * 1000;
}

/**
 * Reconstruye el costo a partir de un precio calculado con la formula vieja:
 *
 *   costo < 200.000              -> precio = costo +  50.000
 *   categoria especial           -> precio = costo + 150.000
 *   resto                        -> precio = costo + 100.000
 *
 * Las tres ramas producen rangos de precio disjuntos, asi que la inversion es
 * exacta. Verificado sobre los 2.524 activos: 0 ambiguos, 0 imposibles.
 *
 * SOLO para la migracion unica de la Fase 1A. Desde la Fase 4 el costo llega
 * fresco del scraper y esta funcion deja de usarse.
 *
 * @returns el costo, o null si el precio no pudo generarse con esa formula.
 */
export function costoDesdePrecioLegado(precio, categoriaLegada) {
    if (typeof precio !== 'number' || !Number.isFinite(precio) || precio <= 0) return null;
    const recargoAlto = ESPECIALES_LEGADO.has(categoriaLegada) ? 150000 : 100000;

    const candidatos = [];
    const barato = precio - 50000;
    if (barato > 0 && barato < 200000) candidatos.push(barato);
    const alto = precio - recargoAlto;
    if (alto >= 200000) candidatos.push(alto);

    return candidatos.length === 1 ? candidatos[0] : null;
}
```

- [ ] **Step 4: Crear la configuración de precios**

Crear `config/pricing.config.example.json` (se versiona, con valores de ejemplo):

```json
{
  "umbralBarato": 200000,
  "minimoBarato": 50000,
  "minimoBase": 100000,
  "pct": {
    "default": 0.15
  }
}
```

Crear `config/pricing.config.json` (ignorado por git, con los valores reales):

```json
{
  "umbralBarato": 200000,
  "minimoBarato": 50000,
  "minimoBase": 100000,
  "pct": {
    "notebooks": 0.10,
    "pcs-de-escritorio": 0.10,
    "consolas-y-videojuegos": 0.10,
    "telefonos-y-celulares": 0.10,
    "tarjetas-de-video": 0.12,
    "procesadores": 0.12,
    "televisores": 0.12,
    "tablets": 0.12,
    "placas-madre": 0.15,
    "memorias-ram": 0.15,
    "almacenamiento-ssd": 0.15,
    "monitores": 0.15,
    "fuentes-de-poder": 0.18,
    "ups-y-energia": 0.18,
    "gabinetes": 0.20,
    "relojes-smart": 0.20,
    "refrigeracion": 0.22,
    "redes-y-conectividad": 0.22,
    "smart-home": 0.22,
    "teclados": 0.25,
    "mouses-y-mousepads": 0.25,
    "auriculares-y-headsets": 0.25,
    "microfonos": 0.25,
    "parlantes": 0.25,
    "peliculas-y-fundas": 0.30,
    "adaptadores-y-cables": 0.30,
    "default": 0.15
  }
}
```

- [ ] **Step 5: Verificar que la config real no se versiona**

Run: `git check-ignore -v config/pricing.config.json`
Expected: una línea indicando la regla de `.gitignore` que la excluye. Si no
sale nada, **detenerse**: publicarla revelaría los costos.

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `node --test "test/lib/pricing.test.js"`
Expected: PASS — 14 tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pricing.js test/lib/pricing.test.js config/pricing.config.example.json
git commit -m "feat: motor de precios hibrido con piso por categoria"
```

---

## Task 5: Refinamiento del catálogo (`src/migrate/refinar-catalogo.js`)

Aplica los tres módulos al catálogo. **No escribe nada sin `--aplicar`**: el
recálculo cambia el precio de 2.524 productos reales y eso lo aprueba una
persona, no un script.

**Files:**
- Create: `src/migrate/refinar-catalogo.js`

**Interfaces:**
- Consumes: `normalizarTitulo`, `clasificar`, `detectarMarca`, `precioFinal`,
  `costoDesdePrecioLegado`, `cargarConfig`
- Produces: `data/catalog.json` refinado (solo con `--aplicar`)

- [ ] **Step 1: Escribir el script**

Crear `src/migrate/refinar-catalogo.js`:

```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { normalizarTitulo } from '../lib/normalize.js';
import { clasificar, detectarMarca, CATEGORIAS } from '../lib/taxonomy.js';
import { precioFinal, costoDesdePrecioLegado, cargarConfig } from '../lib/pricing.js';

const RUTA = 'data/catalog.json';
const APLICAR = process.argv.includes('--aplicar');

const fmt = (n) => 'Gs. ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const config = cargarConfig();
const catalogo = JSON.parse(readFileSync(RUTA, 'utf8'));
const nombrePorId = new Map(CATEGORIAS.map((c) => [c.id, c.nombre]));

const rep = {
    titulosCambiados: 0, mojibakeReparado: 0, marcasRecuperadas: 0,
    reclasificados: 0, sinClasificarActivos: 0, sinClasificarOcultos: 0,
    preciosRecalculados: 0, costoNoInvertible: 0,
    gananciaVieja: 0, gananciaNueva: 0
};
const cambiosDePrecio = [];

for (const p of catalogo) {
    // 1. Normalizar el titulo.
    const tituloNuevo = normalizarTitulo(p.title);
    if (tituloNuevo !== p.title) {
        rep.titulosCambiados++;
        if (p.title.includes('�')) rep.mojibakeReparado++;
        p.title = tituloNuevo;
    }

    // 2. Recuperar la marca si estaba en GENERIC.
    if (!p.brand || p.brand === 'GENERIC') {
        const marca = detectarMarca(p.title);
        if (marca) { p.brand = marca; rep.marcasRecuperadas++; }
    }

    // 3. Reclasificar. Sin categoria -> se oculta, nunca se descarta en silencio.
    const categoriaLegada = p.category;
    const idNuevo = clasificar({ titulo: p.title });
    if (idNuevo) {
        if (idNuevo !== p.category) rep.reclasificados++;
        p.category = idNuevo;
    } else {
        // El umbral de calidad se mide sobre los activos: son los que se
        // publican. Los ocultos se cuentan aparte para no diluir la senal.
        if (p.status === 'active') rep.sinClasificarActivos++;
        else rep.sinClasificarOcultos++;
        p.status = 'hidden';
        delete p.price;
        delete p.specs;
        continue;
    }

    // 4. Recalcular el precio de los activos.
    if (p.status !== 'active' || typeof p.price !== 'number') continue;
    const costo = costoDesdePrecioLegado(p.price, categoriaLegada);
    if (costo === null) { rep.costoNoInvertible++; continue; }
    const nuevo = precioFinal(costo, p.category, config);
    if (nuevo === null) { rep.costoNoInvertible++; continue; }

    rep.gananciaVieja += p.price - costo;
    rep.gananciaNueva += nuevo - costo;
    if (nuevo !== p.price) {
        cambiosDePrecio.push({ titulo: p.title, cat: p.category, antes: p.price, despues: nuevo });
        rep.preciosRecalculados++;
    }
    p.price = nuevo;
}

// --- Reporte ---
console.log('=== REFINAMIENTO DEL CATALOGO ===\n');
console.log('TEXTO');
console.log(`  titulos modificados:      ${rep.titulosCambiados}`);
console.log(`  mojibake reparado:        ${rep.mojibakeReparado}`);
console.log(`  marcas recuperadas:       ${rep.marcasRecuperadas}`);
console.log('\nCLASIFICACION');
console.log(`  reclasificados:              ${rep.reclasificados}`);
console.log(`  sin clasificar (eran activos): ${rep.sinClasificarActivos}   <-- umbral: max 130`);
console.log(`  sin clasificar (ya ocultos):   ${rep.sinClasificarOcultos}`);

const porCat = {};
for (const p of catalogo) {
    if (p.status !== 'active') continue;
    porCat[p.category] = (porCat[p.category] || 0) + 1;
}
console.log('\n  activos por categoria:');
Object.entries(porCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`    ${(nombrePorId.get(k) || k).padEnd(26)} ${String(v).padStart(5)}`);
});

console.log('\nPRECIOS');
console.log(`  recalculados:             ${rep.preciosRecalculados}`);
console.log(`  costo no invertible:      ${rep.costoNoInvertible}`);
console.log(`  ganancia modelo viejo:    ${fmt(rep.gananciaVieja)}`);
console.log(`  ganancia modelo nuevo:    ${fmt(rep.gananciaNueva)}`);
if (rep.gananciaVieja > 0) {
    const mas = (rep.gananciaNueva / rep.gananciaVieja - 1) * 100;
    console.log(`  diferencia:               ${fmt(rep.gananciaNueva - rep.gananciaVieja)} (${mas.toFixed(0)}% mas)`);
}

const suben = cambiosDePrecio.filter((c) => c.despues > c.antes);
const bajan = cambiosDePrecio.filter((c) => c.despues < c.antes);
console.log(`\n  suben: ${suben.length}   bajan: ${bajan.length}`);
const deltas = suben.map((c) => (c.despues - c.antes) / c.antes).sort((a, b) => a - b);
if (deltas.length) {
    const q = (f) => deltas[Math.floor(deltas.length * f)];
    console.log(`  subida mediana: ${(q(0.5) * 100).toFixed(1)}%  p90: ${(q(0.9) * 100).toFixed(1)}%  max: ${(deltas.at(-1) * 100).toFixed(1)}%`);
}

console.log('\n  LOS 10 QUE MAS SUBEN:');
suben.sort((a, b) => (b.despues - b.antes) - (a.despues - a.antes));
for (const c of suben.slice(0, 10)) {
    const pc = ((c.despues - c.antes) / c.antes * 100).toFixed(0);
    console.log(`    ${fmt(c.antes).padStart(15)} -> ${fmt(c.despues).padStart(15)}  (+${pc.padStart(3)}%)  ${c.titulo.slice(0, 40)}`);
}
if (bajan.length) {
    console.log('\n  LOS 5 QUE MAS BAJAN (quedas mas competitivo):');
    bajan.sort((a, b) => (a.despues - a.antes) - (b.despues - b.antes));
    for (const c of bajan.slice(0, 5)) {
        const pc = ((c.despues - c.antes) / c.antes * 100).toFixed(0);
        console.log(`    ${fmt(c.antes).padStart(15)} -> ${fmt(c.despues).padStart(15)}  (${pc.padStart(4)}%)  ${c.titulo.slice(0, 40)}`);
    }
}

if (APLICAR) {
    writeFileSync(RUTA, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');
    console.log(`\nAPLICADO -> ${RUTA}`);
} else {
    console.log('\nSIMULACION. Nada se escribio.');
    console.log('Para aplicar: node src/migrate/refinar-catalogo.js --aplicar');
}
```

- [ ] **Step 2: Correr en simulación**

Run: `node src/migrate/refinar-catalogo.js`
Expected: el reporte completo, y la última línea `SIMULACION. Nada se escribio.`

Verificar en el reporte:
- `sin clasificar (eran activos)` **≤ 130** (5% de 2.524). Si es mayor, volver a
  la Task 3 y agregar reglas para los grupos que aparezcan. El conteo de los
  que ya estaban ocultos es informativo y no bloquea.
- `costo no invertible` **= 0**. Si es mayor, investigar antes de aplicar.
- Ninguna categoría concentra más del 15% de los activos (ya no debe existir un
  cajón de sastre).

- [ ] **Step 3: Confirmar que el catálogo no se modificó**

Run: `git status --short data/catalog.json`
Expected: sin salida. La simulación no debe tocar el archivo.

- [ ] **Step 4: Commit del script**

```bash
git add src/migrate/refinar-catalogo.js
git commit -m "feat: script de refinamiento del catalogo con reporte previo"
```

- [ ] **Step 5: PARADA OBLIGATORIA — aprobación humana**

Mostrar el reporte al responsable del negocio y **esperar su aprobación
explícita** antes del paso siguiente. Cambia el precio de venta de miles de
productos reales; no es una decisión técnica.

Si pide ajustar márgenes: editar `config/pricing.config.json`, volver al Step 2
y mostrar el reporte nuevo.

- [ ] **Step 6: Aplicar**

Run: `node src/migrate/refinar-catalogo.js --aplicar`
Expected: última línea `APLICADO -> data/catalog.json`.

- [ ] **Step 7: Verificar que no se coló nada sensible**

```bash
grep -cE '"(pyg_orig|usd|brl|orig_url|title_orig)":' data/catalog.json || echo "0 - limpio"
grep -c $'�' data/catalog.json || echo "0 - sin mojibake"
```
Expected: ambos `0`.

- [ ] **Step 8: Commit**

```bash
git add data/catalog.json
git commit -m "feat: catalogo refinado con taxonomia nueva y precios hibridos"
```

---

## Task 6: Exponer las categorías al front

El catálogo ahora guarda ids en formato slug (`teclados`), pero `index.html`
filtra por nombres visibles (`data-category="Periféricos"`) y `app.js` tiene un
mapa de títulos escrito a mano. Sin esta tarea, la navegación deja de funcionar.

**Files:**
- (`src/lib/contract.js` NO se modifica: ya emite `registro.category`, que ahora es el id)
- Modify: `src/build/index.js`
- Modify: `index.html`
- Modify: `app.js`

**Interfaces:**
- Consumes: `CATEGORIAS` de `src/lib/taxonomy.js`
- Produces: la constante global `CATEGORIES` en `dist/products.js`

- [ ] **Step 1: Emitir `CATEGORIES` desde el build**

En `src/build/index.js`, agregar el import:

```javascript
import { CATEGORIAS } from '../lib/taxonomy.js';
```

Y reemplazar la construcción de `contenido` por:

```javascript
const contenido =
    '// Catalogo publico de AXTECH. Generado por src/build/index.js - no editar a mano.\n' +
    'const CATEGORIES =\n' + JSON.stringify(CATEGORIAS) + ';\n' +
    'const PRODUCTS =\n' + JSON.stringify(publicos) + ';\n';
```

- [ ] **Step 2: Generar la navegación desde `CATEGORIES`**

En `index.html`, reemplazar el contenido de `<ul class="nav-links">` por un
único elemento inicial, para que `app.js` genere el resto:

```html
            <ul class="nav-links" id="nav-links">
                <li><a href="#" class="nav-link active" data-category="all"><i class="las la-th-large"></i> Todo</a></li>
            </ul>
```

Hacer lo mismo con `<ul class="mobile-nav-links">`:

```html
        <ul class="mobile-nav-links" id="mobile-nav-links">
            <li><a href="#" class="mobile-nav-link active" data-category="all"><i class="las la-th-large"></i> Todos los Productos</a></li>
        </ul>
```

Y vaciar la lista del `aside` de la barra lateral, dejando solo:

```html
                        <ul class="sidebar-links" id="sidebar-links">
                            <li><button class="sidebar-link active" data-category="all">Todos los Productos</button></li>
                        </ul>
```

- [ ] **Step 3: Construir los enlaces en `app.js`**

En `app.js`, inmediatamente después de las declaraciones de elementos del DOM
(antes de `initSlider`), agregar:

```javascript
    // ----------------------------------------------------------------------
    // NAVEGACION GENERADA DESDE CATEGORIES
    // ----------------------------------------------------------------------
    const NOMBRE_DE_CATEGORIA = Object.fromEntries(
        (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).map(c => [c.id, c.nombre])
    );

    function construirNavegacion() {
        if (typeof CATEGORIES === 'undefined') return;

        const conProductos = CATEGORIES.filter(c =>
            PRODUCTS.some(p => p.category === c.id)
        );

        const navUl = document.getElementById('nav-links');
        const mobileUl = document.getElementById('mobile-nav-links');
        const sidebarUl = document.getElementById('sidebar-links');

        for (const c of conProductos) {
            if (navUl) {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = '#';
                a.className = 'nav-link';
                a.dataset.category = c.id;
                a.innerHTML = `<i class="las ${c.icono}"></i> `;
                a.appendChild(document.createTextNode(c.nombre));
                li.appendChild(a);
                navUl.appendChild(li);
            }
            if (mobileUl) {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = '#';
                a.className = 'mobile-nav-link';
                a.dataset.category = c.id;
                a.innerHTML = `<i class="las ${c.icono}"></i> `;
                a.appendChild(document.createTextNode(c.nombre));
                li.appendChild(a);
                mobileUl.appendChild(li);
            }
            if (sidebarUl) {
                const li = document.createElement('li');
                const b = document.createElement('button');
                b.className = 'sidebar-link';
                b.dataset.category = c.id;
                b.textContent = c.nombre;
                li.appendChild(b);
                sidebarUl.appendChild(li);
            }
        }
    }

    construirNavegacion();
```

**Importante:** `construirNavegacion()` debe ejecutarse **antes** de las líneas
que hacen `document.querySelectorAll('.nav-link')`, `'.sidebar-link'` y
`'.mobile-nav-link'`; si no, esas listas quedan vacías. Mover esas tres
declaraciones (`navLinks`, `sidebarLinks`, `mobileNavLinks`) para después de la
llamada.

- [ ] **Step 4: Reemplazar el mapa de títulos escrito a mano**

En `app.js`, buscar el objeto `categoryNames` dentro de `renderProducts` (tiene
las claves `'Notebooks'`, `'Consolas y Videojuegos'`, etc.) y reemplazar todo el
objeto y su uso por:

```javascript
            catalogTitle.textContent = currentCategory === 'all'
                ? 'Todos los Productos'
                : (NOMBRE_DE_CATEGORIA[currentCategory] || 'Catalogo');
```

- [ ] **Step 5: Corregir la exclusión de televisores**

`updateCategoryBadges` y el filtro de `renderProducts` comparan contra
`'Televisores'`. Reemplazar esa cadena por el id nuevo:

```bash
grep -n "'Televisores'" app.js
```
Cambiar cada aparición de `'Televisores'` por `'televisores'`.

- [ ] **Step 6: Reconstruir y verificar en el navegador**

```bash
node --env-file=.env src/build/index.js
npx --yes serve dist -l 4173
```

Abrir `http://localhost:4173` y comprobar:
- La barra de navegación muestra las categorías nuevas, sin `Periféricos`.
- Al hacer clic en `Teclados` se ven solo teclados.
- El título del catálogo cambia con la categoría.
- El buscador, el carrito y el modal siguen funcionando.
- La consola del navegador no tiene errores.

- [ ] **Step 7: Commit**

```bash
git add src/build/index.js index.html app.js
git commit -m "feat: navegacion generada desde la taxonomia"
```

---

## Task 7: Documentación y publicación

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: todo lo anterior
- Produces: la Fase 1A en `main` y desplegada

- [ ] **Step 1: Completar la tabla de reglas ejecutables en `AGENTS.md`**

Reemplazar las filas marcadas *(Fase 1)* por:

```markdown
| Precios y márgenes | `src/lib/pricing.js` + `config/pricing.config.json` | `test/lib/pricing.test.js` |
| Categorías y marcas | `src/lib/taxonomy.js` | `test/lib/taxonomy.test.js` |
| Traducciones PT→ES y mojibake | `src/lib/normalize.js` | `test/lib/normalize.test.js` |
```

Y agregar bajo "Reglas que no se negocian":

```markdown
8. **Los porcentajes de margen son secretos.** `config/pricing.config.json`
   no se versiona: la fórmula de precios es invertible, así que publicar los
   porcentajes equivale a publicar los costos.
9. **No existe categoría de descarte.** Un producto que no se puede clasificar
   se marca `hidden` y se reporta. Nunca se lo mete en un cajón de sastre.
```

- [ ] **Step 2: Cargar el secreto `PRICING_CONFIG` en GitHub**

El CI necesita la configuración para construir. Cargarla como secreto con el
valor completo de `config/pricing.config.json` (una sola línea JSON).

- [ ] **Step 3: Suite completa y build**

```bash
npm test
node --env-file=.env src/build/index.js
```
Expected: todos los tests en verde (los 44 previos más los nuevos) y el build
completo.

- [ ] **Step 4: Abrir el PR**

```bash
git push -u origin feat/fase-1a-datos
```
Verificar que el CI queda en verde antes de fusionar.

- [ ] **Step 5: Fusionar y verificar el despliegue**

```bash
git checkout main
git merge feat/fase-1a-datos --no-ff -m "feat: Fase 1A - taxonomia, normalizacion y precios hibridos"
git push origin main
```

El workflow `Deploy` publica solo. Verificar en `https://axtech.pages.dev` que
la navegación muestra las categorías nuevas y que los precios son múltiplos de
1.000.

---

## Criterio de aceptación de la Fase 1A

- [ ] `npm test` pasa por completo.
- [ ] Ninguna categoría concentra más del 15% de los productos activos.
- [ ] No existe la categoría `Periféricos`.
- [ ] Menos del 5% de los activos queda sin clasificar.
- [ ] Cero caracteres `U+FFFD` en `data/catalog.json`.
- [ ] La marca `GENERIC` baja de forma medible respecto del 38,9% inicial.
- [ ] Todos los precios activos son múltiplos de 1.000.
- [ ] Ningún precio supera el doble de su costo.
- [ ] `config/pricing.config.json` no está versionado.
- [ ] El reporte de cambio de precios fue aprobado por el responsable del negocio.
- [ ] La navegación del sitio muestra las categorías nuevas y filtra bien.
- [ ] El sitio desplegado funciona igual o mejor que antes.
