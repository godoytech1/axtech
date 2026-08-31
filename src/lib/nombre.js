import { detectarMarca } from './taxonomy.js';

/**
 * Convierte el titulo del proveedor en un nombre de producto legible.
 *
 * El proveedor escribe para su planilla, no para una vidriera. Su formato es
 * [TIPO] [specs] [MARCA] [MODELO] [codigos de parte] [repeticiones]:
 *
 *   VGA RX7600 8GB XFX SPEEDSTER SWFT210 RX-76PSWF RX-76PSWFTFY SWFT210
 *
 * De ahi, lo unico que un cliente reconoce es "XFX Radeon RX 7600 8GB
 * Speedster SWFT210". El resto son codigos de almacen, y uno aparece dos veces.
 *
 * ES UNA WHITELIST, no una lista de exclusiones. Se extraen los campos que
 * definen la compra y se descarta todo lo demas. Intentar adivinar que tokens
 * son basura no funciona: "RX-76PSWF" y "82XB00C2US" se parecen, pero el
 * primero es un codigo de almacen y el segundo es el modelo de una notebook
 * Lenovo, lo unico que la distingue de otra igual.
 *
 * NO se inventa informacion: todo sale del titulo. Si un nombrador no logra
 * armar nada, el producto conserva su titulo limpio antes que quedar con un
 * nombre incompleto.
 */

// ---------------------------------------------------------------- utilidades

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Palabras que se escriben siempre en mayuscula aunque sean cortas. */
const SIGLAS = new Set([
    'RGB', 'ARGB', 'USB', 'SSD', 'HDD', 'NVME', 'DDR', 'GB', 'TB', 'MHZ', 'GHZ',
    'ATX', 'ITX', 'PCIE', 'HDMI', 'VGA', 'DP', 'DVI', 'LED', 'LCD', 'OLED',
    'IPS', 'VA', 'TN', 'QLED', 'UHD', 'FHD', 'QHD', 'HD', 'AC', 'AX', 'BT',
    'WIFI', 'LAN', 'PRO', 'XT', 'XTX', 'TI', 'OC', 'SE', 'XL', 'X3D', 'KIT'
]);

/**
 * Capitaliza respetando siglas y modelos.
 *
 * "FURY BEAST" es una linea de producto y se lee mejor como "Fury Beast", pero
 * "RGB" gritado es correcto y "G305" no se toca.
 */
function presentar(texto) {
    return texto
        .split(' ')
        .map((w) => {
            if (!w) return w;
            // Ya viene con formato propio: "GeForce", "GHz", "NVMe", "M.2".
            // Volver a capitalizarla la arruinaria.
            if (/[a-z]/.test(w) && /[A-Z]/.test(w)) return w;
            const limpio = w.replace(/[^A-Z0-9]/gi, '').toUpperCase();
            // Las palabras de enlace van en minuscula: "sin Cooler", no "SIN
            // Cooler". Son cortas y caerian en la regla de las siglas.
            if (/^(?:con|sin|para|de|del|y|o)$/i.test(w)) return w.toLowerCase();
            if (SIGLAS.has(limpio)) return w.toUpperCase();
            if (/\d/.test(w)) return w.toUpperCase();       // modelos: G305, A520M, 5700X
            if (w.length <= 3) return w.toUpperCase();      // XFX, MSI, LED
            return cap(w);
        })
        .join(' ');
}

/**
 * El proveedor apila caracteristicas dentro de un mismo token con barras:
 * "SMART/4K/ULTRA HD/Negro", "IMP/COP/SCA/WIFI", "Negro/BLACK".
 *
 * Se separan, se descarta lo que no aporta --el color repetido, la abreviatura
 * interna-- y se vuelven a unir. Sin esto el nombre arrastra "Negro/BLACK
 * Negro" y "Imp/cop/sca/wifi", que no se leen.
 */
