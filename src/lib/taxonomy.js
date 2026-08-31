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
    { id: 'refrigeracion',          nombre: 'Refrigeración',          icono: 'la-snowflake' },
    { id: 'monitores',              nombre: 'Monitores',              icono: 'la-tv' },
    { id: 'teclados',               nombre: 'Teclados',               icono: 'la-keyboard' },
    { id: 'mouses-y-mousepads',     nombre: 'Mouses y Mousepads',     icono: 'la-mouse-pointer' },
    { id: 'auriculares-y-headsets', nombre: 'Auriculares y Headsets', icono: 'la-headphones' },
    { id: 'microfonos',             nombre: 'Micrófonos',             icono: 'la-microphone' },
    { id: 'parlantes',              nombre: 'Parlantes',              icono: 'la-volume-up' },
    { id: 'televisores',            nombre: 'Televisores',            icono: 'la-tv' },
    { id: 'proyectores',            nombre: 'Proyectores',            icono: 'la-film' },
    { id: 'consolas-y-videojuegos', nombre: 'Consolas y Videojuegos', icono: 'la-gamepad' },
    { id: 'tablets',                nombre: 'Tablets',                icono: 'la-tablet' },
    { id: 'telefonos-y-celulares',  nombre: 'Teléfonos y Celulares',  icono: 'la-mobile' },
    { id: 'relojes-smart',          nombre: 'Relojes Smart',          icono: 'la-clock' },
    { id: 'redes-y-conectividad',   nombre: 'Redes y Conectividad',   icono: 'la-wifi' },
    { id: 'ups-y-energia',          nombre: 'UPS y Energía',          icono: 'la-battery-full' },
    { id: 'smart-home',             nombre: 'Smart Home',             icono: 'la-home' },
    { id: 'adaptadores-y-cables',   nombre: 'Adaptadores y Cables',   icono: 'la-plug' },
    { id: 'peliculas-y-fundas',     nombre: 'Películas y Fundas',     icono: 'la-mobile' },
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
    ['peliculas-y-fundas',     /(\b(pelicula|capa para|case para|funda|protetor de tela|protector de pantalla)\b|^capa )/i],
    // "C/Cable" y "S/Cable" son "con cable" y "sin cable": una caracteristica
    // del producto, no el producto. Sin la exclusion, un teclado mecanico, una
    // fuente y un cargador terminaban en la categoria de cables (57 productos).
    ['adaptadores-y-cables',   /(\b(?<![cs]\/)(cable|cabo|adaptador|adapter|conversor|extensor|docking|dock station|lector de tarj|card reader|splitter|spliter)\b|^leitor )/i],
    // Un "FONE ... REDMI" es un auricular de Xiaomi, no un celular. La marca
    // le ganaba al tipo de producto en 22 auriculares.
    ['auriculares-y-headsets', /(^fones? |\b(earbud|earbuds|airpods)\b|\bbuds\b)/i],
    // Un soporte PARA TV no es un TV: va antes que las reglas de dispositivo.
    ['soportes-y-bases',       /\b(soporte|suporte|base para|bracket|pedestal|brazo articulado|braco articulado)\b/i],

    // 2. Dispositivos completos: le ganan a los componentes que mencionan.
    // "NB ..." es la abreviatura del proveedor para notebook: 150 productos,
    // y son los de mayor valor del catalogo (hasta US$ 3.300).
    ['notebooks',              /(\b(notebook|laptop|macbook|mac ?air|ultrabook)\b|^nb )/i],
    // "PC ..." es la abreviatura del proveedor para equipo armado. Sin ella,
    // una PC se clasificaba por el primer componente que nombraba su titulo:
    // dos terminaron publicadas en Procesadores.
    // "Fuente P/ NUC" es una fuente, no una PC. Nombrar el equipo al que sirve
    // un accesorio no lo convierte en ese equipo.
    ['pcs-de-escritorio',      /(?<!p\/|para |p\/ )(\b(desktop|pc gamer|computador completo|all in one|mac ?pro|mac ?mini|mac ?studio|mini ?pc|nuc|servidor|barebone)\b|^pc )/i],
    ['tablets',                /\b(tablet|ipad)\b/i],
    // "P/SMARTPHONE" describe para que sirve el accesorio, no que sea uno: el
    // microfono DJI MIC quedaba catalogado como telefono.
    ['telefonos-y-celulares',  /((?<!p\/|para |p\/ )\b(smartphone|celular|iphone|galaxy [asz]\d|redmi|poco |moto ?[ge])\b|^cel )/i],
    // Receptores IPTV y cajas de streaming se agrupan con televisores.
    // Las cajas de streaming se agrupan con los televisores: son el aparato
    // que se enchufa a uno y no tienen categoria propia.
    ['televisores',            /(\bsmart ?tv\b|\btelevisor\b|^tv[ ,]|\btv \d{2,3}\b|^receptor |tv ?box|iptv|fire tv|tv stick)/i],
    // Los proyectores no necesitan ninguna exclusion: de los 28 productos que
    // dicen "PROJETOR", 21 son proyectores y 7 son accesorios PARA uno (cinco
    // cables VGA y dos soportes). Los accesorios se resuelven arriba, en la
    // seccion 1, asi que aca solo llegan los aparatos.
    ['proyectores',            /\b(projetor|proyector|projector|videoproyector)\b/i],
    // "MON 24 SAMSUNG..." es la abreviatura del proveedor. Se ancla al inicio
    // para no confundirla con otras palabras que empiecen con "mon".
    ['monitores',              /(\bmonitor\b|^mon \d{2})/i],
    ['relojes-smart',          /\b(smartwatch|smart ?watch|reloj|relogio|mi ?band|apple watch|galaxy watch)\b/i],
    // "IMP " es la abreviatura del proveedor para impresora.
    ['impresoras',             /(\b(impresora|impressora|multifuncion|toner|cartucho|filamento)\b|^imp |^tinta )/i],
    // "UI. " (Ubiquiti) y "MIKROTIK" son identidad de marca, no una palabra
    // generica: todo lo que las lleva es equipo de red. Estaban al final del
    // archivo y llegaban tarde: nueve equipos de red se publicaban en Fuentes
    // de Poder porque sus titulos nombran la fuente que traen o que les falta
    // ("Con Fuente", "S/Fuente", "POE INJECTOR ... Fuente"). Una antena no
    // deja de ser una antena por venir sin fuente.
    ['redes-y-conectividad',   /(^ui\. |\b(mikrotik|routerboard|unifi|ubiquiti)\b)/i],
    // "CONTROLE" en portugues es tanto el mando de una consola como el control
    // remoto de cualquier aparato. Suelta, la palabra se llevaba a Consolas
    // tres ventiladores de techo, tres tiras de LED, tres coolers de PC y un
    // collar de adiestramiento para perros: todos dicen "C/CONTROLE", o sea
    // "con control remoto". Se exige que el titulo EMPIECE con "CONTROLE ",
    // que es como el proveedor nombra los mandos de verdad, y se descartan los
    // controles de acceso, que tambien empiezan asi.
    //
    // Lo mismo con la plataforma: "HD EXT 2TB SEAGATE ... FOR XBOX" es un
    // disco, no una consola. Nombrar una consola es compatibilidad, no
    // identidad, asi que no vale si el titulo arranca con un tipo de producto.
    // Nombrar la consola no convierte al producto en una: un auricular "PARA
    // PS5 Y XBOX" sigue siendo un auricular. Se excluyen los tipos que ya
    // tienen su propia categoria, igual que ya se hacia con HD, SSD y teclados.
    ['consolas-y-videojuegos', /(\b(console|consola|joystick|dualsense|dualshock|volante|flight simulator|painel de instrumentos|shifter)\b|^controle (?!.*acce?sso|.*acceso)|^(?!(?:hd|ssd|mem|vga|mon|tec|fone|auricular|headset|mouse|microfone|microfono)\b).*\b(playstation|ps[345]|xbox|nintendo)\b)/i],

    // 3. Componentes.
    //    procesadores ANTES que tarjetas-de-video: los APU mencionan
    //    "Radeon Graphics" en el titulo y caian mal clasificados.
    // "^CPU " es la abreviatura del proveedor. Se ancla al inicio: un cooler
    // titulado "... PARA CPU" no es un procesador.
    // Un titulo que EMPIEZA con "GABINETE" es una caja, y va antes que todas
    // las reglas de componente porque una caja se describe por lo que trae
    // adentro: su fabricante ("COOLER MASTER"), el formato de fuente que
    // acepta ("Fuente ITX") o sus ventiladores ("S/FAN"). Cualquiera de esas
    // palabras le ganaba al tipo de producto en 61 gabinetes.
    // Se ancla al inicio a proposito: "COOLER FAN P/ GABINETE" es un
    // ventilador de caja y tiene que seguir cayendo en refrigeracion.
    ['gabinetes',              /^(gabinete|chassi)\b/i],
    ['procesadores',           /(\b(procesador|processador|ryzen|core i[3579]|core ultra|pentium|celeron|athlon|threadripper)\b|^cpu\b)/i],
    // "VGA" se ancla al inicio: es la abreviatura del proveedor para placa de
    // video. Suelto matcheaba el PUERTO VGA que las placas madre y los
    // monitores listan entre sus salidas ("HDMI/VGA/M.2"), y mandaba 120
    // productos --casi todos placas madre-- a Tarjetas de Video.
    ['tarjetas-de-video',      /(\b(tarjeta de video|placa de video|rtx ?\d|gtx ?\d|\brx ?[5-9]\d{3}\b|geforce)\b|^vga )/i],
    // "MB 1700 ..." es la abreviatura del proveedor, seguida del socket.
    //
    // Antes se exigia el socket ("^mb (am\d|\d{3,4})") por miedo a confundir la
    // sigla con megabytes. Medido el 31/08 contra el catalogo entero: de los 810
    // titulos que EMPIEZAN con MB, los 810 son placas madre, y los 190 donde MB
    // son megabytes lo llevan siempre en el medio ("6000/4000 MB/S"). El socket
    // sobraba y dejaba afuera nueve productos: los combos "MB+CPU" y "MB CPU",
    // los sockets viejos de AMD ("MB FM2/FM2+") y los que arrancan con la marca
    // ("MB BIOSTAR H510MHP"). Uno de ellos, un combo con DDR3 en el titulo,
    // estaba publicado entre las memorias RAM.
    ['placas-madre',           /(\b(placa madre|placa mae|motherboard|mobo)\b|^mb\b)/i],
    ['memorias-ram',           /(\b(memoria|ddr[2345]|sodimm|udimm)\b|^mem )/i],
    // "HD ..." y "CARTAO ..." son abreviaturas del proveedor.
    // "M.2" exige el punto. Sin el, "M2" suelto es un nombre de modelo tan
    // comun que se llevaba productos enteros: el microfono de solapa
    // "HOLLYLAND LARK M2" terminaba en Almacenamiento. Los SSD de verdad se
    // atrapan igual por "SSD" o "NVME", que estan en el mismo patron.
    ['almacenamiento-ssd',     /(\b(ssd|nvme|m\.2|hd externo|\bhdd\b|disco duro|disco rigido|pendrive|pen drive|micro ?sd|cartao de mem|gaveta|case para hd)\b|^hd |^cartao )/i],
    // Misma exclusion que en los cables: "C/Fuente", "S/Fuente" y "Con Fuente"
    // dicen si el aparato TRAE fuente, no que sea una fuente.
    ['fuentes-de-poder',       /(?<![cs]\/|con |sin |com |sem )\b(fuente|fonte|psu)\b/i],
    // Un "CONTROLADOR ... ARGB/PWM" es un hub de ventiladores y luces, no un
    // mando de consola. Se exige ARGB, RGB o PWM en el mismo titulo para no
    // llevarse por delante los controles de verdad, que caen antes en
    // consolas-y-videojuegos.
    ['refrigeracion',          /(\b(cooler|ventilador|ventoinha|\bfans?\b|dissipador|pasta termica)\b|\bcontroladora?\b.*\b(argb|rgb|pwm)\b)/i],
    ['gabinetes',              /\b(gabinete|chassi)\b/i],

    // 4. Perifericos concretos. Ya no existe la bolsa "Perifericos".
    ['auriculares-y-headsets', /\b(headset|auricular|auriculares|\bfones?\b|earbud|airpods|audifono)\b/i],
    ['microfonos',             /\b(microfono|microfone|\bmic\b)\b/i],
    // "TEC ..." es la abreviatura del proveedor para teclado: 155 productos.
    ['teclados',               /(\b(teclado|keyboard)\b|^tec )/i],
    ['mouses-y-mousepads',     /\b(mouse|mousepad|mouse ?pad)\b/i],
    ['parlantes',              /\b(parlante|altavoz|caixa de som|speaker|sound ?bar|radio reloj)\b/i],

    // 5. Resto.
    // "UI. " es la abreviatura del proveedor para Ubiquiti: antenas, enlaces
    // punto a punto y sus accesorios. Sus modelos (NanoStation, NanoBeam,
    // NanoHD) no contienen ninguna palabra generica de red.
    ['redes-y-conectividad',   /(\b(router|roteador|repetidor|access point|\bhub\b|antena|placa de rede|wi-?fi usb|powerline|rj45|cat[56]e?\b|patch cord|mikrotik|routerboard|unifi|ubiquiti|switch \d+p|poe\b)\b|^ui\. )/i],
    ['ups-y-energia',          /(\b(ups|nobreak|no-?break|estabilizador|filtro de linha|power ?bank|cargador|carregador|pila|pilha|bateria|luz de emergencia)\b|^estab)/i],
    // "CAMERA ..." son camaras WiFi de seguridad; las cerraduras inteligentes
    // tambien son domotica.
    // Las tiras de LED y los terminales de control de acceso entraban a
    // Consolas por la palabra "CONTROLE" y se quedaban sin categoria al
    // sacarla. Van con la domotica, que es donde ya viven las lamparas
    // inteligentes y las cerraduras.
    ['smart-home',             /(\b(alexa|echo dot|smart home|zigbee|sonoff|tomada smart|interruptor smart|lampada inteligente|tomada inteligente|camera ip|automacao|fechadura|fita led|tira led|cinta led|acc?ess?o facial|controle? de acc?ess?o)\b|^camera )/i]
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
    // Se agregan de a poco a partir del reporte de productos que quedan como
    // GENERIC. Solo fabricantes reales: agregar palabras genericas ("CABLE",
    // "SMART", "GAMER") agruparia productos de distintas marcas bajo una
    // etiqueta falsa.
    'ATTACK SHARK', 'THERMALRIGHT', 'ZEMISMART', 'HIKVISION', 'PLAYGAME',
    'MIKROTIK', 'UBIQUITI', 'GAMESIR', 'BLULORY', 'SUNKING', 'TIANQIU',
    'JONSBO', 'EPSON', 'TROVE', 'HOMIE', 'AULA', 'AFOX', 'SATE', 'FTX',
    'PXN', 'HTC', 'TAPO',
    // Agregadas el 31/08 a partir de los 1.324 productos que quedaban sin
    // marca. Sin ella el nombre corto pierde lo primero que el cliente lee, y
    // cinco memorias distintas terminaban llamandose "16GB DDR4 3200MHz".
    // "STAR" se anota aparte: es marca real de placas madre y placas de video
    // de gama baja, y \bSTAR\b no toca "STARTECH" ni "STARLIGHT".
    'HOLLYLAND', 'BLACKVIEW', 'MACROWAY', 'MERCUSYS', 'CREALITY', 'GAMDIAS',
    'FOXCONN', 'PUSKILL', 'SANDISK', 'TOSHIBA', 'ARKTEK', 'AMAZON', 'GOLINE',
    'G-TIDE', 'BROTHER', 'BOETEC', 'UNIFI', 'LEXAR', 'DUEX', 'STAR', 'ECS',
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
