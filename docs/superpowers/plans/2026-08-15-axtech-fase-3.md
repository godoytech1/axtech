# AXTECH Fase 3 — Accesibilidad, movimiento y móvil

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el sitio se pueda usar con teclado y lector de pantalla, que respete a quien pide menos movimiento, y que las animaciones dejen de costar rendimiento.

**Architecture:** Correcciones puntuales verificadas una por una en un navegador real, sin reescribir nada. Las tres piezas grandes —tokens de transición por propiedad, foco visible y accesibilidad del modal— se hacen primero porque el resto depende de ellas.

**Tech Stack:** HTML5, CSS3 vanilla, JavaScript ES6+ vanilla. Sin dependencias.

**Spec:** `docs/superpowers/specs/2026-08-14-axtech-overhaul-design.md` (§10)
**Auditoría:** Web Interface Guidelines (vercel-labs), aplicada el 2026-08-15.

## Global Constraints

- **Sin dependencias de producción.**
- **El nombre y dominio del proveedor no aparecen en `dist/`.** El build lo verifica y falla.
- **Presupuestos**: `index.css` ≤ 25 KB gzip, `app.js` ≤ 60 KB gzip.
- **Cada corrección se verifica en un navegador real**, no a ojo sobre el código.
- **Commits frecuentes.**

## Hallazgos de la auditoría (2026-08-15)

| Archivo | Hallazgo |
|---|---|
| `index.css:34` | `--transition: all 0.3s`, usado en **25 lugares** |
| `index.css:1181` | `transition: all 0.3s ease` |
| `index.css:82` | `outline: none` sin reemplazo de foco |
| `index.css` | Sin `:focus-visible`, sin `prefers-reduced-motion`, sin `color-scheme`, sin `touch-action`, sin `overscroll-behavior`, sin `tabular-nums` |
| `index.html:53` | `#search-input` sin etiqueta; placeholder con `...` en vez de `…` |
| `index.html` | Modal sin `role="dialog"` ni `aria-modal`; contador sin `aria-live`; jerarquía `h1 → h3 → h4`; sin skip link; sin `theme-color`; **4 botones solo-icono sin `aria-label`**; **30 iconos sin `aria-hidden`** |
| `app.js:1792,2101` | `<img>` sin `width`/`height` |
| `app.js` | El modal no atrapa ni restaura el foco |

## Lo que esta fase NO hace, y por qué

**Sin skeletons de carga.** El spec (§10) los pedía en reemplazo del spinner
con demora falsa. Esa demora ya se eliminó en la Fase 1B, así que el spinner
prácticamente no llega a verse: el render es inmediato. Agregar skeletons
ahora sería resolver un problema que ya no existe.

**Sin rediseño móvil.** El spec observaba "solo 6 media queries para 3.070
líneas". Esta fase agrega lo que es corrección objetiva (zonas seguras,
`touch-action`, sin desbordes) y verifica a 390 px, pero no rediseña. Un
rediseño necesita decisiones de producto —qué se muestra primero en una
pantalla chica— que no son técnicas, y conviene tomarlas mirando la analítica
que se activó hace unos días, no de antemano.

## Por qué `transition: all` importa

No es purismo. `all` hace que el navegador vigile **todas** las propiedades
animables de cada elemento con esa regla, incluidas las que provocan
recálculo de layout. Con 36 tarjetas en pantalla y 25 reglas usándolo, cada
hover dispara trabajo que no hacía falta. Listar `transform` y `opacity`
—las dos que la GPU compone sin tocar el layout— lo elimina.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `index.css` | Tokens de transición, foco visible, movimiento reducido, táctil |
| `index.html` | Etiquetas, roles ARIA, skip link, jerarquía de encabezados |
| `app.js` | Foco del modal, dimensiones de imagen, `aria-live` |
| `src/build/plantillas.js` | Mismas correcciones en las páginas estáticas |

---

## Task 1: Transiciones por propiedad y movimiento reducido

**Files:**
- Modify: `index.css:34`, `index.css:1181`, y el final del archivo

- [ ] **Step 1: Reemplazar el token global**

En `index.css:34`, reemplazar:

```css
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

por tres tokens de propósito explícito:

```css
    /* Nunca "all": obliga al navegador a vigilar todas las propiedades
       animables, incluidas las que recalculan layout. transform y opacity
       las compone la GPU sin tocar el layout. */
    --transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  border-color 0.3s ease,
                  background-color 0.3s ease,
                  color 0.3s ease,
                  box-shadow 0.3s ease;
    --transition-rapida: transform 0.15s ease, opacity 0.15s ease;
