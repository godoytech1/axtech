const fs = require('fs');

const BRANDS = [
    'APPLE', 'ASUS', 'MSI', 'GIGABYTE', 'DELL', 'HP', 'LENOVO', 'ACER',
    'SAMSUNG', 'LG', 'JVC', 'TCL', 'PHILIPS', 'XIAOMI', 'SONY', 'NINTENDO',
    'INTEL', 'AMD', 'XFX', 'SAPPHIRE', 'ZOTAC', 'PALIT', 'GALAX', 'ASROCK',
    'BIOSTAR', 'KEEPDATA', 'STAR', 'COOLER MASTER', 'SATELLITE', 'GAMEMAX',
    'UP GAMER', 'AIGO', 'DARKFLASH', 'CORSAIR', 'LIAN LI', 'COUGAR', 'REDRAGON',
    'ANTEC', 'AEROCOOL', 'NZXT', 'DEEPCOOL', 'HYTE', 'K-MEX', 'MTEK', 'ECOPOWER',
    'SMARTFY', 'PATRIOT', 'KINGSTON', 'LOGITECH', 'RAZER', 'HYPERX', 'JBL'
];

function normalizeBrand(p) {
    const title = (p.title + ' ' + (p.title_orig || '')).toUpperCase();
    
    if (title.includes('APPLE') || title.includes('MACBOOK') || title.includes('MAC MINI') || title.includes('IMAC') || title.includes('IPAD')) {
        return 'APPLE';
    }

    for (const b of BRANDS) {
        if (title.includes(b)) {
            return b;
        }
    }

    return (p.brand || 'GENERIC').toUpperCase().trim();
}

function run() {
    const raw = fs.readFileSync('./products.js', 'utf8');
    const products = eval(raw.replace('const PRODUCTS =', ''));
    
    let updatedCount = 0;
    products.forEach(p => {
        const newBrand = normalizeBrand(p);
        if (p.brand !== newBrand) {
            p.brand = newBrand;
            updatedCount++;
        }
    });

    console.log(`Updated brands for ${updatedCount} products.`);
    
    const appleCount = products.filter(p => p.brand === 'APPLE').length;
    console.log(`Total APPLE products across catalog now: ${appleCount}`);

    const header = "// Database of AXTECH products translated to Spanish and with updated prices (+100.000 Gs.)\nconst PRODUCTS =\n";
    fs.writeFileSync('./products.js', header + JSON.stringify(products, null, 4) + ';\n', 'utf8');
    console.log("✅ products.js brand normalization complete!");
}

run();