function depurarBarras(token) {
    if (!token.includes('/') || token.length < 4) return token;
    if (/^[CS]\//i.test(token)) return token;          // C/COOLER, S/FAN: son unidades
    const partes = token.split('/').filter(Boolean);
    if (partes.length < 2) return token;
    const vistos = new Set();
    const utiles = partes.filter((p) => {
        const k = p.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!k || RUIDO.test(p) || vistos.has(k)) return false;
        vistos.add(k);
        return true;
    });
    // Si todas eran colores, queda uno solo y en español.
    const colores = utiles.filter((p) => TOKEN_DE_COLOR.test(p));
    if (colores.length === utiles.length && colores.length) return color(colores[0]);
    return utiles.join('/');
}

function limpiar(texto) {
    return texto
        .replace(/\s*[\/,;:*+-]+\s*$/g, '')
        .replace(/\s{2,}/g, ' ')
        // "con-Cooler" viaja pegado para que presentar() no lo grite como
        // "CON Cooler"; recien aca vuelve a ser dos palabras.
        .replace(/\b(con|sin)-/gi, (m, p) => p.toLowerCase() + ' ')
        .trim();
}

/**
 * Palabras distintas que dicen lo mismo.
 *
 * El proveedor repite el concepto en dos idiomas dentro del mismo titulo
 * ("... GAMEPAD SEM FIO ... WIRELESS") y cada capa traduce el suyo. Comparar
 * palabra por palabra no lo detecta: "Inalambrico" y "Sin Cable" no se parecen
 * en nada. Asi salio publicado "Logitech F710 Gamepad Sin Cable Inalambrico".
 */
const SINONIMOS = [
    [/^(?:INALAMBRICO|INALÁMBRICO|WIRELESS|WIRELLES|WIR|SINCABLE)$/i, 'inalambrico'],
    [/^(?:ALAMBRICO|ALÁMBRICO|WIRED|CONCABLE)$/i, 'alambrico'],
    [/^(?:MECANICO|MECÁNICO|MECHANICAL)$/i, 'mecanico'],
    [/^(?:OPTICO|ÓPTICO|OPTICAL)$/i, 'optico']
];

function concepto(token) {
    const k = token.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ0-9]/gi, '');
    for (const [patron, nombre] of SINONIMOS) if (patron.test(k)) return nombre;
    return null;
}

/** Quita palabras repetidas conservando la primera aparicion. */
function sinRepetidos(texto) {
    const vistos = new Set();
    const conceptos = new Set();
    return texto
        .split(/\s+/)
        .filter((t) => {
            const k = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (!k) return false;
            if (vistos.has(k)) return false;
            const c = concepto(t);
            if (c) {
                if (conceptos.has(c)) return false;
                conceptos.add(c);
            }
            vistos.add(k);
            return true;
        })
        .join(' ');
}

const unir = (...partes) => limpiar(sinRepetidos(partes.filter(Boolean).join(' ')));

// ------------------------------------------------------------------ extractores

/** Los chips se nombran como los nombra su fabricante, no como los abrevia el proveedor. */
function chipDeVideo(t) {
    let m;
    if ((m = t.match(/\bRTX\s?(\d{4})(?:\s*(TI\s?SUPER|SUPER|TI))?\b/i))) return `GeForce RTX ${m[1]}${suf(m[2])}`;
    if ((m = t.match(/\bGTX\s?(\d{3,4})(?:\s*(SUPER|TI))?\b/i))) return `GeForce GTX ${m[1]}${suf(m[2])}`;
    if ((m = t.match(/\bGTS?\s?(\d{3,4})\b/i))) return `GeForce GT ${m[1]}`;
    if ((m = t.match(/\bRX\s?(\d{3,4})(?:\s*(XTX|XT|GRE))?\b/i))) return `Radeon RX ${m[1]}${suf(m[2])}`;
    if ((m = t.match(/\bARC\s?([AB]\d{3})\b/i))) return `Arc ${m[1].toUpperCase()}`;
    return '';
}
const suf = (s) => (s ? ' ' + s.toUpperCase().replace(/\s+/g, ' ') : '');

