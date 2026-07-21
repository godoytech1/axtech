# AXTECH - Documento Maestro de Especificaciones y Reglas del Proyecto

Este archivo contiene la especificación técnica completa, reglas de negocio, estándares de datos y funcionamiento del motor de la tienda e-commerce **AXTECH**. Cualquier agente o asistente de IA debe seguir este documento de forma estricta.

---

## 🏢 1. Información General y Entorno

- **Nombre de la Tienda**: AXTECH
- **Título de la Web / Meta Tag**: `AXTECH | Tu Tienda de Tecnología y Hardware` (Sin agregar "en Paraguay" ni sufijos de país).
- **Dominio de Producción en Vercel**: [https://axtech-py.vercel.app](https://axtech-py.vercel.app)
- **Dominio Alias Secundario**: `axtech-paraguay.vercel.app`
- **Comandos de Despliegue**:
  ```powershell
  npx vercel --prod --yes
  npx vercel alias set <deployment-url> axtech-py.vercel.app
  ```
- **Tecnologías**: HTML5 Semántico, Vanilla CSS3 (diseño moderno con gradientes oscuros y microanimaciones), JavaScript ES6+. Sin dependencias ni frameworks pesados para garantizar velocidad de carga instantánea.

---

## 💰 2. Reglas de Negocio y Precios

- **Distribuidor Origen**: TopDek Informática (Brasil / Paraguay).
- **Regla del Margen de Ganancia**:
  - A TODOS los productos importados al catálogo se les aplica un recargo fijo de **+100.000 Gs.** sobre el precio base de costo del distribuidor en Guaraníes.
  - **Fórmula**: `pyg = pyg_orig + 100000`
- **Regla Estricta de Imágenes ("PRODUTO SEM IMAGEM")**:
  - NUNCA importar ni mostrar productos que no tengan imagen real o que tengan la imagen de relleno por defecto ("PRODUTO SEM IMAGEM").
  - Cualquier producto de TopDek que no posea imagen oficial de producto debe ser descartado durante la sincronización y filtrado en la tienda.

- **Estructura Obligatoria de Objeto de Producto en `products.js`**:
  ```javascript
  {
      "id": 10122,
      "ref": "329967",
      "brand": "JVC",
      "title_orig": "TV 100 JVC LT-100KM958 4K/SMART QDMINI/ATMOS 2.1",
      "title": "TV 100 JVC LT-100KM958 4K/SMART QDMINI/ATMOS 2.1",
      "category": "Televisores",
      "image": "https://www.topdekinformatica.com.br/produtos_img/v/IMG_329967_1.JPG",
      "usd": "US$ 1.250,00",
      "brl": "R$ 6.600,00",
      "pyg_orig": 7950000,
      "pyg_orig_str": "Gs. 7.950.000",
      "pyg": 8050000,
      "pyg_str": "Gs. 8.050.000",
      "orig_url": "https://www.topdekinformatica.com.br/produto/tv-100-jvc-lt-100km958-4k-smart-qdmini-atmos-2-1/329967.html",
      "specs": ["100\"", "4K", "Smart TV"]
  }
  ```

---

## 📊 3. Base de Datos (`products.js`) y Paginación

- **Volumen Total**: **1.940 productos** organizados en 13 categorías principales.
- **Categorías**:
  1. `Notebooks`
  2. `Tarjetas de Video`
  3. `Memorias RAM`
  4. `Fuentes de Poder`
  5. `Procesadores`
  6. `Placas Madre`
  7. `Almacenamiento (SSD)`
  8. `Monitores`
  9. `Periféricos`
  10. `Consolas y Videojuegos`
  11. `Televisores`
  12. `Smart Home / Domótica`
  13. `Relojes Mi Band`
  14. `Gabinetes`
- **Paginación Completa**:
  - Al sincronizar productos con TopDek, NUNCA quedarse solo con la primera página. El scraper debe recorrer recursivamente las páginas de paginación (`/compras-paraguai/paginaX.html`) hasta agotar los productos disponibles.
  - **Validación de Duplicados**: Antes de inyectar un producto nuevo, verificar que su código de referencia (`ref`) NO exista en `products.js`.

---

## 🔤 4. Estándar de Formateo, Nombres y Traducciones

- **Conservación Estricta de Modelos de Hardware**:
  - **Tarjeta de Video (GPU)**: El campo `title` DEBE incluir expresamente la serie/modelo del chip (ej: `RTX 5060`, `RTX 5070`, `RTX 4060`, `RTX 3050`, `RX 7600`, `RX 9070`, `GTX 1660`, `GTX 750`, etc.). NUNCA recortar el modelo para dejar solo "VGA 8GB MSI GAMING".
  - **Procesadores (CPU)**: El campo `title` DEBE incluir expresamente la familia y modelo completo (ej: `i5-12600KF`, `i7-12700KF`, `Ryzen 7 7800X3D`).
- **Traducciones Automáticas (Portugués -> Español)**:
  - `preto` / `preta` -> `Negro`
  - `branco` / `branca` -> `Blanco`
  - `vermelho` / `vermelha` -> `Rojo`
  - `cinza` -> `Gris`
  - `prata` -> `Plata`
  - `azul` -> `Azul`
  - `verde` -> `Verde`
  - `vidro temperado` / `lateral vidro` -> `Vidrio Temperado` / `Lateral Vidrio`
  - `lateral acrilico` -> `Lateral Acrílico`
  - `sem fonte` -> `Sin Fuente`
  - `com fonte` -> `Con Fuente`
  - `sem cooler` / `sem fans` -> `Sin Cooler` / `Sin Fans`
- **Normalización de Marcas (`brand`)**:
  - La marca debe ser limpia y consistente en mayúsculas: `MSI`, `GIGABYTE`, `ASUS`, `ASROCK`, `ZOTAC`, `PALIT`, `GALAX`, `XFX`, `SAPPHIRE`, `BIOSTAR`, `KEEPDATA`, `STAR`, `COOLER MASTER`, `SATELLITE`, `GAMEMAX`, `UP GAMER`, `AIGO`, `DARKFLASH`, `CORSAIR`, `LIAN LI`, `COUGAR`, `REDRAGON`, `ANTEC`, `AEROCOOL`, `NZXT`, `DEEPCOOL`, `HYTE`, `K-MEX`, `MTEK`, `XIAOMI`, `ECOPOWER`, `SMARTFY`, `SONY`, `NINTENDO`, `INTEL`, `AMD`, `JVC`, `SAMSUNG`, `LG`, `TCL`, `PHILIPS`.

---

## 🛠️ 5. Lógica Interactivas en `app.js`

- **Regla del Tamaño de Televisores (`getTvSize`)**:
  ```javascript
  function getTvSize(title) {
      let match = title.match(/(\d{2,3})\s*(?:"|polegadas|inch|'|Pulgadas)/i);
      if (!match) {
          match = title.match(/TV\s+(\d{2,3})/i);
      }
      return match ? match[1] : null;
  }
  ```
  * **CRÍTICO**: El regex DEBE ser `\d{2,3}`. Si se pone `\d{2}`, televisores gigantes de 100 pulgadas se interpretarán erróneamente como de 10 pulgadas y crearán filtros fantasma en la interfaz.

- **Filtro por Chip de Video (`getGpuChip`)**:
  - Clasifica en `AMD` si el título contiene keywords como `radeon`, `amd`, `xfx`, `sapphire`, `powercolor`, `hellhound`, `asrock`, `rx`.
  - Clasifica en `NVIDIA` si contiene `geforce`, `nvidia`, `gt`, `gtx`, `rtx`, `palit`, `zotac`, `galax`, `tuf`, `ventus`, `msi`, `gigabyte`, `asus`.

- **Motor de Búsqueda Inteligente Multipalabra**:
  ```javascript
  const query = searchQuery.toLowerCase().trim();
  const textToSearch = `${p.title} ${p.brand} ${p.ref} ${p.category}`.toLowerCase();
  let searchMatch = true;
  if (query) {
      const queryWords = query.split(/\s+/).filter(word => word.length > 0);
      searchMatch = queryWords.every(word => textToSearch.includes(word));
  }
  ```
  * Exige que TODAS las palabras ingresadas en el buscador coincidan en cualquier parte del texto del producto.

---

## 📣 6. Redes Sociales, Marca y Publicidad

- **Nombre Comercial**: AXTECH (sin la palabra "Paraguay" agregada en títulos ni descripciones públicas).
- **Título Oficial**: `AXTECH | Tu Tienda de Tecnología y Hardware`
- **Redes Oficiales**: WhatsApp, Facebook e Instagram de AXTECH.
- **Prohibiciones en Publicidad/Flyers**:
  - NUNCA publicar o mencionar el enlace directo de las páginas del proveedor/distribuidor.
  - Solo mencionar los canales de contacto directo del negocio AXTECH.

---

## 📝 7. Checklist de Verificación para Agentes

Al realizar modificaciones en este repositorio, verificar:
1. El título de la página y meta descripciones digan sencillamente `AXTECH | Tu Tienda de Tecnología y Hardware`.
2. `products.js` parsea correctamente sin errores sintácticos de JSON (`python -c "import json; json.load(open('products.js'))"`).
3. Todos los precios mantengan el margen de `+100.000 Gs.`.
4. Ninguna tarjeta de video ni procesador haya perdido su modelo exacto (RTX/RX/Core iX).
5. El despliegue en Vercel responda correctamente en `axtech-py.vercel.app`.
