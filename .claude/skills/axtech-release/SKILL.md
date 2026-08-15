---
name: axtech-release
description: Usar antes de publicar cambios, cuando el deploy o CI fallan, cuando el guard de fugas bloquea el build, al agregar archivos que deben servirse en la raiz del sitio, o al revisar que no se filtre nada sensible. Cubre el build, los workflows y Cloudflare Pages.
---

# Publicar

## El camino completo

```
data/catalog.json  ->  src/build/index.js  ->  dist/  ->  Cloudflare Pages
```

Un push a `main` dispara `deploy.yml` y se publica solo. No hay paso manual.

## Antes de pushear

```bash
cd C:\Page
npm test
node --env-file=.env src/build/index.js
```

El build imprime los numeros que hay que mirar: productos publicados, paginas
generadas, cuantas con `noindex`, URLs en el sitemap y archivos revisados por
el guard. Si un numero se mueve mucho sin motivo, ahi hay algo.

## Las cuatro capas que impiden una fuga

1. **`src/lib/contract.js`** — la proyeccion publica es una **whitelist**. Un
   campo nuevo en el catalogo no se publica salvo que se agregue ahi a
   proposito. Nunca convertirla en lista de exclusiones.
2. **`src/build/guard.js`** — recorre **todo** lo generado (no una lista fija
   de archivos) buscando campos prohibidos y el nombre del proveedor. Si
   encuentra algo, el build sale en 1 y no hay despliegue.
3. **`deploy.yml`** — vuelve a revisar `dist/` antes de publicar.
4. **`ci.yml`** — busca campos sensibles y el nombre del proveedor en **todo el
   arbol versionado**, incluida la documentacion.

Campos prohibidos: `pyg_orig`, `pyg_orig_str`, `usd`, `brl`, `orig_url`,
`title_orig`, `titleOrig`, `cost`, `costo`.

## El guard bloqueo el build

No desactivarlo. Encontro algo de verdad. El mensaje dice el archivo y la
cadena. El origen casi siempre es uno de estos:

- un campo nuevo agregado a `contract.js` sin pensarlo
- una URL del proveedor que quedo en un dato o en un comentario
- el nombre del proveedor en documentacion, en un mensaje de commit o en
  `.gitignore` (que **esta versionado**: nombrar algo ahi es publicarlo)

## CI fallo en "Verificar que el proveedor no aparece"

Ese paso busca en todo el arbol versionado. Ya paso dos veces: una porque el
patron de `.gitignore` nombraba al proveedor, y otra porque el nombre de una
lista de precios quedo escrito en un documento de `docs/`.

```bash
# Reproducir local (el nombre esta en .env, no escribirlo en el comando)
grep -rli "$(grep '^SUPPLIER_NAME=' .env | cut -d= -f2-)" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .
```

Los patrones de `.gitignore` tienen que ser **genericos** a proposito.

## Servir un archivo en la raiz del sitio

Todo lo que este en `public/static/` se publica en la raiz. Sirve para los
archivos de verificacion de buscadores sin tocar el build:

```
public/static/google7a3f2b1c9d.html  ->  https://axtech.pages.dev/google7a3f2b1c9d.html
```

Copiar el archivo, commitear, pushear, esperar el deploy.

## Estructura de URLs

```
/                     home (SPA)
/c/{categoria}/       28 categorias
/c/{categoria}/{n}/   paginacion
/p/{slug}/            una por producto
/sitemap.xml          indice de sitemaps
```

Las paginas de producto son **autonomas**: no descargan el catalogo completo.

**Compuerta de calidad** (`src/lib/seo.js`): una pagina se indexa solo si
tiene precio, titulo de 25 caracteres o mas, y marca conocida o al menos una
especificacion. Las demas se generan con `noindex` y quedan fuera del sitemap.
Publicar miles de paginas finas perjudica al dominio entero.

## Deuda tecnica conocida

- `dist/products.js` supera el presupuesto de 150 KB gzip. Afecta a la home y
  a las categorias; las paginas de producto no lo descargan. Se resuelve con
  chunking del catalogo.
- `app.js` sigue en un solo archivo de ~2.000 lineas. Partirlo obliga a
  cambiar la entrega de datos (los modulos ES no ven las globales `PRODUCTS` y
  `CATEGORIES`), asi que va junto con el chunking.
