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
 *
 * Cuando se conoce la categoria, se muestran solo los campos que importan para
 * ese tipo de producto y en el orden en que se leen. Un monitor se elige por
 * pulgadas, resolucion y refresco; una fuente por vatios y certificacion.
 * Mostrarle a los dos la misma lista de campos es lo que hacia que la ficha
 * pareciera un volcado del titulo.
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
    ['Tiempo de respuesta', /\b(\d)\s?MS\b/i, (m) => `${m[1]} ms`],
    ['Panel', /\b(QD-?OLED|OLED|QLED|MINI\s?LED|AMOLED|IPS|VA|TN)\b/i, (m) => m[1].toUpperCase().replace(/\s+/g, '')],
    ['Curvatura', /\b(CURVO|CURVA|CURVED)\b/i, () => 'Pantalla curva'],

    ['Sistema operativo', /\b(W11|W10|WINDOWS\s?1[01]|FREEDOS|LINUX|CHROME\s?OS|ANDROID\s?\d{0,2})\b/i,
        (m) => ({ W11: 'Windows 11', W10: 'Windows 10' })[m[1].toUpperCase()] || m[1].toUpperCase()],

    ['Potencia', /\b(\d{3,4})\s?W\b/i, (m) => `${m[1]} W`],
    ['Certificacion', /\b(80\s?\+?\s?(?:PLUS\s?)?(?:BRONZE|SILVER|GOLD|PLATINUM|PLATA|ORO))\b/i],
    ['Conectividad', /\b(WI-?FI\s?[567]E?|BLUETOOTH|USB-?C|THUNDERBOLT)\b/i],
    ['Socket', /\b(AM[2345]\+?|FM2\+?|LGA\s?\d{3,4})\b/i],
    ['Socket', /^MB\s+(\d{3,4})\b/i, (m) => `LGA ${m[1]}`],
    ['Capacidad', /\b(\d{4,6})\s?MAH\b/i, (m) => `${m[1]} mAh`],

    // --- agregados el 31/08 para que cada rubro muestre lo que define la compra

    // Se escribe como lo escribe el fabricante: "RX7600" es "Radeon RX 7600".
    ['Chip', /\bRTX\s?(\d{4})\s?(TI|SUPER)?\b/i, (m) => `GeForce RTX ${m[1]}${m[2] ? ' ' + m[2].toUpperCase() : ''}`],
    ['Chip', /\bGTX\s?(\d{3,4})\s?(TI)?\b/i, (m) => `GeForce GTX ${m[1]}${m[2] ? ' TI' : ''}`],
    ['Chip', /\bGT\s?(\d{3,4})\b/i, (m) => `GeForce GT ${m[1]}`],
    ['Chip', /\bRX\s?(\d{3,4})\s?(XTX|XT|GRE)?\b/i, (m) => `Radeon RX ${m[1]}${m[2] ? ' ' + m[2].toUpperCase() : ''}`],
    ['Chip', /\bARC\s?([AB]\d{3})\b/i, (m) => `Arc ${m[1].toUpperCase()}`],
    ['Memoria de video', /^VGA\s+\S+\s+(\d{1,2})\s?GB\b/i, (m) => `${m[1]} GB`],

    ['Tipo de memoria', /\b(DDR[2345])\b/i],
    ['Velocidad', /\b(\d{4,5})\s?MHZ\b/i, (m) => `${m[1]} MHz`],
    ['Velocidad', /^MEM(?:\s+NB)?\s+DDR[2345]\s+\d{1,3}GB\s+(\d{4,5})\b/i, (m) => `${m[1]} MHz`],
    ['Formato', /^MEM\s+NB\b/i, () => 'SODIMM (notebook)'],
    ['Formato', /\b(SODIMM|SO-DIMM|LO-DIMM)\b/i, () => 'SODIMM (notebook)'],
    ['Formato', /^MEM\b/i, () => 'DIMM (escritorio)'],

    ['Capacidad', /^(?:SSD|HD)\b.*?\b(\d{1,2}\s?TB|\d{3,4}\s?GB)\b/i, (m) => m[1].toUpperCase().replace(/\s+/g, ' ')],
    ['Interfaz', /\b(NVME|SATA\s?III|SATA)\b/i, (m) => (/NVME/i.test(m[1]) ? 'NVMe' : 'SATA')],
    ['Formato', /\bM\.?2\b/i, () => 'M.2 2280'],
    ['Formato', /\b2\.5"?\b/i, () => '2.5"'],
    ['Generacion', /\bGEN\s?([345])(?:X\d)?\b/i, (m) => `PCIe Gen ${m[1]}`],
    ['Lectura', /\b(\d{4,5})\s?\/\s?\d{4,5}\s?MB/i, (m) => `${m[1]} MB/s`],
    ['Escritura', /\b\d{4,5}\s?\/\s?(\d{4,5})\s?MB/i, (m) => `${m[1]} MB/s`],

    ['Chipset', /^MB\s+\S+\s+\S+\s+([A-Z]\d{3}[A-Z]{0,2})\b/i, (m) => m[1].toUpperCase()],
    ['Formato de placa', /\b(E-?ATX|MICRO\s?ATX|M-?ATX|MINI\s?ITX|ITX|ATX)\b/i,
        (m) => m[1].toUpperCase().replace(/\s+/g, '-').replace('MICRO-ATX', 'Micro ATX')],
    ['Salidas de video', /\b((?:HDMI|VGA|DP|DVI)(?:\/(?:HDMI|VGA|DP|DVI))+)\b/i,
        (m) => m[1].toUpperCase().split('/').join(', ')],

    ['Iluminacion', /\b(ARGB|RGB)\b/i, (m) => m[1].toUpperCase()],
    ['Ventiladores', /\b(\d)\s?FAN\b/i, (m) => `${m[1]} incluido${m[1] === '1' ? '' : 's'}`],
    ['Tamaño del ventilador', /\b(\d{2,3})\s?MM\b/i, (m) => `${m[1]} mm`],

    ['Tipo', /\b(MECHANICAL|MECANICO|MECANICA)\b/i, () => 'Mecánico'],
    ['Tipo', /\b(MEMBRANA|MEMBRANE)\b/i, () => 'Membrana'],
    ['Conexion', /\b(WIRELESS|WIRELLES|WIR|INALAMBRICO)\b/i, () => 'Inalámbrico'],
    ['Conexion', /\b(USB-?C)\b/i, () => 'USB-C'],
    ['Conexion', /\bUSB\b/i, () => 'USB'],
    ['Conexion', /\bP2\b/i, () => 'Plug 3.5 mm'],
    ['Sonido', /\b(7\.1|5\.1|2\.1)\b/, (m) => `${m[1]} canales`],
    ['Microfono', /\bC\/\s?MICROFON[EO]\b/i, () => 'Incluido'],
    ['Sensor', /\b(OPTICO|OPTICAL|LASER)\b/i, () => 'Óptico'],
    ['Idioma', /\b(ESPANHOL|ESPANOL|ESP)\b/i, () => 'Español'],
    ['Idioma', /\b(INGLES|ENGLISH|EUA)\b/i, () => 'Inglés'],
    ['Idioma', /\bPT\/BR\b/i, () => 'Portugués'],

    // Rubros donde el titulo no trae specs de computadora sino sus propios
    // datos: una impresora se elige por su tecnologia, un UPS por sus VA, un
    // router por su velocidad y un cable por su largo. Sin esto, 1.963
    // productos mostraban la ficha vacia.
    ['Tecnologia', /\b(ECOTANK|LASER|LASERJET|INKJET|TERMICA|MATRICIAL)\b/i,
        (m) => ({ ECOTANK: 'EcoTank (tanque de tinta)', LASERJET: 'Láser', INKJET: 'Inyección de tinta', TERMICA: 'Térmica', MATRICIAL: 'Matricial' })[m[1].toUpperCase()] || 'Láser'],
    ['Funciones', /\bIMP\/COP\/SCA(?:\/\w+)?\b/i, () => 'Imprime, copia y escanea'],
    ['Funciones', /\bMULTIFUNC\w*\b/i, () => 'Multifunción'],
    ['Impresion', /\b(MONOCROMATICA|MONOCROMO)\b/i, () => 'Monocromática'],
    ['Impresion', /\b(COLORIDA|A\s?COLOR)\b/i, () => 'Color'],

    ['Potencia', /\b(\d{3,4})\s?VA\b/i, (m) => `${m[1]} VA`],
    ['Alimentacion', /\b(BIVOLT)\b/i, () => 'Bivolt (110/220 V)'],
    ['Alimentacion', /\b(220\s?V|110\s?V|127\s?V)\b/i, (m) => m[1].toUpperCase().replace(/\s+/g, ' ')],

    ['Velocidad de red', /\b(?:AC|AX)(\d{3,4})\b/, (m) => `${m[1]} Mbps`],
    ['Velocidad de red', /\b(\d{3,4})\s?MBPS\b/i, (m) => `${m[1]} Mbps`],
    ['Velocidad de red', /\b(\d{1,2})\s?GBPS\b/i, (m) => `${m[1]} Gbps`],
    ['Banda', /\b(DUAL\s?BAND|2\.4\s?GHZ|5\s?GHZ)\b/i, (m) => m[1].toUpperCase().replace(/\s+/g, ' ')],
    ['Red movil', /\b(4G|5G|3G)(?:\/(?:LTE|4G))?\b/i, (m) => m[0].toUpperCase()],
    ['Puertos', /\b(\d)\s?(?:PORTAS|PUERTOS|PORTS)\b/i, (m) => m[1]],

    ['Longitud', /\b(\d{1,2}(?:[.,]\d)?)\s?M\b(?!B|HZ|M)/i, (m) => `${m[1].replace(',', '.')} m`],
    ['Longitud', /\b(\d{2,3})\s?CM\b/i, (m) => `${m[1]} cm`],

    ['Video integrado', /\bC\/\s?VIDEO\b/i, () => 'Sí'],
    ['Video integrado', /\bS\/\s?VIDEO\b/i, () => 'No'],
    ['Cooler incluido', /\bC\/\s?(?:COOLER|FAN)\b/i, () => 'Sí'],
    ['Cooler incluido', /\bS\/\s?(?:COOLER|FAN)\b/i, () => 'No'],
    ['Presentacion', /\bOEM\b/i, () => 'OEM (sin caja)'],
    ['Presentacion', /\bBOX\b/i, () => 'Caja sellada'],

    ['Color', /\b(NEGRO|BLANCO|GRIS|PLATA|ROJO|AZUL|VERDE|ROSA|DORADO|VIOLETA|AMARILLO)\b/i,
        (m) => m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()]
];

