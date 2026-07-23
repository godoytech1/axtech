/**
 * AXTECH - Motor Exhaustivo de Sincronización Automática Nocturna con TopDek Informática (Node.js)
 * 1. Recorre de forma exhaustiva TODAS las páginas del catálogo en vivo de TopDek (páginas 1 a 80)
 * 2. Descubre cualquier producto nuevo agregado por TopDek
 * 3. Actualiza precios en Guaraníes (+100.000 Gs. de margen) y marcas/categorías
 * 4. Valida imágenes exhaustivamente descartando cualquier "PRODUTO SEM IMAGEM"
 */

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const PLACEHOLDER_MD5 = '709f820266febfe1c9c5fe7456a7499e';
const PLACEHOLDER_SIZE = 43770;

const TRANSLATIONS = [
    [/\btela plana\b/gi, 'Pantalla Plana'],
    [/\btela curva\b/gi, 'Pantalla Curva'],
    [/\btela\b/gi, 'Pantalla'],
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
    [/\bplaca de video\b/gi, 'Tarjeta de Video'],
    [/\bfonte de alimentacao\b/gi, 'Fuente de Poder'],
    [/\bfonte de energia\b/gi, 'Fuente de Alimentación'],
    [/\bfonte\b/gi, 'Fuente'],
    [/\bprocessador\b/gi, 'Procesador'],
    [/\bplaca mae\b/gi, 'Placa Madre'],
    [/\barmazenamento\b/gi, 'Almacenamiento'],
    [/\bsem fonte\b/gi, 'Sin Fuente'],
    [/\bcom fonte\b/gi, 'Con Fuente'],
    [/\bsem cooler\b/gi, 'Sin Cooler'],
    [/\bcom cooler\b/gi, 'Con Cooler'],
    [/\bsem fans\b/gi, 'Sin Fans'],
    [/\bcom fans\b/gi, 'Con Fans'],
    [/\bvidro temperado\b/gi, 'Vidrio Temperado'],
    [/\blateral vidro\b/gi, 'Lateral Vidrio'],
    [/\blateral acrilico\b/gi, 'Lateral Acrílico'],
    [/\bconector de audio\b/gi, 'Conector de Audio']
];

function translateText(text) {
    if (!text) return '';
    let res = text;
    TRANSLATIONS.forEach(([regex, repl]) => {
        res = res.replace(regex, repl);
    });
    return res;
}

const BRANDS = [
    'MSI', 'GIGABYTE', 'ASUS', 'ASROCK', 'ZOTAC', 'PALIT', 'GALAX', 'XFX', 'SAPPHIRE',
    'COOLER MASTER', 'SATELLITE', 'GAMEMAX', 'UP GAMER', 'AIGO', 'DARKFLASH', 'CORSAIR',
    'LIAN LI', 'COUGAR', 'REDRAGON', 'ANTEC', 'AEROCOOL', 'NZXT', 'DEEPCOOL', 'HYTE',
    'K-MEX', 'MTEK', 'XIAOMI', 'ECOPOWER', 'SMARTFY', 'SONY', 'NINTENDO', 'INTEL', 'AMD',
    'JVC', 'SAMSUNG', 'LG', 'TCL', 'PHILIPS', 'DELL', 'HP', 'LENOVO', 'ACER', 'PATRIOT',
    'KINGSTON', 'AOC', 'VIEWSONIC', 'BENQ', 'DAHUA', 'KEEPDATA', 'NAKATOMI', 'APPLE',
    'HYE', 'TEROS', 'KOLKE', 'BIOSTAR', 'STAR', 'LOGITECH', 'HYPERX', 'RAZER', 'JBL'
];

function detectBrand(title) {
    const t = title.toUpperCase();
    for (const b of BRANDS) {
        if (t.includes(b)) return b;
    }
    return 'GENERIC';
}

function detectCategory(title, slug) {
    const t = (title + ' ' + slug).toUpperCase();
    if (t.includes('SOPORTE') || t.includes('SUPORTE') || t.includes('BRAZO')) return 'Periféricos';
    if (t.includes('MONITOR') || t.includes('MON ') || t.includes('TELA')) return 'Monitores';
    if (t.includes('NOTEBOOK') || t.includes('MACBOOK') || t.includes('LAPTOP')) return 'Notebooks';
    if (t.includes('VGA') || t.includes('RTX') || t.includes('GTX') || t.includes('RADEON') || t.includes('PLACA DE VIDEO') || t.includes('TARJETA DE VIDEO')) return 'Tarjetas de Video';
    if (t.includes('PROCESSADOR') || t.includes('PROCESADOR') || t.includes('RYZEN') || t.includes('CORE I3') || t.includes('CORE I5') || t.includes('CORE I7') || t.includes('CORE I9')) return 'Procesadores';
    if (t.includes('PLACA MAE') || t.includes('PLACA MADRE') || t.includes('MB ') || t.includes('MOTHERBOARD')) return 'Placas Madre';
    if (t.includes('MEMORIA') || t.includes('RAM') || t.includes('DDR4') || t.includes('DDR5')) return 'Memorias RAM';
    if (t.includes('FONTE') || t.includes('FUENTE') || t.includes('PSU')) return 'Fuentes de Poder';
    if (t.includes('GABINETE') || t.includes('CASE')) return 'Gabinetes';
    if (t.includes('TV ') || t.includes('TELEVISOR') || t.includes('SMART TV')) return 'Televisores';
    if (t.includes('SSD') || t.includes('HD ') || t.includes('DISCO') || t.includes('NVME') || t.includes('ALMACENAMIENTO') || t.includes('ARMAZENAMENTO')) return 'Almacenamiento (SSD)';
    if (t.includes('CONSOLE') || t.includes('CONSOLA') || t.includes('PS5') || t.includes('NINTENDO') || t.includes('XBOX')) return 'Consolas y Videojuegos';
    return 'Periféricos';
}

