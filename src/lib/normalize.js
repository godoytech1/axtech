// Caracter de reemplazo U+FFFD. Se escribe escapado a proposito: el fuente de
// este modulo es ASCII puro para que ninguna normalizacion de editor lo altere
// en silencio.
const REEMPLAZO = '\uFFFD';

/**
 * El scraper viejo concatenaba Buffers sin setEncoding, partiendo caracteres
 * UTF-8 multibyte en el borde de un chunk. El resultado son dos danos
 * distintos, que necesitan tratamientos OPUESTOS:
 *
 *   A) Una vocal acentuada perdida:  MEM\uFFFDRIA  -> MEMORIA
 *   B) Un separador perdido:         MSI\uFFFDPRO  -> MSI PRO
 *
 * Borrar el caracter sirve para (A) pero pega palabras en (B); poner un espacio
 * sirve para (B) pero parte palabras en (A). Por eso: lista explicita para (A),
 * y espacio como respaldo para todo lo demas.
 *
 * La lista salio de extraer las 63 palabras corruptas del catalogo real, no de
 * adivinar. El bug de origen se corrige en la Fase 4.
 */
const REPARACIONES = [
    [/ACR\uFFFDLICO/gi, 'ACRILICO'],
    [/ALUM\uFFFDNIO/gi, 'ALUMINIO'],
    [/CARCA\uFFFDA/gi, 'CARCASA'],
    [/COMPAT\uFFFDVEL/gi, 'COMPATIBLE'],
    [/C\uFFFDMBIO/gi, 'CAMBIO'],
    [/EDI\uFFFD\uFFFDO/gi, 'EDICION'],
    [/EST\uFFFDREO/gi, 'ESTEREO'],
    [/F\uFFFDMEA/gi, 'HEMBRA'],
    [/GERA\uFFFD\uFFFDO/gi, 'GENERACION'],
    [/GRAVA\uFFFD\uFFFDO/gi, 'GRABACION'],
    [/INGL\uFFFDS/gi, 'INGLES'],
    [/MAGN\uFFFDTICO/gi, 'MAGNETICO'],
    [/MEC\uFFFDNICO/gi, 'MECANICO'],
    [/MEM\uFFFDRIA/gi, 'MEMORIA'],
    [/MULTIFUN\uFFFD\uFFFDO/gi, 'MULTIFUNCION'],
    [/M\uFFFDDULO/gi, 'MODULO'],
    [/M\uFFFDQUINA/gi, 'MAQUINA'],
    [/M\uFFFDE/gi, 'MADRE'],
    [/N\uFFFDO/gi, 'NO'],
    [/PADR\uFFFDO/gi, 'ESTANDAR'],
    [/PE\uFFFDAS/gi, 'PIEZAS'],
    [/PL\uFFFDSTICO/gi, 'PLASTICO'],
    [/PORT\uFFFDTIL/gi, 'PORTATIL'],
    [/P\uFFFDROLA/gi, 'PERLA'],
    [/RECARREG\uFFFDVEL/gi, 'RECARGABLE'],
    [/SAT\uFFFDLITE/gi, 'SATELITE'],
    [/TRAN\uFFFDADO/gi, 'TRENZADO'],
    [/T\uFFFDTIL/gi, 'TACTIL'],
    [/VERS\uFFFDO/gi, 'VERSION'],
    [/VISI\uFFFDN/gi, 'VISION'],
    [/VIS\uFFFDO/gi, 'VISION'],
    [/V\uFFFDDEO/gi, 'VIDEO'],
    [/AT\uFFFD/gi, 'HASTA'],
    [/\uFFFDPTICO/gi, 'OPTICO'],
    [/\uFFFDUDIO/gi, 'AUDIO'],
    [/(\d)\uFFFD/g, '$1a']
];

