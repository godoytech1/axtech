export const CATEGORIAS = [
    { id: 'notebooks',              nombre: 'Notebooks',              icono: 'la-laptop' },
    { id: 'pcs-de-escritorio',      nombre: 'PCs de Escritorio',      icono: 'la-desktop' },
    { id: 'tarjetas-de-video',      nombre: 'Tarjetas de Video',      icono: 'la-microchip' },
    { id: 'procesadores',           nombre: 'Procesadores',           icono: 'la-microchip' },
    { id: 'placas-madre',           nombre: 'Placas Madre',           icono: 'la-server' },
    { id: 'memorias-ram',           nombre: 'Memorias RAM',           icono: 'la-memory' },
    { id: 'almacenamiento-ssd',     nombre: 'Almacenamiento',         icono: 'la-hdd' },
    { id: 'fuentes-de-poder',       nombre: 'Fuentes de Poder',       icono: 'la-plug' },
    { id: 'gabinetes',              nombre: 'Gabinetes',              icono: 'la-server' },
    { id: 'refrigeracion',          nombre: 'Refrigeracion',          icono: 'la-snowflake' },
    { id: 'monitores',              nombre: 'Monitores',              icono: 'la-tv' },
    { id: 'teclados',               nombre: 'Teclados',               icono: 'la-keyboard' },
    { id: 'mouses-y-mousepads',     nombre: 'Mouses y Mousepads',     icono: 'la-mouse-pointer' },
    { id: 'auriculares-y-headsets', nombre: 'Auriculares y Headsets', icono: 'la-headphones' },
    { id: 'microfonos',             nombre: 'Microfonos',             icono: 'la-microphone' },
    { id: 'parlantes',              nombre: 'Parlantes',              icono: 'la-volume-up' },
    { id: 'televisores',            nombre: 'Televisores',            icono: 'la-tv' },
    { id: 'consolas-y-videojuegos', nombre: 'Consolas y Videojuegos', icono: 'la-gamepad' },
    { id: 'tablets',                nombre: 'Tablets',                icono: 'la-tablet' },
    { id: 'telefonos-y-celulares',  nombre: 'Telefonos y Celulares',  icono: 'la-mobile' },
    { id: 'relojes-smart',          nombre: 'Relojes Smart',          icono: 'la-clock' },
    { id: 'redes-y-conectividad',   nombre: 'Redes y Conectividad',   icono: 'la-wifi' },
    { id: 'ups-y-energia',          nombre: 'UPS y Energia',          icono: 'la-battery-full' },
    { id: 'smart-home',             nombre: 'Smart Home',             icono: 'la-home' },
    { id: 'adaptadores-y-cables',   nombre: 'Adaptadores y Cables',   icono: 'la-plug' },
    { id: 'peliculas-y-fundas',     nombre: 'Peliculas y Fundas',     icono: 'la-mobile' },
    { id: 'impresoras',             nombre: 'Impresoras',             icono: 'la-print' },
    { id: 'soportes-y-bases',       nombre: 'Soportes y Bases',       icono: 'la-columns' }
];

/**
 * Categoria del proveedor -> categoria de AXTECH.
 *
 * Es la senal MAS confiable: el scraper sabe de que pagina saco cada producto.
 * El scraper viejo la descartaba y clasificaba por titulo; por eso el 41,3% de
 * los productos activos termino en un cajon de sastre llamado "Perifericos".
 *
 * Se consume desde la Fase 4. En la Fase 1A el catalogo todavia no guarda el
 * slug de origen, asi que la clasificacion cae en las reglas por titulo.
 */
export const SLUG_PROVEEDOR_A_CATEGORIA = {
    'notebook-e-pc-notebook': 'notebooks',
    'notebook-e-pc-desktop': 'pcs-de-escritorio',
    'placa-de-video-nvidia': 'tarjetas-de-video',
    'placa-de-video-amd': 'tarjetas-de-video',
    'processador-intel': 'procesadores',
    'processador-amd': 'procesadores',
    'placa-mae-intel': 'placas-madre',
    'placa-mae-amd': 'placas-madre',
    'memoria-ram-desktop': 'memorias-ram',
    'memoria-ram-notebook': 'memorias-ram',
    'armazenamento-ssd-2-5': 'almacenamiento-ssd',
    'armazenamento-ssd-nvme': 'almacenamiento-ssd',
    'fonte-de-energia': 'fuentes-de-poder',
    'perifericos-gabinete': 'gabinetes',
    'perifericos-cooler-e-fans': 'refrigeracion',
    'monitores': 'monitores',
    'perifericos-teclado': 'teclados',
    'perifericos-mouse': 'mouses-y-mousepads',
    'perifericos-mouse-pad': 'mouses-y-mousepads',
    'perifericos-fone-e-headset': 'auriculares-y-headsets',
    'perifericos-microfone': 'microfonos',
    'perifericos-cabos-e-adaptadores': 'adaptadores-y-cables',
    'eletronicos-tv': 'televisores',
    'eletronicos-games-e-consoles': 'consolas-y-videojuegos',
    'eletronicos-tablet': 'tablets',
    'telefonia-smartphone': 'telefonos-y-celulares',
    'apple-iphone': 'telefonos-y-celulares',
    'eletronicos-relogio-e-smartwatch': 'relojes-smart',
    'rede-e-internet-hub': 'redes-y-conectividad',
    'rede-e-internet-roteador': 'redes-y-conectividad',
    'rede-e-internet-repetidor': 'redes-y-conectividad',
    'rede-e-internet-cabo-antena-acessorios': 'redes-y-conectividad',
    'energia-ups': 'ups-y-energia',
    'energia-nobreak': 'ups-y-energia',
    'eletronicos-automacao-inteligente': 'smart-home'
};