```

Las 25 reglas que usan `var(--transition)` siguen funcionando sin tocarlas.

- [ ] **Step 2: Corregir la transición suelta**

En `index.css:1181`, reemplazar `transition: all 0.3s ease;` por
`transition: var(--transition);`.

- [ ] **Step 3: Verificar que no quedan `transition: all`**

Run: `grep -n "transition: *all" index.css || echo "OK: ninguna"`
Expected: `OK: ninguna`.

- [ ] **Step 4: Honrar `prefers-reduced-motion`**

Al final de `index.css`:

```css
/* ======================================================================
   MOVIMIENTO REDUCIDO
   ====================================================================== */
/* Quien lo pide suele hacerlo por mareo o migrana. No se elimina el
   movimiento del todo: se reduce a un valor imperceptible para que las
   transiciones que sirven de senal (un boton que responde) sigan
   existiendo, sin desplazamientos ni escalados. */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}
```

- [ ] **Step 5: Verificar en el navegador**

```bash
node --env-file=.env src/build/index.js
npx --yes serve dist -l 4173
```

En la consola del navegador, comprobar que las transiciones ya no son `all`:

```javascript
const c = document.querySelector('.product-card');
getComputedStyle(c).transitionProperty;   // no debe decir "all"
```

- [ ] **Step 6: Commit**

```bash
git add index.css
git commit -m "perf: transiciones por propiedad y soporte de movimiento reducido"
```

---

## Task 2: Foco visible

Hoy `index.css:82` hace `outline: none` sin reemplazo: quien navega con
teclado no ve dónde está parado.

**Files:**
- Modify: `index.css:82` y el final del archivo

- [ ] **Step 1: Ver el contexto de la regla**

Run: `sed -n '75,90p' index.css`

- [ ] **Step 2: Agregar el reemplazo de foco**

Al final de `index.css`:

```css
/* ======================================================================
   FOCO VISIBLE
   ====================================================================== */
/* :focus-visible en vez de :focus: el anillo aparece al navegar con
   teclado, no al hacer clic con el mouse. */
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: 4px;
}

/* El anillo por defecto solo se quita cuando :focus-visible ya lo repone. */
:where(a, button, input, select, textarea):focus:not(:focus-visible) {
    outline: none;
}

/* Agrupacion: la tarjeta entera se marca cuando el foco cae adentro. */
.product-card:focus-within,
.producto a:focus-visible,
.relacionado:focus-visible {
    border-color: var(--border-hover);
}
```

- [ ] **Step 3: Verificar que el `outline: none` original no deja nada sin foco**

Si `index.css:82` aplica a un elemento interactivo, agregarle su
`:focus-visible`. Si aplica a un contenedor no interactivo, dejarlo.

Run: `sed -n '78,84p' index.css`

- [ ] **Step 4: Verificar con el teclado**

Abrir el sitio y recorrerlo con Tab desde el principio. **Cada** parada debe
mostrar un anillo visible: logo, buscador, botones del header, enlaces de
categoría, tarjetas de producto, botones de las tarjetas, paginación.

- [ ] **Step 5: Commit**

```bash
git add index.css
git commit -m "a11y: foco visible con :focus-visible en todos los interactivos"
```

---

## Task 3: Etiquetas y roles

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Etiquetar el buscador**

En `index.html:53`, reemplazar la línea del input por:

```html
                <label for="search-input" class="visualmente-oculto">Buscar productos</label>
                <input type="search" id="search-input" name="q"
                    placeholder="Buscar productos o marcas (Ej: RTX, SSD, Monitor)…"
                    autocomplete="off" spellcheck="false" enterkeyhint="search">