/** "RYZEN R5 5500" es "Ryzen 5 5500"; "I5 12400F" es "Core i5-12400F". */
function modeloDeCpu(t) {
    let m;
    if ((m = t.match(/\bRYZEN\s+R?([3579])\s+(\w+)\b/i))) return `Ryzen ${m[1]} ${m[2].toUpperCase()}`;
    if ((m = t.match(/\bULTRA\s?([579])[\s-]?(\w+)\b/i))) return `Core Ultra ${m[1]} ${m[2].toUpperCase()}`;
    // Las notebooks abrevian el Ryzen como "R5-7520U", sin la palabra RYZEN.
    if ((m = t.match(/\bR([3579])-(\d{4}[A-Z]{0,2})\b/i))) return `Ryzen ${m[1]} ${m[2].toUpperCase()}`;
    if ((m = t.match(/\bI([3579])[\s-](\w+)\b/i))) return `Core i${m[1]}-${m[2].toUpperCase()}`;
    if ((m = t.match(/\bATHLON\s+(\w+)\b/i))) return `Athlon ${m[1].toUpperCase()}`;
    if ((m = t.match(/\b(CELERON|PENTIUM)\s+(\w+)\b/i))) return `${cap(m[1])} ${m[2].toUpperCase()}`;
    return '';
}