function cleanTitle(titleOrig) {
    let t = translateText(titleOrig);
    t = t.replace(/\b(\d+)\s*ms\b/gi, '$1Ms');
    t = t.replace(/\b(\d+)\s*hz\b/gi, '$1Hz');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
}

function fetchUrl(url) {
    return new Promise((resolve) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', () => resolve(''));
    });
}

function checkImage(url) {
    return new Promise((resolve) => {
        if (!url || !url.startsWith('http')) return resolve(false);
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            if (res.statusCode !== 200) return resolve(false);
            const hash = crypto.createHash('md5');
            let size = 0;
            res.on('data', chunk => {
                hash.update(chunk);
                size += chunk.length;
            });
            res.on('end', () => {
                const md5Hex = hash.digest('hex');
                if (md5Hex === PLACEHOLDER_MD5 || size === PLACEHOLDER_SIZE) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        }).on('error', () => resolve(false));
    });
}

function formatPyg(amount) {
    return 'Gs. ' + amount.toLocaleString('es-PY').replace(/,/g, '.');
}

async function runSync() {
    console.log("🚀 AXTECH Exhaustive Live TopDek Sync Engine (Node.js)");
    
    const raw = fs.readFileSync('./products.js', 'utf8');
    let products = eval(raw.replace('const PRODUCTS =', ''));
    const existingRefs = new Set(products.map(p => String(p.ref).trim()));
    let maxId = Math.max(...products.map(p => p.id || 0), 9999);

    console.log(`📦 Catálogo local inicial: ${products.length} productos.`);

    // 1. Exhaustive crawl of ALL TopDek pages (1 to 80)
    let newItemsCount = 0;
    for (let page = 1; page <= 80; page++) {
        const url = `https://www.topdekinformatica.com.br/compras-paraguai/pagina${page}.html`;
        const html = await fetchUrl(url);
        if (!html || html.length < 3000) break;

        const linkMatches = html.match(/href=[\"']?(?:https:\/\/www\.topdekinformatica\.com\.br\/)?produto\/([^\"'\s>]+\/(\d{5,6})\.html)[\"']?/gi) || [];
        if (linkMatches.length === 0) break;

        for (const linkStr of linkMatches) {
            const m = linkStr.match(/produto\/([^\"'\s>]+\/(\d{5,6})\.html)/i);
            if (m) {
                const pathStr = m[1];
                const ref = m[2];

                if (!existingRefs.has(ref)) {
                    existingRefs.add(ref);

                    let slug = pathStr.split('/')[0] || '';
                    slug = slug.replace(/-/g, ' ').replace(/\bcodigo\b/gi, '').trim();
                    let titleOrig = slug.toUpperCase();

                    let category = detectCategory(titleOrig, slug);
                    let title = cleanTitle(titleOrig);
                    let brand = detectBrand(title);
                    let image = `https://www.topdekinformatica.com.br/produtos_img/v/IMG_${ref}_1.JPG`;

                    const hasRealImage = await checkImage(image);
                    if (hasRealImage) {
                        maxId++;
                        products.push({
                            id: maxId,
                            ref: ref,
                            brand: brand,
                            title_orig: titleOrig,
                            title: title,
                            category: category,
                            image: image,
                            usd: "SOB CONSULTA",
                            pyg_orig: 0,
                            pyg_orig_str: "SOB CONSULTA",
                            pyg: 0,
                            pyg_str: "Bajo Consulta",
                            sob_consulta: true,
                            orig_url: `https://www.topdekinformatica.com.br/produto/${pathStr}`,
                            specs: [brand, category]
                        });
                        newItemsCount++;
                    }
                }
            }
        }
    }

    console.log(`✨ Productos nuevos descubiertos e importados: ${newItemsCount}`);

    // 2. Format and recalculate profit margins (+100.000 Gs.)
    let countActive = 0;
    let countSobConsulta = 0;

    products.forEach((p, idx) => {
        if (!p.id) p.id = idx + 1;
        p.title = cleanTitle(p.title);
        if (p.title_orig) p.title_orig = cleanTitle(p.title_orig);

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
    console.log(`📦 Catálogo total final: ${products.length} productos.`);

    const header = "// Database of AXTECH products translated to Spanish and with updated prices (+100.000 Gs.)\nconst PRODUCTS =\n";
    fs.writeFileSync('./products.js', header + JSON.stringify(products, null, 4) + ';\n', 'utf8');
    console.log("✅ products.js actualizado con éxito!");
}

runSync();