```

`type="search"` da el teclado correcto en móvil, y el placeholder ahora
termina en `…` (un solo carácter) en vez de tres puntos.

- [ ] **Step 2: Agregar la clase de texto solo para lectores**

Al final de `index.css`:

```css
/* Visible para lectores de pantalla, invisible en pantalla. */
.visualmente-oculto {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* El skip link aparece solo al recibir foco. */
.saltar-al-contenido {
    position: absolute;
    top: -100px;
    left: 1rem;
    z-index: 9999;
    padding: 0.75rem 1.25rem;
    background: var(--color-primary);
    color: var(--bg-main);
    font-weight: 600;
    border-radius: var(--radius);
    text-decoration: none;
    transition: top 0.2s ease;
}
.saltar-al-contenido:focus { top: 1rem; }
```

- [ ] **Step 3: Agregar el skip link**

Justo después de `<body>` en `index.html`:

```html
    <a href="#catalog-section" class="saltar-al-contenido">Saltar al catálogo</a>
```

- [ ] **Step 4: Poner `aria-label` en los 4 botones solo-icono**

```html
<button id="search-clear-btn" class="search-clear-btn" aria-label="Limpiar búsqueda"><i class="las la-times" aria-hidden="true"></i></button>
<button class="mobile-nav-close" id="mobile-nav-close" aria-label="Cerrar menú"><i class="las la-times" aria-hidden="true"></i></button>
<button class="cart-drawer-close" id="cart-drawer-close" aria-label="Cerrar carrito"><i class="las la-times" aria-hidden="true"></i></button>
<button class="modal-close" id="product-modal-close" aria-label="Cerrar detalle del producto"><i class="las la-times" aria-hidden="true"></i></button>
```

- [ ] **Step 5: Ocultar los iconos decorativos a los lectores**

Los 30 `<i class="la...">` restantes son decorativos: el texto que los
acompaña ya dice lo mismo. Agregarles `aria-hidden="true"`:

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
let h = readFileSync('index.html', 'utf8');
// Solo los que aun no lo tienen.
h = h.replace(/<i class=\"(la[bs] [^\"]*)\"(?![^>]*aria-hidden)/g, '<i class=\"\$1\" aria-hidden=\"true\"');
writeFileSync('index.html', h, 'utf8');
"
grep -c 'aria-hidden="true"' index.html
```

- [ ] **Step 6: Marcar el modal y el drawer como diálogos**

```html
<div class="modal" id="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-titulo">
```

```html
<div class="cart-drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-label="Carrito de compras">
```

```html
<div class="mobile-nav" id="mobile-nav" role="dialog" aria-modal="true" aria-label="Menú de categorías">
```

- [ ] **Step 7: Anunciar los resultados a los lectores**

El contador cambia al filtrar y buscar, pero un lector de pantalla no se
entera. En `index.html`, reemplazar la línea del contador por:

```html
                    <p class="section-subtitle" id="catalog-results-count" aria-live="polite" role="status">Mostrando productos</p>
```

- [ ] **Step 8: Corregir la jerarquía de encabezados**

Hoy va `h1 → h3 → h4`, saltando `h2`. El `h1` es el logo AXTECH; el título
del catálogo debe ser `h2`.

```bash
grep -n '<h3 class="section-title" id="catalog-title"' index.html
```

Cambiar ese `<h3>`/`</h3>` por `<h2>`/`</h2>`, y los `<h4>` de las secciones
del footer y del carrito por `<h3>`.

- [ ] **Step 9: Agregar `theme-color` y `color-scheme`**

En el `<head>` de `index.html`:

```html
    <meta name="theme-color" content="#060b18">
```

Y en `index.css`, dentro de `:root`:

```css
    color-scheme: dark;
```

Esto hace que los controles nativos (barras de scroll, `<select>`) se
dibujen oscuros en vez de blancos sobre el fondo oscuro.

- [ ] **Step 10: Verificar**

```bash
node --env-file=.env src/build/index.js
grep -c 'aria-label' dist/index.html
grep -c 'aria-hidden' dist/index.html
grep -c 'role="dialog"' dist/index.html
```

Con el sitio abierto, recorrer con Tab: el skip link debe aparecer primero.

- [ ] **Step 11: Commit**

```bash
git add index.html index.css
git commit -m "a11y: etiquetas, roles de dialogo, skip link y jerarquia de encabezados"
```

---

## Task 4: Foco del modal y del carrito

Hoy se puede tabular "por detrás" de un diálogo abierto, y al cerrarlo el
foco se pierde al principio de la página.

**Files:**
- Modify: `app.js`

**Interfaces:**
- Produces: `atraparFoco(contenedor) => function` (devuelve la función que suelta el foco)

- [ ] **Step 1: Agregar el utilitario de foco**

En `app.js`, antes de `openProductModal`:

```javascript
    // ----------------------------------------------------------------------
    // FOCO EN DIALOGOS
    // ----------------------------------------------------------------------
    // Sin esto se puede tabular "por detras" de un dialogo abierto, y al
    // cerrarlo el foco vuelve al principio de la pagina en vez de al boton
    // que lo abrio.
    const SELECTOR_ENFOCABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function atraparFoco(contenedor) {
        const previo = document.activeElement;
        const enfocables = () => [...contenedor.querySelectorAll(SELECTOR_ENFOCABLE)]
            .filter((el) => el.offsetParent !== null);

        const alTeclear = (e) => {
            if (e.key !== 'Tab') return;
            const lista = enfocables();
            if (lista.length === 0) return;
            const primero = lista[0];
            const ultimo = lista[lista.length - 1];
            if (e.shiftKey && document.activeElement === primero) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault();
                primero.focus();
            }
        };

        document.addEventListener('keydown', alTeclear);
        enfocables()[0]?.focus();

        return function soltarFoco() {
            document.removeEventListener('keydown', alTeclear);
            if (previo && document.contains(previo)) previo.focus();
        };
    }
```

- [ ] **Step 2: Usarlo en el modal de producto**

Declarar junto a las demás variables de estado:

```javascript
    let soltarFocoModal = null;
```

Al final de `openProductModal`, después de mostrar el modal:

```javascript
        soltarFocoModal = atraparFoco(productModal);
```

Al principio de `closeProductModal`:

```javascript
        if (soltarFocoModal) { soltarFocoModal(); soltarFocoModal = null; }
```

- [ ] **Step 3: Usarlo en el carrito y en el menú móvil**

Declarar junto a `soltarFocoModal`:

```javascript
    let soltarFocoCarrito = null;
    let soltarFocoMenu = null;
```

Al final de `openCartDrawer`:

```javascript
        soltarFocoCarrito = atraparFoco(cartDrawer);
```

Al principio de `closeCartDrawer`:

```javascript
        if (soltarFocoCarrito) { soltarFocoCarrito(); soltarFocoCarrito = null; }
```

Al final de `openMobileMenu`:

```javascript
        soltarFocoMenu = atraparFoco(mobileNav);
```

Al principio de `closeMobileMenu`:

```javascript
        if (soltarFocoMenu) { soltarFocoMenu(); soltarFocoMenu = null; }
```

- [ ] **Step 4: Cerrar con Escape**

Verificar si ya existe un manejador de `Escape`:

```bash
grep -n "Escape" app.js
```

Si no existe, agregarlo después de la definición de `atraparFoco`:

```javascript
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (soltarFocoModal) closeProductModal();
        else if (soltarFocoCarrito) closeCartDrawer();
        else if (soltarFocoMenu) closeMobileMenu();
    });
```

- [ ] **Step 5: Dimensionar las imágenes que faltan**

En `app.js:1792` (modal) y `app.js:2101` (sugerencias), agregar `width` y
`height` a los `<img>`, con los tamaños que ya usa el CSS.

- [ ] **Step 6: Verificar con el teclado**

Con el sitio abierto:
- Abrir el modal con Enter sobre "ver detalle": el foco debe entrar al modal.
- Tabular: no debe salirse del modal.
- Escape: cierra, y el foco vuelve al botón que lo abrió.
- Repetir con el carrito y con el menú móvil.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "a11y: atrapado y restauracion del foco en modal, carrito y menu"
```

---

## Task 5: Táctil, scroll y números

**Files:**
- Modify: `index.css`

- [ ] **Step 1: Agregar los ajustes táctiles y de scroll**

Al final de `index.css`:

```css
/* ======================================================================
   TACTIL Y SCROLL
   ====================================================================== */
/* touch-action: manipulation elimina el retardo de 300ms que algunos
   navegadores moviles aplican esperando un doble toque. */
button,
a,
.product-card,
.nav-link,
.sidebar-link,
.mobile-nav-link {
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 242, 254, 0.2);
}

