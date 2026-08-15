/**
 * Extrae especificaciones tecnicas del titulo.
 *
 * El proveedor no entrega datos estructurados, pero sus titulos son densos:
 * "NB HP 15-FA2013DX I5-13420H/8GB/512/RTX3050/15/W11" tiene seis datos
 * adentro. Sin esto, las paginas de producto quedarian con nada mas que un
 * nombre y un precio, y Google las trataria como contenido fino.
 *
 * Cada etiqueta se extrae UNA sola vez: gana el primer patron que matchea,
 * por eso el orden dentro de cada etiqueta importa (del mas especifico al mas
 * general).
 */
const EXTRACTORES = [
    ['Procesador', /\b(i[3579]-\d{4,5}[A-Z]{0,3}|ultra\s?[579]-?\d{3}[A-Z]{0,2}|ryzen\s?[3579]\s?\d{4}[A-Z]{0,3}|r[3579]-\d{3,4}[A-Z]{0,2}|core\s?\d-\d{3}[A-Z]?|athlon-?\w+|celeron\s?\w+|pentium\s?\w+|snapdragon\s?\w+)\b/i],

    // Patron tipico de notebook: CPU/RAM/ALMACENAMIENTO/PANTALLA/SO
    ['Memoria RAM', /\/(\d{1,3})\s?GB?\//i, (m) => `${m[1]} GB`],
    ['Memoria RAM', /\b(\d{1,3})\s?GB\s?(?:DDR[45]|RAM)\b/i, (m) => `${m[1]} GB`],

    ['Almacenamiento', /\b(\d\s?TB|\d{3,4}\s?GB)\s?(?:SSD|NVME|HD|EMMC)\b/i, (m) => m[1].toUpperCase().replace(/\s+/g, ' ')],
    ['Almacenamiento', /\/(\d{3,4}|[1-9]\s?TB)\/(?=\d{2}\/|W1|FREEDOS|LINUX)/i,
        (m) => (/TB/i.test(m[1]) ? m[1].toUpperCase().replace(/\s+/g, '') : `${m[1]} GB`)],

    ['Tarjeta de video', /\b(RTX\s?\d{4}\s?(?:TI|SUPER)?|GTX\s?\d{3,4}\s?(?:TI)?|RX\s?\d{4}\s?(?:XT|GRE)?|ARC\s?[AB]\d{3})\b/i],

    ['Pantalla', /\b(\d{2}(?:\.\d)?)\s?(?:"|POLEGADAS|PULGADAS|INCH)/i, (m) => `${m[1]}"`],
    ['Pantalla', /^(?:MON|TV)\s(\d{2,3})\b/i, (m) => `${m[1]}"`],
    ['Pantalla', /\/(1[0-9](?:\.\d)?)\/(?:W1|FREEDOS|LINUX)/i, (m) => `${m[1]}"`],

    ['Resolucion', /\b(4K|8K|UHD|QHD|FHD|FULL\s?HD|2K|1080P|1440P|2\.5K)\b/i, (m) => m[1].toUpperCase().replace(/\s+/g, ' ')],
    ['Frecuencia', /\b(\d{2,3})\s?HZ\b/i, (m) => `${m[1]} Hz`],
    ['Panel', /\b(QD-?OLED|OLED|QLED|MINI\s?LED|AMOLED|IPS|VA|TN)\b/i, (m) => m[1].toUpperCase().replace(/\s+/g, '')],

    ['Sistema operativo', /\b(W11|W10|WINDOWS\s?1[01]|FREEDOS|LINUX|CHROME\s?OS|ANDROID\s?\d{0,2})\b/i,
        (m) => ({ W11: 'Windows 11', W10: 'Windows 10' })[m[1].toUpperCase()] || m[1].toUpperCase()],

    ['Potencia', /\b(\d{3,4})\s?W\b/i, (m) => `${m[1]} W`],
    ['Certificacion', /\b(80\s?\+?\s?(?:PLUS\s?)?(?:BRONZE|SILVER|GOLD|PLATINUM|PLATA|ORO))\b/i],
    ['Conectividad', /\b(WI-?FI\s?[567]E?|BLUETOOTH|USB-?C|THUNDERBOLT)\b/i],
    ['Socket', /\b(AM[45]|LGA\s?\d{3,4})\b/i],
    ['Capacidad', /\b(\d{4,6})\s?MAH\b/i, (m) => `${m[1]} mAh`]
];

/**
 * @param {string} titulo
 * @returns {Array<{etiqueta: string, valor: string}>}
 */
export function extraerSpecs(titulo) {
    if (typeof titulo !== 'string' || !titulo) return [];
    const salida = [];
    const yaExtraidas = new Set();

    for (const [etiqueta, patron, formatear] of EXTRACTORES) {
        if (yaExtraidas.has(etiqueta)) continue;
        const m = patron.exec(titulo);
        if (!m) continue;

        const valor = (formatear ? formatear(m) : m[1].toUpperCase().replace(/\s+/g, ' ')).trim();
        if (!valor) continue;

        yaExtraidas.add(etiqueta);
        salida.push({ etiqueta, valor });
    }
    return salida;
}