/**
 * EL ORDEN ES LA LOGICA. No reordenar sin correr los tests.
 *
 * Un notebook se titula "NOTEBOOK HP VICTUS, CORE I5, 8GB RAM, 512GB SSD":
 * menciona tres componentes. Si las reglas de componente van primero, el
 * notebook termina clasificado como almacenamiento. Medido sobre el catalogo
 * real: con el orden equivocado, 15 notebooks; con este orden, 149.
 */
const REGLAS = [
    // 1. Accesorios: mencionan dispositivos, tienen que resolverse primero.
    ['peliculas-y-fundas',     /\b(pelicula|capa para|case para|funda|protetor de tela|protector de pantalla)\b/i],
    ['adaptadores-y-cables',   /\b(cable|cabo|adaptador|adapter|conversor|extensor|docking|dock station)\b/i],
    // Un soporte PARA TV no es un TV: va antes que las reglas de dispositivo.
    ['soportes-y-bases',       /\b(soporte|suporte|base para|bracket|pedestal|brazo articulado|braco articulado)\b/i],

    // 2. Dispositivos completos: le ganan a los componentes que mencionan.
    ['notebooks',              /\b(notebook|laptop|macbook|mac ?air|ultrabook)\b/i],
    ['pcs-de-escritorio',      /\b(desktop|pc gamer|computador completo|all in one|mac ?pro|mac ?mini|mac ?studio)\b/i],
    ['tablets',                /\b(tablet|ipad)\b/i],
    ['telefonos-y-celulares',  /\b(smartphone|celular|iphone|galaxy [asz]\d|redmi|poco |moto ?[ge])\b/i],
    ['televisores',            /(\bsmart ?tv\b|\btelevisor\b|^tv[ ,]|\btv \d{2,3}\b)/i],
    // "MON 24 SAMSUNG..." es la abreviatura del proveedor. Se ancla al inicio
    // para no confundirla con otras palabras que empiecen con "mon".
    ['monitores',              /(\bmonitor\b|^mon \d{2})/i],
    ['relojes-smart',          /\b(smartwatch|smart ?watch|reloj|relogio|mi ?band|apple watch|galaxy watch)\b/i],
    ['impresoras',             /\b(impresora|impressora|multifuncion|toner|cartucho)\b/i],
    ['consolas-y-videojuegos', /\b(console|consola|playstation|ps[345]|xbox|nintendo|joystick|dualsense|dualshock|controle|volante|flight simulator|painel de instrumentos|shifter)\b/i],

    // 3. Componentes.
    //    procesadores ANTES que tarjetas-de-video: los APU mencionan
    //    "Radeon Graphics" en el titulo y caian mal clasificados.
    // "^CPU " es la abreviatura del proveedor. Se ancla al inicio: un cooler
    // titulado "... PARA CPU" no es un procesador.
    ['procesadores',           /(\b(procesador|processador|ryzen|core i[3579]|core ultra|pentium|celeron|athlon|threadripper)\b|^cpu\b)/i],
    ['tarjetas-de-video',      /\b(tarjeta de video|placa de video|\bvga\b|rtx ?\d|gtx ?\d|\brx ?[5-9]\d{3}\b|geforce)\b/i],
    // "MB 1700 ..." es la abreviatura del proveedor, seguida del socket.
    // Se exige el numero para no confundirla con megabytes.
    ['placas-madre',           /(\b(placa madre|placa mae|motherboard|mobo)\b|^mb (am\d|\d{3,4})\b)/i],
    ['memorias-ram',           /\b(memoria|ddr[2345]|sodimm|udimm)\b/i],
    ['almacenamiento-ssd',     /\b(ssd|nvme|m\.?2|hd externo|\bhdd\b|disco duro|disco rigido|pendrive|pen drive|micro ?sd|cartao de mem)\b/i],
    ['fuentes-de-poder',       /\b(fuente|fonte|\bpsu\b)\b/i],
    ['refrigeracion',          /\b(cooler|ventilador|ventoinha|\bfans?\b|dissipador|pasta termica)\b/i],
    ['gabinetes',              /\b(gabinete|chassi)\b/i],

    // 4. Perifericos concretos. Ya no existe la bolsa "Perifericos".
    ['auriculares-y-headsets', /\b(headset|auricular|auriculares|\bfones?\b|earbud|airpods|audifono)\b/i],
    ['microfonos',             /\b(microfono|microfone|\bmic\b)\b/i],
    ['teclados',               /\b(teclado|keyboard)\b/i],
    ['mouses-y-mousepads',     /\b(mouse|mousepad|mouse ?pad)\b/i],
    ['parlantes',              /\b(parlante|caixa de som|speaker|sound ?bar)\b/i],

    // 5. Resto.
    ['redes-y-conectividad',   /\b(router|roteador|repetidor|access point|\bhub\b|antena|placa de rede|wi-?fi usb|powerline|rj45|cat[56]e?\b|patch cord|mikrotik|routerboard|unifi|ubiquiti|switch \d+p|poe\b)\b/i],
    ['ups-y-energia',          /\b(ups|nobreak|no-?break|estabilizador|filtro de linha|power ?bank|cargador|carregador|pila|pilha|bateria)\b/i],
    ['smart-home',             /\b(alexa|echo dot|smart home|zigbee|sonoff|tomada smart|interruptor smart|lampada inteligente|tomada inteligente|camera ip|automacao)\b/i]
];