/* Sin esto, al llegar al final del scroll dentro de un panel el gesto
   sigue desplazando la pagina de atras. */
.cart-drawer,
.mobile-nav,
.modal {
    overscroll-behavior: contain;
}

/* Los precios se leen en columna: con ancho fijo por digito no bailan. */
.price-main,
.producto-precio,
.ficha-precio,
.relacionado-precio,
.cart-total-price,
.cart-item-price {
    font-variant-numeric: tabular-nums;
}

/* Zonas seguras en pantallas con muesca. */
.header,
.footer,
.cart-drawer,
.mobile-nav {
    padding-left: max(1rem, env(safe-area-inset-left));
    padding-right: max(1rem, env(safe-area-inset-right));
}
```

- [ ] **Step 2: Verificar el presupuesto de CSS**

```bash
node --env-file=.env src/build/index.js
gzip -c dist/index.css | wc -c | awk '{printf "index.css: %.0f KB gzip (limite 25)\n", $1/1024}'
```

- [ ] **Step 3: Verificar que no se rompió el diseño**

Revisar la home, una categoría y una ficha, en escritorio y en 390 px de
ancho. El añadido de `padding-left/right` al header y al footer puede alterar
el espaciado: comprobarlo.

- [ ] **Step 4: Commit**

```bash
git add index.css
git commit -m "a11y: ajustes tactiles, contencion de scroll y numeros tabulares"
```

---

## Task 6: Aplicar lo mismo a las páginas estáticas

Las ~5.000 páginas generadas comparten el CSS, así que heredan el foco
visible, el movimiento reducido y lo táctil. Falta lo que vive en su propio
HTML.

**Files:**
- Modify: `src/build/plantillas.js`

- [ ] **Step 1: Agregar `theme-color` y los iconos ocultos**

En la función `cabecera` de `src/build/plantillas.js`, agregar dentro del
`<head>`:

```html
    <meta name="theme-color" content="#060b18">
