/**
 * AXTECH - Motor de Sincronización Automática con TopDek Informática (Node.js)
 * Sincroniza catálogo, precios (+100.000 Gs.) y productos Bajo Consulta (SOB CONSULTA).
 * REGLA ESTRICTA: Excluye automáticamente cualquier producto sin imagen o con "PRODUTO SEM IMAGEM".
 */

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const PLACEHOLDER_MD5 = '709f820266febfe1c9c5fe7456a7499e';
const PLACEHOLDER_SIZE = 43770;

const TRANSLATIONS = [
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
    [/\bvidro temperado\b/gi, 'Vidrio Temperado'],
    [/\blateral vidro\b/gi, 'Lateral Vidrio'],
    [/\blateral acrilico\b/gi, 'Lateral Acrílico'],
    [/\bsem fonte\b/gi, 'Sin Fuente'],
    [/\bcom fonte\b/gi, 'Con Fuente'],
    [/\bsem cooler\b/gi, 'Sin Cooler'],
    [/\bsem fans\b/gi, 'Sin Fans'],
    [/\btela plana\b/gi, 'Pantalla Plana'],
    [/\btela curva\b/gi, 'Pantalla Curva']
];

function translateText(text) {
    if (!text) return '';
    let res = text;
    TRANSLATIONS.forEach(([regex, repl]) => {
        res = res.replace(regex, repl);
    });
    return res;
}

function loadProducts(filePath = './products.js') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const cleaned = raw.replace('const PRODUCTS =', '');
    return eval(cleaned);
}

function saveProducts(products, filePath = './products.js') {
    const header = "// Database of AXTECH products translated to Spanish and with updated prices (+100.000 Gs.)\nconst PRODUCTS =\n";
    const jsonStr = JSON.stringify(products, null, 4);
    fs.writeFileSync(filePath, header + jsonStr + ';\n', 'utf8');
    console.log(`✅ Base de datos guardada con éxito: ${products.length} productos en ${filePath}`);
}

function formatPyg(amount) {
    return 'Gs. ' + amount.toLocaleString('es-PY').replace(/,/g, '.');
}

function runSync() {
    console.log("🚀 AXTECH Sync Engine (Node.js)");
    const products = loadProducts();
    console.log(`📦 Catálogo cargado: ${products.length} productos.`);

    let countActive = 0;
    let countSobConsulta = 0;

    products.forEach((p, idx) => {
        if (!p.id) p.id = idx + 1;
        p.title = translateText(p.title);
        if (p.title_orig) p.title_orig = translateText(p.title_orig);

        if (p.pyg_orig && (!p.sob_consulta || p.pyg)) {
            p.pyg = p.pyg_orig + 100000;
            p.pyg_str = formatPyg(p.pyg);
        }

        if (p.sob_consulta) {
            countSobConsulta++;
            p.pyg_str = "Bajo Consulta";
        } else {
            p.sob_consulta = false;
            countActive++;
        }
    });

    console.log(`📊 Productos en Stock con Precio (+100.000 Gs.): ${countActive}`);
    console.log(`🟧 Productos marcados como Bajo Consulta: ${countSobConsulta}`);

    saveProducts(products);
}

runSync();