/**
 * Que campos mostrar en cada rubro, y en que orden.
 *
 * Es una whitelist: un campo que no esta listado no se muestra aunque el
 * extractor lo encuentre. Sin esto la ficha de una fuente terminaba diciendo
 * "Frecuencia: 60 Hz" porque el titulo mencionaba 60Hz en otro contexto.
 */
const CAMPOS_POR_CATEGORIA = {
    'tarjetas-de-video': ['Chip', 'Memoria de video', 'Tipo de memoria', 'Salidas de video', 'Iluminacion', 'Color'],
    'procesadores': ['Socket', 'Frecuencia', 'Video integrado', 'Cooler incluido', 'Presentacion'],
    'memorias-ram': ['Tipo de memoria', 'Capacidad', 'Velocidad', 'Formato', 'Iluminacion', 'Color'],
    'almacenamiento-ssd': ['Capacidad', 'Formato', 'Interfaz', 'Generacion', 'Lectura', 'Escritura'],
    'placas-madre': ['Socket', 'Chipset', 'Formato de placa', 'Tipo de memoria', 'Salidas de video'],
    'notebooks': ['Procesador', 'Memoria RAM', 'Almacenamiento', 'Pantalla', 'Tarjeta de video', 'Sistema operativo', 'Idioma', 'Color'],
    'pcs-de-escritorio': ['Procesador', 'Memoria RAM', 'Almacenamiento', 'Tarjeta de video', 'Sistema operativo'],
    'monitores': ['Pantalla', 'Resolucion', 'Frecuencia', 'Tiempo de respuesta', 'Panel', 'Curvatura', 'Salidas de video', 'Color'],
    'televisores': ['Pantalla', 'Resolucion', 'Panel', 'Sistema operativo', 'Conectividad', 'Color'],
    'fuentes-de-poder': ['Potencia', 'Certificacion', 'Formato de placa', 'Color'],
    'gabinetes': ['Formato de placa', 'Ventiladores', 'Iluminacion', 'Color'],
    'refrigeracion': ['Tamaño del ventilador', 'Ventiladores', 'Iluminacion', 'Socket', 'Color'],
    'teclados': ['Tipo', 'Iluminacion', 'Conexion', 'Idioma', 'Color'],
    'mouses-y-mousepads': ['Sensor', 'Conexion', 'Iluminacion', 'Color'],
    'auriculares-y-headsets': ['Conexion', 'Sonido', 'Microfono', 'Iluminacion', 'Color'],
    'microfonos': ['Conexion', 'Iluminacion', 'Color'],
    'parlantes': ['Potencia', 'Conexion', 'Sonido', 'Color'],
    'impresoras': ['Tecnologia', 'Funciones', 'Impresion', 'Conectividad', 'Alimentacion', 'Color'],
    'ups-y-energia': ['Potencia', 'Alimentacion', 'Color'],
    'redes-y-conectividad': ['Velocidad de red', 'Banda', 'Red movil', 'Puertos', 'Conectividad', 'Color'],
    'telefonos-y-celulares': ['Pantalla', 'Memoria RAM', 'Almacenamiento', 'Capacidad', 'Color'],
    'tablets': ['Pantalla', 'Memoria RAM', 'Almacenamiento', 'Sistema operativo', 'Color'],
    'relojes-smart': ['Pantalla', 'Panel', 'Capacidad', 'Conectividad', 'Color'],
    'proyectores': ['Resolucion', 'Conectividad', 'Color'],
    'consolas-y-videojuegos': ['Almacenamiento', 'Conexion', 'Color'],
    'smart-home': ['Conectividad', 'Banda', 'Alimentacion', 'Color'],
    'adaptadores-y-cables': ['Conexion', 'Longitud', 'Color'],
    'soportes-y-bases': ['Pantalla', 'Color'],
    'peliculas-y-fundas': ['Pantalla', 'Color']
};

/**
 * @param {string} titulo
 * @param {string} [categoria] limita y ordena los campos segun el rubro
 * @returns {Array<{etiqueta: string, valor: string}>}
 */
export function extraerSpecs(titulo, categoria) {
    if (typeof titulo !== 'string' || !titulo) return [];
    const encontradas = new Map();

    for (const [etiqueta, patron, formatear] of EXTRACTORES) {
        if (encontradas.has(etiqueta)) continue;
        const m = patron.exec(titulo);
        if (!m) continue;

        const valor = (formatear ? formatear(m) : m[1].toUpperCase().replace(/\s+/g, ' ')).trim();
        if (!valor) continue;

        encontradas.set(etiqueta, valor);
    }

    const permitidos = CAMPOS_POR_CATEGORIA[categoria];
    if (!permitidos) {
        return [...encontradas].map(([etiqueta, valor]) => ({ etiqueta, valor }));
    }
    return permitidos
        .filter((e) => encontradas.has(e))
        .map((etiqueta) => ({ etiqueta, valor: encontradas.get(etiqueta) }));
}