```

Y en `encabezadoDelSitio` y `paginaDeProducto`, agregar `aria-hidden="true"`
a los `<i class="lab la-whatsapp">`.

- [ ] **Step 2: Agregar el skip link a las páginas generadas**

En `encabezadoDelSitio`, antes del `<header>`:

```html
<a href="#contenido" class="saltar-al-contenido">Saltar al contenido</a>
```

Y en ambas plantillas, cambiar `<main class="container ficha">` y
`<main class="container listado">` por `<main id="contenido" class="...">`.

- [ ] **Step 3: Reconstruir y verificar una página generada**

```bash
node --env-file=.env src/build/index.js
D=$(ls dist/p | head -1)
grep -c 'aria-hidden\|theme-color\|saltar-al-contenido' "dist/p/$D/index.html"
```

- [ ] **Step 4: Commit**

```bash
git add src/build/plantillas.js
git commit -m "a11y: skip link, theme-color e iconos ocultos en las paginas generadas"
```

---

## Task 7: Verificación final y publicación

- [ ] **Step 1: Suite completa y build**

```bash
npm test
node --env-file=.env src/build/index.js
```

- [ ] **Step 2: Repetir la auditoría**

```bash
echo "transition: all -> $(grep -c 'transition: *all' index.css)"
echo ":focus-visible  -> $(grep -c 'focus-visible' index.css)"
echo "reduced-motion  -> $(grep -c 'prefers-reduced-motion' index.css)"
echo "aria-label      -> $(grep -c 'aria-label' dist/index.html)"
echo "aria-hidden     -> $(grep -c 'aria-hidden' dist/index.html)"
echo "role=dialog     -> $(grep -c 'role=\"dialog\"' dist/index.html)"
echo "aria-live       -> $(grep -c 'aria-live' dist/index.html)"
echo "skip link       -> $(grep -c 'saltar-al-contenido' dist/index.html)"
echo "theme-color     -> $(grep -c 'theme-color' dist/index.html)"
echo "color-scheme    -> $(grep -c 'color-scheme' dist/index.css)"
```
Expected: `transition: all` en 0; todo lo demás en 1 o más.

- [ ] **Step 3: Verificar con el teclado, de punta a punta**

Con el sitio local abierto y **solo el teclado**:
1. Tab desde el principio → aparece "Saltar al catálogo".
2. Enter → el foco salta al catálogo.
3. Tab hasta una tarjeta → el anillo de foco es visible.
4. Enter en "ver detalle" → el modal abre y el foco entra.
5. Tab dentro del modal → no se escapa.
6. Escape → cierra y el foco vuelve al botón.
7. Repetir con el carrito.

- [ ] **Step 4: Verificar el movimiento reducido**

En Chrome: DevTools → Rendering → Emulate CSS `prefers-reduced-motion: reduce`.
Recargar y comprobar que las tarjetas ya no se desplazan al pasar el mouse.

- [ ] **Step 5: Verificar en móvil**

Con el ancho en 390 px: la navegación, la ficha y el listado no deben
desbordar horizontalmente.

- [ ] **Step 6: Abrir el PR, fusionar tras el CI en verde, y verificar en producción**

---

## Criterio de aceptación de la Fase 3

- [ ] `npm test` pasa por completo.
- [ ] Cero `transition: all` en `index.css`.
- [ ] Todo elemento interactivo muestra foco visible al navegar con teclado.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Los 4 botones solo-icono tienen `aria-label`.
- [ ] Los iconos decorativos tienen `aria-hidden="true"`.
- [ ] Modal, carrito y menú móvil tienen `role="dialog"` y `aria-modal`.
- [ ] El foco queda atrapado dentro del diálogo abierto y vuelve al abridor al cerrar.
- [ ] Escape cierra el diálogo abierto.
- [ ] El contador de resultados tiene `aria-live="polite"`.
- [ ] Jerarquía de encabezados sin saltos.
- [ ] Skip link presente y funcional, también en las páginas generadas.
- [ ] `theme-color` y `color-scheme: dark` presentes.
- [ ] Todas las `<img>` tienen `width` y `height`.
- [ ] `index.css` sigue bajo 25 KB gzip.
- [ ] Nada desborda horizontalmente a 390 px.
