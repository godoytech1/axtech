const fs = require('fs');
const path = require('path');

console.log("🔍 Iniciando validación del catálogo de AXTECH...");

const productsFilePath = path.resolve(__dirname, '../../../../products.js');
if (!fs.existsSync(productsFilePath)) {
    console.error(`❌ No se encontró el archivo products.js en la ruta: ${productsFilePath}`);
    process.exit(1);
}

let rawContent = fs.readFileSync(productsFilePath, 'utf8');

// Extraer el array JSON de products.js
const jsonStartIndex = rawContent.indexOf('[');
const jsonEndIndex = rawContent.lastIndexOf(']') + 1;
if (jsonStartIndex === -1 || jsonEndIndex === -1) {
    console.error("❌ No se encontró la estructura de array JSON en products.js");
    process.exit(1);
}

const jsonString = rawContent.substring(jsonStartIndex, jsonEndIndex);
let products;
try {
    products = JSON.parse(jsonString);
} catch (e) {
    console.error("❌ Error al parsear el JSON de products.js:", e.message);
    process.exit(1);
}

console.log(`📦 Se cargaron ${products.length} productos para validación.`);

let failures = 0;

// 1. Validar Duplicados
const seenIds = new Set();
const seenRefs = new Set();
const duplicateErrors = [];

products.forEach(p => {
    if (seenIds.has(p.id)) {
        duplicateErrors.push(`ID duplicado encontrado: ${p.id}`);
    }
    seenIds.add(p.id);

    if (p.ref) {
        const cleanRef = String(p.ref).trim();
        if (seenRefs.has(cleanRef)) {
            duplicateErrors.push(`Código de referencia (ref) duplicado encontrado: ${cleanRef}`);
        }
        seenRefs.add(cleanRef);
    }
});

if (duplicateErrors.length > 0) {
    console.error(`\n❌ Errores de duplicados (${duplicateErrors.length}):`);
    duplicateErrors.slice(0, 10).forEach(err => console.error(`   - ${err}`));
    if (duplicateErrors.length > 10) console.error(`   ... y ${duplicateErrors.length - 10} errores más.`);
    failures += duplicateErrors.length;
} else {
    console.log("✅ Sin duplicados de IDs o Referencias.");
}

// 2. Validar Margen de Ganancia (+100.000 Gs.)
const marginErrors = [];
products.forEach(p => {
    if (!p.sob_consulta && p.pyg_orig) {
        const expectedPyg = p.pyg_orig + 100000;
        if (p.pyg !== expectedPyg) {
            marginErrors.push(`ID ${p.id} (ref ${p.ref}): precio local (${p.pyg}) difiere del esperado (${expectedPyg}) para costo original (${p.pyg_orig})`);
        }
    }
});

if (marginErrors.length > 0) {
    console.error(`\n❌ Errores de margen de ganancia (${marginErrors.length}):`);
    marginErrors.slice(0, 10).forEach(err => console.error(`   - ${err}`));
    if (marginErrors.length > 10) console.error(`   ... y ${marginErrors.length - 10} errores más.`);
    failures += marginErrors.length;
} else {
    console.log("✅ Todos los productos activos respetan el margen de ganancia de +100.000 Gs.");
}

// 3. Validar Imágenes (sin marcadores "sem imagem" o vacíos)
const imageErrors = [];
products.forEach(p => {
    if (!p.image || p.image.trim() === '') {
        imageErrors.push(`ID ${p.id} (ref ${p.ref}): URL de imagen vacía.`);
    } else if (p.image.toLowerCase().includes('sem_imagem') || p.image.toLowerCase().includes('sem-imagem')) {
        imageErrors.push(`ID ${p.id} (ref ${p.ref}): Contiene imagen de relleno ("sem imagem").`);
    }
});

if (imageErrors.length > 0) {
    console.error(`\n❌ Errores de imagen (${imageErrors.length}):`);
    imageErrors.slice(0, 10).forEach(err => console.error(`   - ${err}`));
    if (imageErrors.length > 10) console.error(`   ... y ${imageErrors.length - 10} errores más.`);
    failures += imageErrors.length;
} else {
    console.log("✅ Sin productos con imágenes faltantes o placeholders genéricos.");
}

// 4. Validar Normalización de Marcas
const brandErrors = [];
const VALID_BRANDS = new Set([
    'MSI', 'GIGABYTE', 'ASUS', 'ASROCK', 'ZOTAC', 'PALIT', 'GALAX', 'XFX', 'SAPPHIRE',
    'COOLER MASTER', 'SATELLITE', 'GAMEMAX', 'UP GAMER', 'AIGO', 'DARKFLASH', 'CORSAIR',
    'LIAN LI', 'COUGAR', 'REDRAGON', 'ANTEC', 'AEROCOOL', 'NZXT', 'DEEPCOOL', 'HYTE',
    'K-MEX', 'MTEK', 'XIAOMI', 'ECOPOWER', 'SMARTFY', 'SONY', 'NINTENDO', 'INTEL', 'AMD',
    'JVC', 'SAMSUNG', 'LG', 'TCL', 'PHILIPS', 'DELL', 'HP', 'LENOVO', 'ACER', 'PATRIOT',
    'KINGSTON', 'AOC', 'VIEWSONIC', 'BENQ', 'DAHUA', 'KEEPDATA', 'NAKATOMI', 'APPLE',
    'HYE', 'TEROS', 'KOLKE', 'BIOSTAR', 'STAR', 'LOGITECH', 'HYPERX', 'RAZER', 'JBL', 'GENERIC'
]);

products.forEach(p => {
    if (p.brand && !VALID_BRANDS.has(p.brand.toUpperCase())) {
        brandErrors.push(`ID ${p.id} (ref ${p.ref}): Marca '${p.brand}' no está normalizada.`);
    }
});

if (brandErrors.length > 0) {
    console.error(`\n❌ Errores de normalización de marcas (${brandErrors.length}):`);
    brandErrors.slice(0, 10).forEach(err => console.error(`   - ${err}`));
    if (brandErrors.length > 10) console.error(`   ... y ${brandErrors.length - 10} errores más.`);
    failures += brandErrors.length;
} else {
    console.log("✅ Todas las marcas están normalizadas.");
}

console.log("\n--------------------------------------------------");
if (failures > 0) {
    console.error(`❌ Validación fallida con ${failures} errores en total.`);
    process.exit(1);
} else {
    console.log("✨ Catálogo verificado con éxito. ¡Todo en orden!");
    process.exit(0);
}
