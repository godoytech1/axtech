import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * Los workflows no los ejecuta nadie hasta que corren de madrugada.
 *
 * El 19/09 un paso de sync.yml quedo con DOS bloques `env:`: uno que ya
 * estaba con SUPPLIER_LIST_URL y otro agregado encima con CAMBIO_DE_FORMULA.
 * YAML no admite la clave repetida, el workflow entero quedo invalido y el
 * sync nocturno --el que trae los productos nuevos del proveedor-- fallo en
 * el primer push. Nada en el repositorio lo noto: los 328 tests pasaban.
 *
 * No hay parser de YAML en el proyecto y no vale traer una dependencia para
 * esto. Lo que sigue revisa la forma, que es donde estuvo el error.
 */

const DIR = '.github/workflows';
const archivos = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));

test('hay workflows para revisar', () => {
    assert.ok(archivos.length > 0, `no se encontro ningun workflow en ${DIR}`);
});

for (const archivo of archivos) {
    test(`${archivo}: ningun paso repite una clave`, () => {
        const lineas = readFileSync(`${DIR}/${archivo}`, 'utf8')
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map((l, i) => ({ n: i + 1, texto: l }))
            .filter(({ texto }) => texto.trim() !== '' && !/^\s*#/.test(texto));

        const repetidas = [];
        let sangriaDelPaso = null;
        let vistas = new Map();

        for (const { n, texto } of lineas) {
            const sangria = texto.match(/^ */)[0].length;
            const empiezaItem = /^\s*-\s+\S/.test(texto);

            if (empiezaItem) {
                // Un item nuevo: sus claves arrancan donde arranca el guion.
                sangriaDelPaso = sangria + 2;
                vistas = new Map();
                const primera = texto.match(/^\s*-\s+([\w-]+):/);
                if (primera) vistas.set(primera[1], n);
                continue;
            }
            if (sangriaDelPaso === null) continue;

            if (sangria < sangriaDelPaso) {
                // Se salio del item.
                sangriaDelPaso = null;
                continue;
            }
            if (sangria > sangriaDelPaso) continue; // contenido anidado

            const clave = texto.match(/^\s*([\w-]+):/);
            if (!clave) continue;
            if (vistas.has(clave[1])) {
                repetidas.push(`linea ${n}: "${clave[1]}" ya estaba en la linea ${vistas.get(clave[1])}`);
            } else {
                vistas.set(clave[1], n);
            }
        }

        assert.deepEqual(repetidas, []);
    });

    test(`${archivo}: sangria de a dos espacios y sin tabuladores`, () => {
        const texto = readFileSync(`${DIR}/${archivo}`, 'utf8');
        assert.ok(!texto.includes('\t'), 'un tabulador invalida el YAML entero');
        const impares = texto.replace(/\r\n/g, '\n').split('\n')
            .map((l, i) => ({ n: i + 1, l }))
            .filter(({ l }) => l.trim() !== '' && !/^\s*#/.test(l))
            .filter(({ l }) => (l.match(/^ */)[0].length % 2) !== 0)
            .map(({ n, l }) => `linea ${n}: ${l.trim().slice(0, 40)}`);
        assert.deepEqual(impares, []);
    });
}

test('el sync le pasa al script las variables que el codigo lee', () => {
    // CAMBIO_DE_FORMULA solo sirve si llega al proceso. Estaba declarado en un
    // bloque que YAML descartaba, asi que existia en el archivo y no en la
    // corrida: exactamente el tipo de error que no se ve leyendo el diff.
    const yml = readFileSync(`${DIR}/sync.yml`, 'utf8').replace(/\r\n/g, '\n');
    const paso = yml.slice(yml.indexOf('- name: Sincronizar'));
    const hasta = paso.slice(0, paso.indexOf('\n      - name:', 1));
    assert.match(hasta, /SUPPLIER_LIST_URL:/, 'el sync necesita la URL de la lista');
    assert.match(hasta, /CAMBIO_DE_FORMULA:/, 'el sync necesita poder autorizar un cambio de formula');
    assert.equal((hasta.match(/^\s{8}env:/gm) || []).length, 1, 'el paso tiene que tener un solo bloque env');
});

for (const archivo of archivos) {
    test(`${archivo}: ninguna expresion usa la cadena vacia como rama verdadera`, () => {
        // En GitHub Actions '' es falsy, asi que en `cond && '' || 'x'` el
        // `||` se come la rama verdadera y devuelve 'x' SIEMPRE. El paso de
        // sync decia `inputs.simular && '' || '--aplicar'`: el modo simulacion
        // jamas simulo, escribia el catalogo igual que una corrida real.
        //
        // La forma correcta es darle a la rama verdadera un valor no vacio,
        // aunque el script lo ignore.
        const texto = readFileSync(`${DIR}/${archivo}`, 'utf8').replace(/\r\n/g, '\n');
        const malas = texto.split('\n')
            .map((l, i) => ({ n: i + 1, l }))
            .filter(({ l }) => !/^\s*#/.test(l))   // un comentario puede citar el error
            .filter(({ l }) => /&&\s*(''|"")\s*\|\|/.test(l))
            .map(({ n, l }) => `linea ${n}: ${l.trim().slice(0, 70)}`);
        assert.deepEqual(malas, []);
    });
}

test('el script de sync rechaza --simular y --aplicar juntos', () => {
    // Si el YAML volviera a mandar las dos, queremos un error y no que gane
    // una de las dos en silencio.
    const src = readFileSync('src/sync/ejecutar.js', 'utf8');
    assert.match(src, /--simular.*&&.*APLICAR|APLICAR.*&&.*--simular/s);
    assert.match(src, /incompatibles/i);
});