/**
 * Decide la categoria de un producto.
 *
 * @param {{titulo: string, slugProveedor?: string}} entrada
 * @returns {string|null} id de categoria, o null si no se puede decidir.
 *
 * NUNCA devuelve una categoria de descarte. Un producto que no resuelve se
 * oculta y se reporta, para que el problema sea visible en vez de silencioso:
 * asi fue como el scraper viejo acumulo el 41,3% del catalogo en un cajon.
 */
export function clasificar({ titulo, slugProveedor } = {}) {
    if (slugProveedor && SLUG_PROVEEDOR_A_CATEGORIA[slugProveedor]) {
        return SLUG_PROVEEDOR_A_CATEGORIA[slugProveedor];
    }
    if (typeof titulo !== 'string' || !titulo.trim()) return null;
    const t = titulo.normalize('NFD').replace(/\p{M}/gu, '');
    for (const [id, patron] of REGLAS) {
        if (patron.test(t)) return id;
    }
    return null;
}

/** Ids usados por las reglas de clasificacion. Lo consume el test de coherencia. */
export const IDS_EN_REGLAS = REGLAS.map(([id]) => id);

export const MARCAS = [
    'COOLER MASTER', 'WESTERN DIGITAL', 'THERMALTAKE', 'LIAN LI', 'UP GAMER',
    'VIEWSONIC', 'MARKVISION', 'ALIENWARE', 'ZEMISMART', 'SAPPHIRE',
    'POWERCOLOR', 'SATELLITE', 'DARKFLASH', 'GIGABYTE', 'REDRAGON',
    'AEROCOOL', 'DEEPCOOL', 'KINGSTON', 'ECOPOWER', 'NINTENDO', 'SMARTFY',
    'KEEPDATA', 'NAKATOMI', 'GAMEMAX', 'SAMSUNG', 'SEAGATE', 'PHILIPS',
    'TP-LINK', 'CRUCIAL', 'PATRIOT', 'HYPERX', 'CORSAIR', 'LOGITECH',
    'BIOSTAR', 'SUNKING', 'ASROCK', 'THERMAL', 'ANTEC', 'COUGAR', 'ZOTAC',
    'PALIT', 'GALAX', 'XIAOMI', 'SONNOFF', 'SONOFF', 'LENOVO', 'ADATA',
    'RAZER', 'APPLE', 'INTEL', 'NVIDIA', 'K-MEX', 'TEROS', 'KOLKE', 'MOZA',
    'HYTE', 'NZXT', 'AIGO', 'AZZA', 'BENQ', 'DAHUA', 'DELL', 'ACER', 'ASUS',
    'AMD', 'MSI', 'XFX', 'JVC', 'TCL', 'AOC', 'JBL', 'SONY', 'HP', 'LG', 'MTEK'
];

const ALIAS_DE_MARCA = {
    LOGI: 'LOGITECH',
    WD: 'WESTERN DIGITAL',
    TPLINK: 'TP-LINK'
};

// De la marca mas larga a la mas corta, para que "COOLER MASTER" no se
// resuelva como "MASTER" ni "ASROCK" quede tapada por otra mas corta.
const MARCAS_ORDENADAS = [...MARCAS].sort((a, b) => b.length - a.length);

/** Detecta la marca en el titulo. Devuelve null si no reconoce ninguna. */
export function detectarMarca(titulo) {
    if (typeof titulo !== 'string') return null;
    const t = titulo.toUpperCase();
    for (const marca of MARCAS_ORDENADAS) {
        const escapada = marca.replace(/[-]/g, '\\-');
        if (new RegExp(`\\b${escapada}\\b`).test(t)) return marca;
    }
    for (const [alias, marca] of Object.entries(ALIAS_DE_MARCA)) {
        if (new RegExp(`\\b${alias}\\b`).test(t)) return marca;
    }
    return null;
}
