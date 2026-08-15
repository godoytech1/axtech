/**
 * Convencion de nombres de las imagenes publicadas.
 *
 * Vive separado de src/images/procesar.js a proposito: ese modulo importa
 * sharp, y contract.js solo necesita armar una ruta. Sin esta separacion,
 * proyectar un producto arrastraria toda la libreria de procesamiento de
 * imagenes a cada build.
 *
 * Usa el id interno de AXTECH, nunca el codigo del proveedor: publicar el ref
 * permitiria localizar cada producto en el catalogo de origen.
 */
export function nombreDeArchivo(id) {
    return `${id}.webp`;
}

export function rutaPublica(id) {
    return `/img/${nombreDeArchivo(id)}`;
}