const capacidad = (t) => {
    const m = t.match(/\b(\d{1,2}\s?TB|\d{1,4}\s?GB)\b/i);
    return m ? m[1].toUpperCase().replace(/\s+/g, '') : '';
};
const socket = (t) => {
    const m = t.match(/\b(AM[2345](?:\+)?|FM2\+?|LGA\s?\d{3,4}|1[0-9]{3}|775)\b/i);
    if (!m) return '';
    const s = m[1].toUpperCase().replace(/\s+/g, ' ');
    // Intel se nombra por su zocalo: "1700" suelto no dice nada, "LGA 1700" si.
    return /^\d/.test(s) ? `LGA ${s}` : s;
};
const frecuenciaGhz = (t) => {
    const m = t.match(/\b(\d\.\d{1,2})\s?GHZ\b/i);
    return m ? `${m[1]}GHz` : '';
};
const watts = (t) => {
    const m = t.match(/\b(\d{3,4})\s?W\b/i);
    return m ? `${m[1]}W` : '';
};
const certificacion = (t) => {
    const m = t.match(/\b80\s?\+?\s?(?:PLUS\s?)?(BRONZE|SILVER|GOLD|PLATINUM|TITANIUM)\b/i);
    return m ? `80+ ${cap(m[1])}` : '';
};
const pulgadas = (t) => {
    const m = t.match(/^(?:MON|TV)\s+(\d{2,3})\b/i) || t.match(/\b(\d{2}(?:\.\d)?)\s?(?:"|POLEGADAS|PULGADAS)/i);
    return m ? `${m[1]}"` : '';
};
const hercios = (t) => {
    const m = t.match(/\b(\d{2,3})\s?HZ\b/i);
    return m ? `${m[1]}Hz` : '';
};
const tipoRam = (t) => {
    const m = t.match(/\bDDR([2345])\b/i);
    return m ? `DDR${m[1]}` : '';
};
const velocidadRam = (t) => {
    const m = t.match(/\b(\d{4,5})\s?MHZ\b/i) || t.match(/\bDDR[2345]\s+\d{1,2}GB\s+(\d{4,5})\b/i);
    return m ? `${m[1]}MHz` : '';
};

/**
 * La linea comercial: las palabras que el fabricante usa para su gama.
 * "SPEEDSTER SWFT210", "FURY BEAST", "LIGHTSPEED".
 *
 * Se toma lo que sigue a la marca y se corta en el primer token que parece un
 * codigo de almacen. Maximo tres palabras: mas que eso ya no es una linea, es
 * el titulo entero de vuelta.
 */
function lineaComercial(texto, marca, yaUsado = '') {
    if (!marca) return '';
    const i = texto.toUpperCase().indexOf(marca.toUpperCase());
    if (i < 0) return '';
    const cola = texto.slice(i + marca.length).trim();
    const usado = yaUsado.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const palabras = [];
    for (const tok of cola.split(/\s+/)) {
        if (!tok) continue;
        if (palabras.length >= 3) break;
        const k = tok.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!k || usado.includes(k)) continue;
        if (RUIDO.test(tok) || TOKEN_DE_COLOR.test(tok)) continue;
        if (pareceCodigo(tok)) break;
        palabras.push(TRADUCCION_DE_TOKEN[k] || tok);
    }
    return palabras.join(' ');
}

/**
 * Corta la linea comercial. No decide si un token es basura --eso lo resuelve
 * la whitelist-- solo donde termina el nombre y empieza el inventario.
 */
function pareceCodigo(token) {
    const t = token.toUpperCase();
    if (t.length < 5) return false;
    const digitos = (t.match(/\d/g) || []).length;
    if (/^\d{3}-\d{4,}/.test(t)) return true;              // 910-005281
    if (/-/.test(t) && digitos >= 2) return true;          // RX-76PSWF, CT-9010001-WW
    if (/\//.test(t) && digitos >= 2) return true;         // KF556C40BB/16
    if (t.length >= 9 && digitos >= 3) return true;        // SDSSDA3N2T00G26
    return false;
}

// Anotaciones internas y palabras que no aportan al nombre. Se comparan
// contra el token entero: "PRO" es ruido suelto pero parte del nombre en
// "MP700 PRO", y por eso el ancla ^...$ importa.
const RUIDO = /^(?:\*\w*|S\/CX|C\/CX|S\/FAN|C\/FAN|S\/COOLER|C\/COOLER|S\/G|S\/VIDEO|S\/VID|C\/VIDEO|S\/FONT|S\/FUENTE|PRE|EUA|OEM|BOX|PULL|CPO|WOF|BIVOLT|ESPANHOL|ESPANOL|INGLES|INGLESA|ENGLISH|PT\/BR|ESP|GLOBAL|RADEON|GEFORCE|INTEL\/AMD|AMD\/INTEL|C\/CONTROLE|C\/CABO|UNIDAD|UNIDADES|PCS|CARTELA|220V|110V|2280|IMP|COP|SCA|HW|UND)$/i;

// El mismo color llega escrito de tres formas en un mismo titulo ("BLK BLACK",
// "WHI 7.1 WHITE/GRAY"). Se borran todas y se agrega una sola vez, en español.
const TOKEN_DE_COLOR = /^(?:BLACK|BLK|PRETO|PRETA|NEGRO|WHITE|WHI|BRANCO|BRANCA|BLANCO|GREY|GRAY|CINZA|GRIS|SILVER|PRATA|PLATA|RED|VERMELHO|ROJO|BLUE|AZUL|PINK|ROSA|GOLD|DOURADO|DORADO|GREEN|VERDE|YELLOW|AMARELO|AMARILLO|PURPLE|ROXO|VIOLETA)$/i;

// Abreviaturas que el proveedor usa y el cliente no entiende.
const TRADUCCION_DE_TOKEN = {
    'WIR': 'Inalámbrico', 'WIRELESS': 'Inalámbrico', 'WIRELLES': 'Inalámbrico',
    'OPTICO': 'Óptico', 'MECHANICAL': 'Mecánico', 'CURVO': 'Curvo',
    'PERFORMANCE': 'Performance', 'GAMER': 'Gamer'
};

const COLORES = [
    [/\b(?:BLACK|BLK|PRETO|PRETA|NEGRO)\b/i, 'Negro'],
    [/\b(?:WHITE|WHI|BRANCO|BRANCA|BLANCO)\b/i, 'Blanco'],
    [/\b(?:GREY|GRAY|CINZA|GRIS)\b/i, 'Gris'],
    [/\b(?:SILVER|PRATA|PLATA)\b/i, 'Plata'],
    [/\b(?:RED|VERMELHO|ROJO)\b/i, 'Rojo'],
    [/\b(?:BLUE|AZUL)\b/i, 'Azul'],
    [/\b(?:PINK|ROSA)\b/i, 'Rosa'],
    [/\b(?:GOLD|DOURADO|DORADO)\b/i, 'Dorado']
];
function color(t) {
    for (const [patron, nombre] of COLORES) if (patron.test(t)) return nombre;
    return '';
}

/**
 * "INTEL/AMD" en un cooler dice con que sockets es compatible, no quien lo
 * fabrica. Sin esto, 300 coolers pasaban a llamarse "Intel".
 */
function marcaDe(titulo) {
    const t = titulo.replace(/\bINTEL\s?\/\s?AMD\b|\bAMD\s?\/\s?INTEL\b/gi, ' ');
    const conocida = detectarMarca(t);
    if (conocida) return conocida;

    // Ninguna lista de marcas va a estar completa: el proveedor vende monitores
    // "TEK" y "HYE" y mañana venderá otros dos. Pero su formato es fijo --tipo,
    // specs, MARCA, modelo-- asi que la primera palabra puramente alfabetica
    // que sobrevive al prefijo es, casi siempre, la marca. Sin esto tres
    // monitores distintos se llamaban todos "MON 20 60Hz".
    const resto = t.replace(PREFIJO_BORRABLE, '').replace(/^\d+\s+/, '');
    for (const tok of resto.split(/\s+/)) {
        if (!/^[A-Za-z][A-Za-z-]{2,}$/.test(tok)) continue;
        if (RUIDO.test(tok) || TOKEN_DE_COLOR.test(tok)) continue;
        if (/^(?:DDR|NVME|SATA|ATX|ITX|USB|HDMI|WIFI|GAMER|MINI|KIT|PARA|CON|SIN)$/i.test(tok)) continue;
        return tok.toUpperCase();
    }
    return null;
}

// ---------------------------------------------------------------- nombradores

const NOMBRADORES = {
    'tarjetas-de-video': (t, marca) => {
        const chip = chipDeVideo(t);
        const vram = capacidad(t);
        return unir(marca, chip, vram, lineaComercial(t, marca, chip + vram));
    },

    'procesadores': (t, marca) => {
        const modelo = modeloDeCpu(t);
        // OEM y BOX no son ruido aca: el mismo procesador se vende pelado o en
        // caja con cooler y garantia, a precios distintos. Sin esto quedaban
        // dos "Intel Core i5-14400" identicos y el cliente elegia a ciegas.
        const presentacion = /\bOEM\b/i.test(t) ? 'OEM'
            : (/\bBOX\b/i.test(t) ? 'BOX' : '');
        const cooler = /\bC\/(?:COOLER|FAN)\b/i.test(t) ? 'con-Cooler'
            : (/\bS\/(?:COOLER|FAN)\b/i.test(t) ? 'sin-Cooler' : '');
        return unir(marca, modelo, frecuenciaGhz(t), socket(t), presentacion, cooler);
    },

    'memorias-ram': (t, marca) => {
        const cap_ = capacidad(t);
        const tipo = tipoRam(t);
        const vel = velocidadRam(t);
        const nb = /^MEM\s+NB\b/i.test(t) ? 'para Notebook' : '';
        return unir(marca, lineaComercial(t, marca, cap_ + tipo + vel), cap_, tipo, vel, nb);
    },

    'almacenamiento-ssd': (t, marca) => {
        const cap_ = capacidad(t);
        const formato = /\bM\.?2\b/i.test(t) ? 'M.2' : (/\b2\.5\b/.test(t) ? '2.5"' : '');
        const interfaz = /\bNVME\b/i.test(t) ? 'NVMe' : (/\bSATA\b/i.test(t) ? 'SATA' : '');
        const gen = (t.match(/\bGEN\s?([345])\b/i) || [])[1];
        // "NVME", "SATA" y "2280" se agregan aparte como formato e interfaz: si
        // ademas entran en la linea comercial, el nombre los dice dos veces.
        const yaUsado = cap_ + formato + interfaz + 'NVMESATA2280M2';
        return unir(marca, lineaComercial(t, marca, yaUsado), cap_, formato, interfaz, gen ? `Gen${gen}` : '');
    },

    'placas-madre': (t, marca) => {
        const i = marca ? t.toUpperCase().indexOf(marca.toUpperCase()) : -1;
        const cola = i >= 0 ? t.slice(i + marca.length).trim() : t;
        // El modelo es lo que sigue a la marca hasta la lista de salidas.
        const modelo = cola.split(/\s+/).filter((w) => !/\//.test(w) && !RUIDO.test(w)).slice(0, 3).join(' ');
        return unir(marca, modelo, socket(t));
    },

    'monitores': (t, marca) => {
        const i = marca ? t.toUpperCase().indexOf(marca.toUpperCase()) : -1;
        const cola = i >= 0 ? t.slice(i + marca.length).trim() : t;
        const modelo = cola.split(/\s+/).filter((w) => !/\//.test(w) && !RUIDO.test(w) && !/^\d+(MS|HZ)$/i.test(w)).slice(0, 2).join(' ');
        const res = (t.match(/\b(4K|8K|UHD|QHD|FHD|2K)\b/i) || [])[1];
        return unir(marca, modelo, pulgadas(t), res ? res.toUpperCase() : '', hercios(t), /\bCURVO\b/i.test(t) ? 'Curvo' : '');
    },

    'fuentes-de-poder': (t, marca) => {
        const i = marca ? t.toUpperCase().indexOf(marca.toUpperCase()) : -1;
        const cola = i >= 0 ? t.slice(i + marca.length).trim() : t;
        const modelo = cola.split(/\s+/).filter((w) => !RUIDO.test(w) && !pareceCodigo(w) && !/^\d{3,4}W$/i.test(w)).slice(0, 2).join(' ');
        return unir(marca, modelo, watts(t), certificacion(t));
    },

    'notebooks': (t, marca) => {
        // Apple no sigue el formato del resto: no hay codigo de modelo que
        // valga, la linea ES el nombre ("MacBook Air") y el chip la define.
        // Sin esto tres MacBook distintas se llamaban todas "Apple Macbook 1TB".
        const apple = t.match(/\bMACBOOK\s+(AIR|PRO)\b/i);
        if (apple) {
            const chip = (t.match(/\bM(\d)\s?(PRO|MAX|ULTRA)?\b/i) || []);
            const mem = t.match(/\b(\d{1,3})\/(\d{1,4}\s?(?:GB|TB))\b/i);
            const tam = t.match(/\b(\d{2}(?:\.\d)?)"/);
            return unir(
                'Apple', `MacBook ${cap(apple[1])}`,
                chip[1] ? `M${chip[1]}${chip[2] ? ' ' + cap(chip[2]) : ''}` : '',
                mem ? `${mem[1]}GB` : '',
                mem ? mem[2].toUpperCase().replace(/\s+/g, '') : '',
                tam ? `${tam[1]}"` : ''
            );
        }

        const i = marca ? t.toUpperCase().indexOf(marca.toUpperCase()) : -1;
        const cola = i >= 0 ? t.slice(i + marca.length).trim() : t;
        // En una notebook el codigo ES el modelo: distingue dos equipos que por
        // lo demas se llaman igual. Se conserva entero.
        const modelo = (cola.split(/\s+/)[0] || '').replace(/[,;]$/, '');
        const cpu = modeloDeCpu(t);
        const ram = (t.match(/\/(\d{1,2})\s?GB\//i) || [])[1];
        const disco = (t.match(/\/(\d{3,4}|[1-4]\s?TB)\//i) || [])[1];
        const pantalla = (t.match(/\/(1[0-9](?:\.\d)?)\//) || [])[1];
        return unir(
            marca, modelo, cpu,
            ram ? `${ram}GB` : '',
            disco ? (/TB/i.test(disco) ? disco.toUpperCase().replace(/\s/g, '') : `${disco}GB`) : '',
            pantalla ? `${pantalla}"` : ''
        );
    }
};

// El tipo se conserva donde la categoria es heterogenea: en Refrigeracion es
// lo unico que separa una pasta termica de un ventilador.
const TIPO_SE_CONSERVA = new Set([
    'refrigeracion', 'redes-y-conectividad', 'adaptadores-y-cables',
    'ups-y-energia', 'smart-home', 'impresoras', 'soportes-y-bases',
    'peliculas-y-fundas'
]);

const TRADUCCION_DE_TIPO = [
    [/^COOLER\s+WATER\b/i, 'Water Cooler'],
    [/^COOLER\s+CPU\b/i, 'Cooler CPU'],
    [/^COOLER\s+FAN\b/i, 'Ventilador'],
    [/^PASTA\s+TERMICA\b/i, 'Pasta Térmica'],
    [/^CONTROLADOR\b/i, 'Controlador'],
    [/^PLACA\s+DE\s+REDE\b/i, 'Placa de Red'],
    [/^ANTENA\b/i, 'Antena'],
    [/^ROTEADOR\b/i, 'Router'],
    [/^ESTAB\.?\s+DE\s+VOLTAGEM\b/i, 'Estabilizador'],
    [/^IMP\s+3D\b/i, 'Impresora 3D'],
    [/^IMP\b/i, 'Impresora'],
    [/^TINTA\b/i, 'Tinta'],
    [/^TONER\b/i, 'Tóner'],
    [/^PILA\b/i, 'Pila'],
    [/^SUPORTE\b/i, 'Soporte'],
    [/^PELICULA\b/i, 'Película'],
    [/^CAPA\b/i, 'Funda'],
    [/^CABO\b/i, 'Cable'],
    [/^ADAPTADOR\b/i, 'Adaptador'],
    [/^HUB\b/i, 'Hub'],
    [/^UPS\b/i, 'UPS']
];

const PREFIJO_BORRABLE = /^(?:VGA|CPU|NB|MEM(?:\s+NB)?|SSD(?:\s+M\.?2)?|HD|MB(?:\s*\+\s*CPU|\s+CPU)?|MON|TV|FONE|TEC(?:\/MOUSE)?|MOUSE|TECLADO|GABINETE|CHASSI|FUENTE|FONTE|TABLET|CEL|PARLANTE|CAIXA\s+DE\s+SOM|MIC|MICROFONE|REL|RELOGIO|PROJETOR|CARTAO|PENDRIVE|CONSOLE|JOGO)\b[\s:.\-]*/i;

/**
 * Nombrador general para las categorias sin uno propio.
 *
 * Conserva marca, modelo y hasta cuatro palabras utiles, y corta donde empieza
 * el inventario.
 */
function generico(t, marca, tipo) {
    const i = marca ? t.toUpperCase().indexOf(marca.toUpperCase()) : -1;
    const cola = i >= 0 ? t.slice(i + marca.length).trim() : t;
    const tokens = cola.split(/\s+/).filter(Boolean);
    const partes = [];
    for (let k = 0; k < tokens.length && partes.length < 5; k++) {
        const tok = depurarBarras(tokens[k]);
        if (!tok || RUIDO.test(tok) || TOKEN_DE_COLOR.test(tok)) continue;
        if (k > 0 && pareceCodigo(tok)) continue;
        const clave = tok.toUpperCase().replace(/[^A-Z0-9]/g, '');
        partes.push(TRADUCCION_DE_TOKEN[clave] || tok);
    }
    const cuerpo = partes.join(' ');
    // El color va una sola vez y al final. Si ya aparece adentro --"Negro/Rojo"
    // en un auricular de dos tonos-- agregarlo de nuevo daria "Negro/Rojo Negro".
    const yaTieneColor = partes.some((p) => p.split('/').some((q) => TOKEN_DE_COLOR.test(q)));
    return unir(tipo, marca, cuerpo, yaTieneColor ? '' : color(t));
}

/**
 * Lo que distingue a dos productos que se llamarian igual.
 *
 * Un mismo ventilador se vende suelto y en pack de tres, y la unica diferencia
 * en el titulo es "X1" o "X3". Si el nombre corto los borra a los dos, quedan
 * dos productos identicos con precios distintos y el cliente no sabe cual esta
 * comprando.
 */
const DIFERENCIADORES = [
    /\bX([1-9])\b/i,                       // pack: X1, X3
    /\b(\d{1,2})\s?(?:FAN|FANS)\b/i,       // 3FAN
    /\b(REVERSE|REV)\b/i,                  // aspas invertidas
    /\b(LCD|OLED|DIGITAL|DIGI)\b/i,        // variante con pantalla
    /\b(\d{1,2}\s?TB|\d{1,4}\s?GB)\b/i,
    /\b(\d{3,4})\s?W\b/i,
    /\b(\d{2,3})\s?HZ\b/i,
    /\b(\d{2,3})\s?MM\b/i,
    /\b(WIFI|BLUETOOTH|USB|P2)\b/i,
    // El color va ultimo: separa bien, pero un nombre que termina en "Blanco"
    // solo porque hay una version negra lee peor que uno que se distingue por
    // lo que el producto ES.
    /\b(BLACK|WHITE|BLK|WHI|NEGRO|BLANCO|GRIS|GREY|ROJO|RED|AZUL|BLUE)\b/i
];

/**
 * Nombra un catalogo entero y desambigua las colisiones.
 *
 * El nombre corto se genera producto por producto, pero si dos caen en el
 * mismo hay que mirarlos juntos: se les agrega el dato del titulo original que
 * los separa. Solo se agrega lo que efectivamente distingue --sumar tokens a
 * ciegas devolveria el titulo del proveedor--.
 *
 * @param {Array<{title: string, category: string}>} productos
 * @returns {Map<object, string>} producto -> nombre
 */
export function nombrarCatalogo(productos) {
    const nombres = new Map();
    const grupos = new Map();

    for (const p of productos) {
        const base = nombreDeProducto(p.title, p.category);
        nombres.set(p, base);
        const k = base.toLowerCase();
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(p);
    }

    for (const grupo of grupos.values()) {
        if (grupo.length < 2) continue;
        let resuelto = false;
        for (const patron of DIFERENCIADORES) {
            const marcas = grupo.map((p) => {
                const m = p.title.match(patron);
                return m ? m[0].toUpperCase().replace(/\s+/g, '') : '';
            });
            // Sirve solo si de verdad los separa.
            if (new Set(marcas).size < 2) continue;
            grupo.forEach((p, i) => {
                if (marcas[i]) nombres.set(p, `${nombres.get(p)} ${presentar(marcas[i])}`);
            });
            resuelto = new Set(grupo.map((p) => nombres.get(p))).size === grupo.length;
            break;
        }
        if (resuelto) continue;

        // Ultimo recurso: el codigo del fabricante. Es feo, y por eso llega
        // ultimo, pero dos productos con el mismo nombre y distinto precio son
        // peores: el cliente no sabe cual esta comprando.
        const restantes = new Map();
        for (const p of grupo) {
            const k = nombres.get(p).toLowerCase();
            if (!restantes.has(k)) restantes.set(k, []);
            restantes.get(k).push(p);
        }
        for (const iguales of restantes.values()) {
            if (iguales.length < 2) continue;
            const usados = new Set();
            for (const p of iguales) {
                const propio = p.title
                    .split(/\s+/)
                    .find((tok) => pareceCodigo(tok) && !usados.has(tok.toUpperCase()));
                if (propio) {
                    usados.add(propio.toUpperCase());
                    nombres.set(p, `${nombres.get(p)} ${propio.toUpperCase()}`);
                }
            }
        }
    }
    return nombres;
}

/**
 * @param {string} titulo titulo normalizado del catalogo
 * @param {string} categoria id de categoria
 * @returns {string} nombre para la vidriera
 */
export function nombreDeProducto(titulo, categoria) {
    if (typeof titulo !== 'string' || !titulo.trim()) return '';

    let texto = titulo.trim();
    let tipo = '';

    if (TIPO_SE_CONSERVA.has(categoria)) {
        for (const [patron, nombre] of TRADUCCION_DE_TIPO) {
            if (patron.test(texto)) {
                tipo = nombre;
                texto = texto.replace(patron, '').trim();
                break;
            }
        }
    }

    const marca = marcaDe(texto);
    const nombrador = NOMBRADORES[categoria];
    let nombre = nombrador ? nombrador(texto, marca) : '';

    // Un nombrador puede no reconocer nada: un producto raro, un titulo que no
    // sigue el formato. Antes de publicar un nombre incompleto se prefiere el
    // generico, y antes que nada el titulo original limpio.
    if (nombre.split(/\s+/).filter(Boolean).length < 2) {
        nombre = generico(texto.replace(PREFIJO_BORRABLE, ''), marca, tipo);
    } else if (tipo) {
        nombre = unir(tipo, nombre);
    }
    if (nombre.split(/\s+/).filter(Boolean).length < 2) {
        nombre = limpiar(texto.replace(PREFIJO_BORRABLE, ''));
    }

    return presentar(nombre);
}
