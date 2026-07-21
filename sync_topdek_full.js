const fs = require('fs');
const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,es;q=0.8'
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => resolve(''));
    });
}

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

function categorizeProduct(title) {
    const t = title.toLowerCase();
    if (t.includes('tv') || t.includes('televisor') || t.includes('smart tv')) return 'Televisores';
    if (t.includes('notebook') || t.includes('laptop') || t.includes('macbook')) return 'Notebooks';
    if (t.includes('placa de video') || t.includes('tarjeta de video') || t.includes('vga') || t.includes('rtx') || t.includes('gtx') || t.includes('radeon rx')) return 'Tarjetas de Video';
    if (t.includes('memoria ram') || t.includes('ddr4') || t.includes('ddr5') || t.includes('dimm') || t.includes('sodimm')) return 'Memorias RAM';
    if (t.includes('fonte') || t.includes('fuente')) return 'Fuentes de Poder';
    if (t.includes('processador') || t.includes('procesador') || t.includes('ryzen') || t.includes('core i3') || t.includes('core i5') || t.includes('core i7') || t.includes('core i9')) return 'Procesadores';
    if (t.includes('placa mae') || t.includes('placa madre') || t.includes('motherboard')) return 'Placas Madre';
    if (t.includes('ssd') || t.includes('hd external') || t.includes('disco duro')) return 'Almacenamiento (SSD)';
    if (t.includes('monitor')) return 'Monitores';
    if (t.includes('gabinete') || t.includes('case gamer')) return 'Gabinetes';
    if (t.includes('mi band') || t.includes('smartband')) return 'Relojes Mi Band';
    if (t.includes('ps5') || t.includes('playstation') || t.includes('nintendo') || t.includes('xbox')) return 'Consolas y Videojuegos';
    return 'Periféricos';
}

function detectBrand(title) {
    const brands = ['MSI', 'GIGABYTE', 'ASUS', 'ASROCK', 'ZOTAC', 'PALIT', 'GALAX', 'XFX', 'SAPPHIRE', 'BIOSTAR', 'KEEPDATA', 'STAR', 'COOLER MASTER', 'SATELLITE', 'GAMEMAX', 'UP GAMER', 'AIGO', 'DARKFLASH', 'CORSAIR', 'LIAN LI', 'COUGAR', 'REDRAGON', 'ANTEC', 'AEROCOOL', 'NZXT', 'DEEPCOOL', 'HYTE', 'K-MEX', 'MTEK', 'XIAOMI', 'ECOPOWER', 'SMARTFY', 'SONY', 'NINTENDO', 'INTEL', 'AMD', 'JVC', 'SAMSUNG', 'LG', 'TCL', 'PHILIPS', 'DELL', 'HP', 'LENOVO', 'ACER', 'PATRIOT', 'KINGSTON'];
    const t = title.toUpperCase();
    for (const b of brands) {
        if (t.includes(b)) return b;
    }
    return 'GENERIC';
}

async function runFullSync() {
    console.log("🚀 Iniciando extracción profunda del catálogo de TopDek...");

    const raw = fs.readFileSync('./products.js', 'utf8');
    const existingProducts = eval(raw.replace('const PRODUCTS =', ''));
    const existingRefs = new Set(existingProducts.map(p => p.ref ? String(p.ref).trim() : ''));
    let maxId = Math.max(...existingProducts.map(p => p.id || 0), 9999);

    let addedCount = 0;

    for (let page = 1; page <= 40; page++) {
        const url = `https://www.topdekinformatica.com.br/compras-paraguai/pagina${page}.html`;
        console.log(`Analizando página ${page}...`);
        const html = await fetchUrl(url);

        if (!html || html.length < 5000) {
            console.log(`Página ${page} vacía o finalizada.`);
            break;
        }

        // Extract product links: href="produto/slug/ref.html"
        const linkMatches = html.match(/href=[\"']?(?:https:\/\/www\.topdekinformatica\.com\.br\/)?produto\/([^\"'\s>]+\/(\d{5,6})\.html)[\"']?/gi) || [];

        linkMatches.forEach(linkStr => {
            const m = linkStr.match(/produto\/([^\"'\s>]+\/(\d{5,6})\.html)/i);
            if (m) {
                const pathStr = m[1];
                const ref = m[2];

                if (!existingRefs.has(ref)) {
                    existingRefs.add(ref);
                    maxId++;

                    let slug = pathStr.split('/')[0] || '';
                    slug = slug.replace(/-/g, ' ').replace(/\bcodigo\b/gi, '').trim();
                    let titleOrig = slug.toUpperCase() || `PRODUCTO REF ${ref}`;
                    let title = translateText(titleOrig);
                    let category = categorizeProduct(title);
                    let brand = detectBrand(title);
                    let image = `https://www.topdekinformatica.com.br/produtos_img/v/IMG_${ref}_1.JPG`;

                    existingProducts.push({
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
                    addedCount++;
                }
            }
        });
    }

    console.log(`✨ Sincronización finalizada. Nuevos productos agregados (Bajo Consulta): ${addedCount}`);
    console.log(`📦 Nuevo Total del Catálogo AXTECH: ${existingProducts.length} productos.`);

    const header = "// Database of AXTECH products translated to Spanish and with updated prices (+100.000 Gs.)\nconst PRODUCTS =\n";
    fs.writeFileSync('./products.js', header + JSON.stringify(existingProducts, null, 4) + ';\n', 'utf8');
    console.log("✅ products.js actualizado exitosamente!");
}

runFullSync();
