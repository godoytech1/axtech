const fs = require('fs');
const path = require('path');

console.log("🔍 Iniciando auditoría de SEO y directrices de marca para AXTECH...");

const htmlFilePath = path.resolve(__dirname, '../../../../index.html');
const robotsFilePath = path.resolve(__dirname, '../../../../robots.txt');
const sitemapFilePath = path.resolve(__dirname, '../../../../sitemap.xml');

if (!fs.existsSync(htmlFilePath)) {
    console.error("❌ No se encontró index.html");
    process.exit(1);
}

const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
let errors = [];

// 1. Título Meta exacto
const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
if (!titleMatch) {
    errors.push("No se encontró la etiqueta <title>.");
} else {
    const titleText = titleMatch[1].trim();
    const expectedTitle = "AXTECH | Tu Tienda de Tecnología y Hardware";
    if (titleText !== expectedTitle) {
        errors.push(`El título meta es incorrecto. Encontrado: "${titleText}". Esperado: "${expectedTitle}"`);
    } else {
        console.log("✅ Título Meta correcto.");
    }
}

// 2. Meta Description
const descMatch = htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                  htmlContent.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
if (!descMatch) {
    errors.push("No se encontró la etiqueta meta description.");
} else {
    const descText = descMatch[1];
    if (descText.toLowerCase().includes("en paraguay") || descText.toLowerCase().includes("de paraguay")) {
        errors.push("La descripción meta contiene menciones geográficas prohibidas por las directrices del proyecto.");
    } else {
        console.log("✅ Meta Description válida.");
    }
}

// 3. Encabezado único H1
const h1Matches = htmlContent.match(/<h1[\s>]/gi) || [];
if (h1Matches.length === 0) {
    errors.push("No se encontró ninguna etiqueta <h1> en index.html.");
} else if (h1Matches.length > 1) {
    errors.push(`Se encontraron múltiples etiquetas <h1> (${h1Matches.length}). Solo debe haber una por página.`);
} else {
    console.log("✅ Encabezado H1 único verificado.");
}

// 4. Imágenes sin tag ALT
// Encontrar todos los tags img y verificar que tengan alt="..."
const imgRegex = /<img[^>]+>/gi;
let imgMatch;
let imgTotal = 0;
let imgWithoutAlt = 0;
while ((imgMatch = imgRegex.exec(htmlContent)) !== null) {
    imgTotal++;
    const imgTag = imgMatch[0];
    // Ignoramos tags img que sean comentarios u otros elementos extraños
    if (!/alt=["']/i.test(imgTag)) {
        imgWithoutAlt++;
    }
}

if (imgWithoutAlt > 0) {
    errors.push(`Se encontraron ${imgWithoutAlt} de ${imgTotal} imágenes sin atributo 'alt' definido.`);
} else {
    console.log(`✅ Todas las imágenes (${imgTotal}) poseen atributo 'alt'.`);
}

// 5. Robots y Sitemap
if (fs.existsSync(robotsFilePath)) {
    const robotsContent = fs.readFileSync(robotsFilePath, 'utf8');
    if (!robotsContent.toLowerCase().includes("sitemap:")) {
        errors.push("El archivo robots.txt existe pero no declara la directiva 'Sitemap:'.");
    } else {
        console.log("✅ robots.txt tiene directiva Sitemap.");
    }
} else {
    errors.push("El archivo robots.txt no existe en el directorio raíz.");
}

if (!fs.existsSync(sitemapFilePath)) {
    errors.push("El archivo sitemap.xml no existe en el directorio raíz.");
} else {
    console.log("✅ Archivo sitemap.xml presente.");
}

console.log("\n--------------------------------------------------");
if (errors.length > 0) {
    console.error(`❌ Auditoría de SEO fallida con ${errors.length} observaciones:`);
    errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
} else {
    console.log("✨ Auditoría de SEO y marca completada con éxito. ¡Todo excelente!");
    process.exit(0);
}