const TRADUCCIONES = [
    [/\bsem fio\b/gi, 'Sin Cable'],
    [/\bcom fio\b/gi, 'Con Cable'],
    [/\bsem fonte\b/gi, 'Sin Fuente'],
    [/\bcom fonte\b/gi, 'Con Fuente'],
    [/\bsem cooler\b/gi, 'Sin Cooler'],
    [/\bcom cooler\b/gi, 'Con Cooler'],
    [/\bvidro temperado\b/gi, 'Vidrio Temperado'],
    [/\blateral vidro\b/gi, 'Lateral Vidrio'],
    [/\blateral acrilico\b/gi, 'Lateral Acrilico'],
    [/\btela plana\b/gi, 'Pantalla Plana'],
    [/\btela curva\b/gi, 'Pantalla Curva'],
    [/\btela\b/gi, 'Pantalla'],
    [/\bplaca de video\b/gi, 'Tarjeta de Video'],
    [/\bfonte de alimentacao\b/gi, 'Fuente de Alimentacion'],
    [/\bfonte\b/gi, 'Fuente'],
    [/\bprocessador\b/gi, 'Procesador'],
    [/\bplaca mae\b/gi, 'Placa Madre'],
    [/\barmazenamento\b/gi, 'Almacenamiento'],
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
    [/\bamarelo\b/gi, 'Amarillo'],
    [/\broxo\b/gi, 'Violeta'],
    [/\bfone de ouvido\b/gi, 'Auricular'],
    [/\bcarregador\b/gi, 'Cargador'],
    [/\bcabo\b/gi, 'Cable'],
    [/\bcabos\b/gi, 'Cables'],
    [/\bsuporte\b/gi, 'Soporte'],
    [/\broteador\b/gi, 'Router'],
    [/\bnobreak\b/gi, 'UPS'],
    [/\bcaixa de som\b/gi, 'Parlante'],
    [/\bimpressora\b/gi, 'Impresora'],
    [/\bpilhas?\b/gi, 'Pila'],
    [/\bcadeira\b/gi, 'Silla'],
    [/\bventoinha\b/gi, 'Ventilador'],
    [/\brelogio\b/gi, 'Reloj'],
    [/\bpelicula\b/gi, 'Pelicula'],

    // Agregado el 31/08 a partir de lo que se veia publicado en la tienda.
    //
    // "GARANTIA 2 ANOS" no era una eñe perdida: es portugues, y llegaba tal
    // cual a la ficha del producto, al lado del aviso en español.
    //
    // El orden importa: primero las frases completas, despues las palabras
    // sueltas. "sem" generico va al final, cuando las combinaciones de arriba
    // (sem fio, sem fonte, sem cooler, sem garantia) ya se resolvieron.
    [/\bsem\s+garantia\b/gi, 'Sin Garantía'],
    [/\bsem\s+garnatia\b/gi, 'Sin Garantía'],   // typo del proveedor, visto en el HD Seagate #24011
    [/\bcaixa\b/gi, 'Caja'],
    [/\bsem\b/gi, 'Sin'],
    [/\bn[aã]o\b/gi, 'No'],

    // "ANOS" solo se traduce pegado a la garantia. Suelto es demasiado
    // generico para un catalogo lleno de codigos de modelo.
    [/\bgarantia\s+(\d+)\s+anos?\b/gi, 'Garantía $1 Años'],

    // El proveedor corta el titulo a lo ancho y deja "GARANTIA 2 AS", que no
    // quiere decir nada: es "ANOS" partido al medio.
    [/\bgarantia\s+(\d+)\s+a[sn]\b/gi, 'Garantía $1 Años']
];

/**
 * Repara el texto corrompido por el scraper viejo.
 *
 * Primero aplica la lista explicita de palabras conocidas; lo que sobra se
 * convierte en espacio (el caso del separador perdido). Nunca queda un U+FFFD
 * visible en la tienda.
 */
export function repararMojibake(texto) {
    if (typeof texto !== 'string') return '';
    let res = texto;
    for (const [patron, reemplazo] of REPARACIONES) res = res.replace(patron, reemplazo);
    return res.split(REEMPLAZO).join(' ');
}

/** Traduce del portugues al espanol. Solo palabras completas. */
export function traducir(texto) {
    if (typeof texto !== 'string') return '';
    let res = texto;
    for (const [patron, reemplazo] of TRADUCCIONES) res = res.replace(patron, reemplazo);
    return res;
}

/** Normaliza unidades, espacios y separadores colgando al final. */
export function limpiarTitulo(texto) {
    if (typeof texto !== 'string') return '';
    return texto
        .replace(/\b(\d+)\s*hz\b/gi, '$1Hz')
        .replace(/\b(\d+)\s*ms\b/gi, '$1Ms')
        .replace(/\s+/g, ' ')
        .replace(/[\s,;:\-*]+$/, '')
        .trim();
}

/** Composicion en el orden correcto: reparar, traducir, limpiar. */
export function normalizarTitulo(texto) {
    return limpiarTitulo(traducir(repararMojibake(texto)));
}
