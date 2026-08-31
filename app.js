// ==========================================================================
// AXTECH - MAIN APP JAVASCRIPT LOGIC
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // ----------------------------------------------------------------------
    // STATE VARIABLES
    // ----------------------------------------------------------------------
    let currentCategory = 'all';
    let searchQuery = '';
    let sortOrder = 'default'; // 'default', 'price-asc', 'price-desc', 'name-asc'
    let cart = [];
    let currentPage = 1;
    const productsPerPage = 36; // 36 products per page for standard grid

    let activeSubfilters = {
        monitorSizes: [],
        procBrands: [],
        notebookTypes: [],
        notebookGamerBrands: [],
        notebookOfficeBrands: [],
        gpuBrands: [],
        mbBrands: [],
        ramTypes: [],
        ramGenerations: [],
        ramFreqs: [],
        psuBrands: [],
        psuWatts: [],
        generalBrands: [],
        storageSizes: [],
        tvSizes: [],
        consoleTypes: [],
        projectorBrightness: [],
        projectorResolutions: []
    };

    // Tramos de brillo de los proyectores. Describen el uso, que es lo que el
    // comprador esta decidiendo: por debajo de 1.000 lm hace falta oscuridad;
    // de 3.000 para arriba se ve en una sala con luz.
    //
    // Vive aca arriba y no junto a su funcion porque `renderSidebarFilters`
    // corre durante la inicializacion, antes de que el cuerpo del archivo
    // termine de ejecutarse. Un `const` declarado mas abajo estaria en zona
    // muerta temporal y la barra de filtros entera reventaria.
    const TRAMOS_BRILLO = [
        { hasta: 1000, nombre: 'Hasta 999 lm' },
        { hasta: 3000, nombre: '1.000 - 2.999 lm' },
        { hasta: 4000, nombre: '3.000 - 3.999 lm' },
        { hasta: Infinity, nombre: '4.000 lm o más' }
    ];

    const SEARCH_STOP_WORDS = new Set([
        'de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
        'y', 'e', 'o', 'u', 'con', 'sin', 'para', 'por', 'en', 'a', 'com',
        'sem', 'em', 'da', 'do', 'dos', 'das'
    ]);

    const SEARCH_SYNONYMS = {
        'vga': ['placa de video', 'tarjeta de video', 'gpu', 'grafica'],
        'gpu': ['placa de video', 'tarjeta de video', 'vga', 'grafica'],
        'grafica': ['tarjeta de video', 'placa de video', 'vga', 'gpu'],
        'cpu': ['procesador', 'processador'],
        'procesador': ['cpu', 'processador'],
        'psu': ['fuente de poder', 'fonte'],
        'fuente': ['fonte', 'psu', 'fuente de poder'],
        'notebook': ['laptop', 'macbook', 'portatil'],
        'laptop': ['notebook', 'macbook', 'portatil'],
        'portatil': ['notebook', 'laptop', 'macbook'],
        'hd': ['disco duro', 'disco externo', 'hd externo', 'ssd'],
        'disco': ['ssd', 'hd', 'disco duro', 'disco externo'],
        'ram': ['memoria ram', 'ddr4', 'ddr5', 'sodimm'],
        'tv': ['televisor', 'smart tv', 'smarttv'],
        'televisor': ['tv', 'smart tv'],
        '4k': ['uhd', '2160p', 'quad hd'],
        'fhd': ['1080p', 'full hd'],
        'qhd': ['1440p', '2k', 'wqhd'],
        'curvo': ['curved', 'curva'],
        'aquario': ['aquarium', 'gabinete aquario', 'case aquario'],
        'case': ['gabinete'],
        'gabinete': ['case'],
        'headset': ['auricular', 'audifonos', 'fone'],
        'auricular': ['headset', 'audifonos', 'fone'],
        'teclado': ['keyboard'],
        'mouse': ['raton'],
        'sate': ['satellite']
    };

    function resetSubfilters() {
        activeSubfilters.monitorSizes = [];
        activeSubfilters.procBrands = [];
        activeSubfilters.notebookTypes = [];
        activeSubfilters.notebookGamerBrands = [];
        activeSubfilters.notebookOfficeBrands = [];
        activeSubfilters.gpuBrands = [];
        activeSubfilters.mbBrands = [];
        activeSubfilters.ramTypes = [];
        activeSubfilters.ramGenerations = [];
        activeSubfilters.ramFreqs = [];
        activeSubfilters.psuBrands = [];
        activeSubfilters.psuWatts = [];
        activeSubfilters.generalBrands = [];
        activeSubfilters.storageSizes = [];
        activeSubfilters.tvSizes = [];
        activeSubfilters.consoleTypes = [];
        activeSubfilters.projectorBrightness = [];
        activeSubfilters.projectorResolutions = [];
    }

    // Carga del carrito guardado.
    //
    // Antes se guardaba el objeto entero del producto. Eso tenia dos defectos
    // serios: el carrito quedaba congelado (mostraba precios viejos para
    // siempre) y conservaba en el navegador del cliente datos que ya no
    // publicamos. Ahora solo se guarda { id, quantity } y el producto se
    // resuelve contra PRODUCTS en cada render.
    if (localStorage.getItem('axtech_cart')) {
        try {
            const guardado = JSON.parse(localStorage.getItem('axtech_cart'));
            cart = (Array.isArray(guardado) ? guardado : [])
                .map(item => ({
                    // Tolera el formato viejo: extrae el id del producto anidado.
                    id: Number(item?.id ?? item?.product?.id),
                    quantity: Number(item?.quantity) || 1
                }))
                // Descarta lo que ya no existe en el catalogo (discontinuado,
                // sin stock, o guardado con el formato viejo y sin id).
                .filter(item => Number.isInteger(item.id) && PRODUCTS.some(p => p.id === item.id));

            // Reescribe de inmediato en el formato nuevo. Sin esto, el blob
            // viejo -con datos que ya no publicamos- seguiria en el navegador
            // del cliente hasta que tocara el carrito, quiza nunca.
            localStorage.setItem('axtech_cart', JSON.stringify(cart));
        } catch (e) {
            cart = [];
            localStorage.removeItem('axtech_cart');
        }
    }

    // ----------------------------------------------------------------------
    // DOM ELEMENTS
    // ----------------------------------------------------------------------
    // Catalog Elements
    const productsGrid = document.getElementById('products-grid');
    const catalogTitle = document.getElementById('catalog-title');
    const resultsCount = document.getElementById('catalog-results-count');
    const sortSelect = document.getElementById('sort-select');
    const loader = document.getElementById('catalog-loader');
    const noResultsBanner = document.getElementById('no-results-banner');
    const resetSearchBtn = document.getElementById('reset-search-btn');
    const paginationContainer = document.getElementById('pagination-container');
    const sidebarWidget = document.getElementById('sidebar-categories-widget');
    
    // Search Bar
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    
    // Autocomplete & Notification elements
    const searchSuggestions = document.getElementById('search-suggestions');
    const notificationContainer = document.getElementById('notification-container');
    
    // ----------------------------------------------------------------------
    // NAVEGACION GENERADA DESDE LA TAXONOMIA
    // ----------------------------------------------------------------------
    // Antes las categorias estaban escritas a mano en index.html y en un mapa
    // dentro de este archivo. Se desincronizaron: el menu mostraba 13 y los
    // datos tenian 18, asi que 5 categorias eran inalcanzables. Ahora la unica
    // fuente es CATEGORIES, que llega junto al catalogo.
    const CATS = typeof CATEGORIES !== 'undefined' ? CATEGORIES : [];
    const NOMBRE_DE_CATEGORIA = Object.fromEntries(CATS.map(c => [c.id, c.nombre]));

    function agregarEnlace(contenedor, tag, clase, cat, texto, icono) {
        if (!contenedor) return;
        const li = document.createElement('li');
        const el = document.createElement(tag);
        el.className = clase;
        el.dataset.category = cat.id;
        if (tag === 'a') el.href = '#';
        if (icono) {
            const i = document.createElement('i');
            i.className = 'las ' + icono;
            el.appendChild(i);
            el.appendChild(document.createTextNode(' '));
        }
        el.appendChild(document.createTextNode(texto));
        li.appendChild(el);
        contenedor.appendChild(li);
    }

    function construirNavegacion() {
        // Solo se muestran las categorias que tienen productos publicados.
        const conProductos = CATS.filter(c => PRODUCTS.some(p => p.category === c.id));
        const navUl = document.getElementById('nav-links');
        const mobileUl = document.getElementById('mobile-nav-links');
        const sidebarUl = document.getElementById('sidebar-links');
        for (const c of conProductos) {
            agregarEnlace(navUl, 'a', 'nav-link', c, c.nombre, c.icono);
            agregarEnlace(mobileUl, 'a', 'mobile-nav-link', c, c.nombre, c.icono);
            agregarEnlace(sidebarUl, 'button', 'sidebar-link', c, c.nombre, null);
        }
    }

    // Debe correr ANTES de los querySelectorAll de abajo: si no, las listas
    // quedan vacias y ningun filtro responde.
    construirNavegacion();

    // Navigation / Filtering
    const navLinks = document.querySelectorAll('.nav-link');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const footerCatLinks = document.querySelectorAll('.footer-cat-link');
    const quickCatCards = document.querySelectorAll('.quick-cat-card');
    
    // Mobile Navigation Menu
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileNavClose = document.getElementById('mobile-nav-close');
    const mobileNav = document.getElementById('mobile-nav');
    const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    // Hero Slider
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.slider-dots .dot');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    let currentSlide = 0;
    let slideInterval;

    // Cart Drawer Elements
    const cartToggleBtn = document.getElementById('cart-toggle-btn');
    const cartDrawerClose = document.getElementById('cart-drawer-close');
    const cartDrawer = document.getElementById('cart-drawer');
    const cartDrawerOverlay = document.getElementById('cart-drawer-overlay');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartEmptyState = document.getElementById('cart-empty-state');
    const cartDrawerFooter = document.getElementById('cart-drawer-footer');
    const cartCountBadge = document.getElementById('cart-count');
    const cartSubtotalPrice = document.getElementById('cart-subtotal-price');
    const cartTotalPrice = document.getElementById('cart-total-price');
    const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
    const startShoppingBtn = document.getElementById('cart-start-shopping-btn');

    // Product Details Modal Elements
    const productModal = document.getElementById('product-modal');
    const productModalOverlay = document.getElementById('product-modal-overlay');
    const productModalClose = document.getElementById('product-modal-close');
    const productModalBody = document.getElementById('product-modal-body');

    // ----------------------------------------------------------------------
    // ESTADO EN LA URL
    // ----------------------------------------------------------------------
    // Sin esto no se puede compartir una busqueda ni usar el boton atras, y
    // recargar la pagina pierde el filtro. Ademas es requisito para que la
    // Fase 2 genere paginas coherentes con esta navegacion.
    const ORDENES_VALIDOS = ['default', 'price-asc', 'price-desc'];

    function leerEstadoDeURL() {
        const q = new URLSearchParams(location.search);
        const cat = q.get('c');
        if (cat && (cat === 'all' || CATS.some(c => c.id === cat))) currentCategory = cat;
        const texto = q.get('q');
        if (texto) {
            searchQuery = texto;
            if (searchInput) searchInput.value = texto;
        }
        const pagina = parseInt(q.get('p'), 10);
        if (Number.isInteger(pagina) && pagina > 0) currentPage = pagina;
        const orden = q.get('sort');
        if (orden && ORDENES_VALIDOS.includes(orden)) {
            sortOrder = orden;
            if (sortSelect) sortSelect.value = orden;
        }
    }

    function escribirEstadoEnURL() {
        const q = new URLSearchParams();
        if (currentCategory !== 'all') q.set('c', currentCategory);
        if (searchQuery) q.set('q', searchQuery);
        if (currentPage > 1) q.set('p', String(currentPage));
        if (sortOrder !== 'default') q.set('sort', sortOrder);
        const cadena = q.toString();
        const url = cadena ? `${location.pathname}?${cadena}` : location.pathname;
        if (url === location.pathname + location.search) return;
        history.pushState({}, '', url);
    }

    window.addEventListener('popstate', () => {
        currentCategory = 'all';
        searchQuery = '';
        currentPage = 1;
        sortOrder = 'default';
        if (searchInput) searchInput.value = '';
        if (sortSelect) sortSelect.value = 'default';
        leerEstadoDeURL();
        // Igual que en el arranque: la barra tiene que seguir a la categoria
        // que trae la URL, tambien al volver con el boton de atras.
        renderSidebarFilters(currentCategory);
        syncCategoryLinks(currentCategory);
        renderProducts();
    });

    // ----------------------------------------------------------------------
    // INITIALIZATION & SETUP
    // ----------------------------------------------------------------------
    initSlider();
    leerEstadoDeURL();
    // La barra de filtros se dibuja DESPUES de leer la URL, con la categoria
    // que salio de ella. Antes se la dibujaba antes, y siempre con 'all', que
    // es el unico valor para el que se esconde: quien entraba directo a
    // /?c=monitores --desde Google, desde un link compartido o recargando la
    // pagina-- veia el catalogo filtrado pero sin un solo filtro al costado.
    renderSidebarFilters(currentCategory);
    syncCategoryLinks(currentCategory);
    renderProducts();
    updateCartUI();

    // ----------------------------------------------------------------------
    // HERO BANNER SLIDER FUNCTIONS
    // ----------------------------------------------------------------------
    function initSlider() {
        if (slides.length === 0) return;
        
        // Next slide function
        function goToNextSlide() {
            slides[currentSlide].classList.remove('active');
            dots[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
            dots[currentSlide].classList.add('active');
        }

        // Prev slide function
        function goToPrevSlide() {
            slides[currentSlide].classList.remove('active');
            dots[currentSlide].classList.remove('active');
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
            slides[currentSlide].classList.add('active');
            dots[currentSlide].classList.add('active');
        }

        // Start Auto Rotation
        function startSlideShow() {
            clearInterval(slideInterval);
            slideInterval = setInterval(goToNextSlide, 6000);
        }

        // Click Event Handlers for controls
        if (nextBtn) nextBtn.addEventListener('click', () => { goToNextSlide(); startSlideShow(); });
        if (prevBtn) prevBtn.addEventListener('click', () => { goToPrevSlide(); startSlideShow(); });

        dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-slide'));
                slides[currentSlide].classList.remove('active');
                dots[currentSlide].classList.remove('active');
                currentSlide = index;
                slides[currentSlide].classList.add('active');
                dots[currentSlide].classList.add('active');
                startSlideShow();
            });
        });

        // Click on slider CTAs to go directly to categories
        const sliderCatBtns = document.querySelectorAll('[data-go-category]');
        sliderCatBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetCat = btn.getAttribute('data-go-category');
                filterByCategory(targetCat);
                scrollToCatalog();
            });
        });

        startSlideShow();
    }

    // ----------------------------------------------------------------------
    // CATEGORY BADGES COUNT GENERATOR
    // ----------------------------------------------------------------------
    function isMonitorTitleSizeMatch(title, targetSizeNum) {
        const t = title.toLowerCase();
        if (targetSizeNum === '24') {
            return /\b(24|23\.8|23\.6|24\.5)\b/i.test(t);
        }
        if (targetSizeNum === '27') {
            return /\b(27|26\.9|27\.0)\b/i.test(t);
        }
        if (targetSizeNum === '32') {
            return /\b(32|31\.5|32\.0)\b/i.test(t);
        }
        if (targetSizeNum === '20') {
            return /\b(20|19\.5|20\.0)\b/i.test(t);
        }
        if (targetSizeNum === '22') {
            return /\b(21\.5|22|21\.45)\b/i.test(t);
        }
        return new RegExp(`\\b${targetSizeNum}\\b`, 'i').test(t);
    }

    // ----------------------------------------------------------------------
    // PRODUCTS CATALOG RENDER LOGIC
    // ----------------------------------------------------------------------
    function renderProducts() {
        // Show loader
        loader.style.display = 'flex';
        productsGrid.innerHTML = '';
        noResultsBanner.style.display = 'none';

        // 1. FILTER products based on current category, search query and sub-filters
        let filtered = PRODUCTS.filter(p => {
            const rawQuery = searchQuery.toLowerCase().trim();

            // "Todo" incluye TODO, televisores incluidos.
            //
            // Antes se los escondia salvo que la busqueda dijera "tv" o
            // "televisor". El resultado era que 121 productos existian en el
            // menu y en su categoria, pero un cliente que navegaba el catalogo
            // completo no los veia nunca: una categoria a la vista cuyos
            // productos no estaban donde deberian.
            const categoryMatch = currentCategory === 'all'
                ? true
                : p.category === currentCategory;
            
            // Search match (intelligent multi-word search, matching all words in any order, ignoring stop words)
            let searchMatch = true;
            if (rawQuery) {
                let cleaned = rawQuery
                    .replace(/["'“”’]/g, ' ')
                    .replace(/\b(pulgadas|polegadas|inch|inches)\b/gi, '')
                    .trim();

                let queryWords = cleaned.split(/\s+/).filter(word => word.length > 0);

                // Filter out common connector/stop words unless they are the only words typed
                const filteredWords = queryWords.filter(w => !SEARCH_STOP_WORDS.has(w));
                if (filteredWords.length > 0) {
                    queryWords = filteredWords;
                }

                // Strict Monitor Size Filter when searching for size numbers (e.g. "24", "27", "32")
                const isMonitorQuery = p.category === 'monitores' || queryWords.includes('monitor') || queryWords.includes('monitores');
                const sizeNumberWord = queryWords.find(w => /^\d{2}$/.test(w) && ['24', '27', '32', '20', '22', '34'].includes(w));

                if (isMonitorQuery && sizeNumberWord) {
                    if (!isMonitorTitleSizeMatch(p.title, sizeNumberWord)) {
                        return false;
                    }
                }

                const titleLower = p.title.toLowerCase();
                const brandLower = p.brand.toLowerCase();
                const categoryLower = p.category.toLowerCase();
                const specsLower = (p.specs || []).join(' ').toLowerCase();

                // Sin title_orig ni ref: son datos del proveedor y no se publican.
                const textToSearch = `${titleLower} ${brandLower} ${categoryLower} ${specsLower}`;

                searchMatch = queryWords.every(word => {
                    if (word === sizeNumberWord && isMonitorQuery) {
                        return true; // Already strictly validated by isMonitorTitleSizeMatch
                    }
                    if (textToSearch.includes(word)) {
                        return true;
                    }
                    const syns = SEARCH_SYNONYMS[word];
                    if (syns && syns.some(s => textToSearch.includes(s))) {
                        return true;
                    }
                    // Smart size equivalences (e.g. 24 matches 23.8, 23.6, 24.5)
                    if (word === '24') {
                        return /\b(24|23\.8|23\.6|24\.5)\b/.test(textToSearch);
                    }
                    if (word === '27') {
                        return /\b(27|26\.9|27\.0)\b/.test(textToSearch);
                    }
                    if (word === '32') {
                        return /\b(32|31\.5|32\.0)\b/.test(textToSearch);
                    }
                    return false;
                });


                // Smart search logic: if query is for parts but category is Notebooks
                if (searchMatch && p.category === 'notebooks') {
                    const isPartQuery = queryWords.some(w => ['ssd', 'rtx', 'gtx', 'ram', 'intel', 'ryzen', 'ddr4', 'ddr5', '1tb', '512gb', 'm.2', 'monitor'].includes(w));
                    const isNotebookQuery = queryWords.some(w => ['notebook', 'laptop', 'acer', 'asus', 'lenovo', 'hp', 'macbook'].includes(w));
                    if (isPartQuery && !isNotebookQuery) {
                        searchMatch = false;
                    }
                }
            }
            
            if (!categoryMatch || !searchMatch) return false;

            // Sub-filters
            if (currentCategory === 'monitores') {
                if (activeSubfilters.monitorSizes.length > 0) {
                    const size = getMonitorSize(p.title);
                    if (!size || !activeSubfilters.monitorSizes.includes(size)) return false;
                }
            } else if (currentCategory === 'procesadores') {
                if (activeSubfilters.procBrands.length > 0) {
                    const brand = p.brand.toUpperCase();
                    if (!activeSubfilters.procBrands.includes(brand)) return false;
                }
            } else if (currentCategory === 'notebooks') {
                const type = getNotebookType(p.title);
                const hasGamerBrandFilters = activeSubfilters.notebookGamerBrands && activeSubfilters.notebookGamerBrands.length > 0;
                const hasOfficeBrandFilters = activeSubfilters.notebookOfficeBrands && activeSubfilters.notebookOfficeBrands.length > 0;
                
                const isGamerRequested = activeSubfilters.notebookTypes.includes('Gamer') || hasGamerBrandFilters;
                const isOfficeRequested = activeSubfilters.notebookTypes.includes('Ofimática') || hasOfficeBrandFilters;
                
                if (isGamerRequested || isOfficeRequested) {
                    if (type === 'Gamer') {
                        if (!isGamerRequested) return false;
                        if (hasGamerBrandFilters && !activeSubfilters.notebookGamerBrands.includes(p.brand)) return false;
                    } else if (type === 'Ofimática') {
                        if (!isOfficeRequested) return false;
                        if (hasOfficeBrandFilters && !activeSubfilters.notebookOfficeBrands.includes(p.brand)) return false;
                    }
                }
            } else if (currentCategory === 'tarjetas-de-video') {
                if (activeSubfilters.gpuBrands.length > 0) {
                    const chip = getGpuChip(p.title);
                    if (!chip || !activeSubfilters.gpuBrands.includes(chip)) return false;
                }
            } else if (currentCategory === 'placas-madre') {
                if (activeSubfilters.mbBrands.length > 0) {
                    const platform = getMbPlatform(p.title);
                    if (!platform || !activeSubfilters.mbBrands.includes(platform)) return false;
                }
            } else if (currentCategory === 'memorias-ram') {
                if (activeSubfilters.ramTypes && activeSubfilters.ramTypes.length > 0) {
                    const type = getRamType(p.title);
                    if (!type || !activeSubfilters.ramTypes.includes(type)) return false;
                }
                if (activeSubfilters.ramGenerations && activeSubfilters.ramGenerations.length > 0) {
                    const gen = getRamGeneration(p.title);
                    if (!gen || !activeSubfilters.ramGenerations.includes(gen)) return false;
                }
                if (activeSubfilters.ramFreqs.length > 0) {
                    const freq = getRamFrequency(p.title);
                    if (!freq || !activeSubfilters.ramFreqs.includes(freq)) return false;
                }
            } else if (currentCategory === 'televisores') {
                if (activeSubfilters.tvSizes && activeSubfilters.tvSizes.length > 0) {
                    const size = getTvSize(p.title);
                    if (!size || !activeSubfilters.tvSizes.includes(size)) return false;
                }
            } else if (currentCategory === 'proyectores') {
                if (activeSubfilters.projectorBrightness.length > 0) {
                    const brillo = getProjectorBrightness(p.title);
                    if (!brillo || !activeSubfilters.projectorBrightness.includes(brillo)) return false;
                }
                if (activeSubfilters.projectorResolutions.length > 0) {
                    const res = getProjectorResolution(p.title);
                    if (!res || !activeSubfilters.projectorResolutions.includes(res)) return false;
                }
            } else if (currentCategory === 'fuentes-de-poder') {
                if (activeSubfilters.psuBrands.length > 0) {
                    if (!activeSubfilters.psuBrands.includes(p.brand)) return false;
                }
                if (activeSubfilters.psuWatts.length > 0) {
                    const watts = getPsuWattage(p.title);
                    if (!watts || !activeSubfilters.psuWatts.includes(watts)) return false;
                }
            } else if (currentCategory === 'almacenamiento-ssd') {
                if (activeSubfilters.storageSizes && activeSubfilters.storageSizes.length > 0) {
                    const capacity = getStorageCapacity(p.title);
                    if (!capacity || !activeSubfilters.storageSizes.includes(capacity)) return false;
                }
            } else if (currentCategory === 'consolas-y-videojuegos') {
                if (activeSubfilters.consoleTypes && activeSubfilters.consoleTypes.length > 0) {
                    const type = getConsoleProductType(p.title);
                    if (!type || !activeSubfilters.consoleTypes.includes(type)) return false;
                }
            } else {
                if (activeSubfilters.generalBrands && activeSubfilters.generalBrands.length > 0) {
                    if (!activeSubfilters.generalBrands.includes(p.brand)) return false;
                }
            }

            return true;
        });

        // 2. SORT products based on selected sort order
        if (searchQuery.trim() !== '' && sortOrder === 'default') {
            const rawQuery = searchQuery.toLowerCase().trim();
            let cleaned = rawQuery
                .replace(/["'“”’]/g, ' ')
                .replace(/\b(pulgadas|polegadas|inch|inches)\b/gi, '')
                .trim();
            let queryWords = cleaned.split(/\s+/).filter(w => w.length > 0);
            const filteredWords = queryWords.filter(w => !SEARCH_STOP_WORDS.has(w));
            if (filteredWords.length > 0) queryWords = filteredWords;

            filtered.sort((a, b) => {
                let scoreA = 0;
                let scoreB = 0;

                const titleA = a.title.toLowerCase();
                const titleB = b.title.toLowerCase();

                queryWords.forEach(w => {
                    if (titleA.includes(w)) scoreA += 10;
                    if (titleB.includes(w)) scoreB += 10;
                    if (a.brand.toLowerCase() === w) scoreA += 15;
                    if (b.brand.toLowerCase() === w) scoreB += 15;
                    if (a.category.toLowerCase().includes(w)) scoreA += 25;
                    if (b.category.toLowerCase().includes(w)) scoreB += 25;
                });

                if (queryWords.includes('24')) {
                    if (/\b(24|23\.8|23\.6)\s*("|inch|pulgadas)?\b/i.test(titleA)) scoreA += 40;
                    if (/\b(24|23\.8|23\.6)\s*("|inch|pulgadas)?\b/i.test(titleB)) scoreB += 40;
                }

                if (queryWords.includes('monitor') || queryWords.includes('monitores')) {
                    if (a.category === 'monitores') scoreA += 50;
                    if (b.category === 'monitores') scoreB += 50;
                    if (titleA.includes('soporte') || titleA.includes('brazo')) scoreA -= 40;
                    if (titleB.includes('soporte') || titleB.includes('brazo')) scoreB -= 40;
                }

                return scoreB - scoreA;
            });
        } else if (currentCategory === 'all' && sortOrder === 'default' && searchQuery === '') {
            // Group filtered products by category
            // Se intercalan TODAS las categorias, una por vuelta, para que la
            // primera pantalla muestre variedad.
            //
            // Antes se mezclaban solo cuatro categorias elegidas a mano y todo
            // lo demas caia en un mismo saco "otros", que aportaba un producto
            // por vuelta entre las 24 categorias restantes. En la practica la
            // portada abria con una pared de notebooks, porque son los ids mas
            // bajos del catalogo y el saco los servia en orden.
            const porCategoria = new Map();
            for (const p of filtered) {
                if (!porCategoria.has(p.category)) porCategoria.set(p.category, []);
                porCategoria.get(p.category).push(p);
            }

            const grupos = [...porCategoria.values()];
            const maxLength = Math.max(0, ...grupos.map((g) => g.length));
            const mixed = [];
            for (let i = 0; i < maxLength; i++) {
                for (const grupo of grupos) {
                    if (i < grupo.length) mixed.push(grupo[i]);
                }
            }

            filtered = mixed;
        } else if (currentCategory === 'consolas-y-videojuegos' && sortOrder === 'default') {
            filtered.sort((a, b) => {
                const typeA = getConsoleProductType(a.title);
                const typeB = getConsoleProductType(b.title);
                if (typeA === 'Consolas' && typeB !== 'Consolas') return -1;
                if (typeA !== 'Consolas' && typeB === 'Consolas') return 1;
                return 0;
            });
        } else if (sortOrder === 'price-asc') {
            filtered.sort((a, b) => {
                if (a.sob_consulta && !b.sob_consulta) return 1;
                if (!a.sob_consulta && b.sob_consulta) return -1;
                if (a.sob_consulta && b.sob_consulta) return a.title.localeCompare(b.title);
                return a.pyg - b.pyg;
            });
        } else if (sortOrder === 'price-desc') {
            filtered.sort((a, b) => {
                if (a.sob_consulta && !b.sob_consulta) return 1;
                if (!a.sob_consulta && b.sob_consulta) return -1;
                if (a.sob_consulta && b.sob_consulta) return a.title.localeCompare(b.title);
                return b.pyg - a.pyg;
            });
        } else if (sortOrder === 'name-asc') {
            filtered.sort((a, b) => a.title.localeCompare(b.title));
        }

        const currentPerPage = currentCategory === 'all' ? 50 : 36;
        const totalFilteredProducts = filtered.length;
        const totalPages = Math.ceil(totalFilteredProducts / currentPerPage);
        
        // Ensure currentPage is within bounds
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = totalPages;
        }

        // Get slice of products for current page
        const startIndex = (currentPage - 1) * currentPerPage;
        const endIndex = startIndex + currentPerPage;
        const paginatedProducts = filtered.slice(startIndex, endIndex);

        // Antes habia aqui un setTimeout de 300ms "para dar sensacion premium".
        // El efecto real era 300ms de espera en cada filtro, cada busqueda y
        // cada cambio de pagina. Se rendiriza de inmediato.
        {
            loader.style.display = 'none';

            // "Destacado" = entre los 12 productos mas nuevos. Antes se decidia
            // con ids escritos a mano (id <= 3 || id === 25 || ...).
            const productosDestacados = new Set(
                [...PRODUCTS].sort((a, b) => b.id - a.id).slice(0, 12).map((p) => p.id)
            );
            
            if (totalFilteredProducts === 0) {
                noResultsBanner.style.display = 'flex';
                resultsCount.textContent = '0 productos encontrados';
                paginationContainer.style.display = 'none';
                return;
            }

            // Render cards
            paginatedProducts.forEach(p => {
                const card = document.createElement('div');
                card.className = 'product-card';
                card.setAttribute('data-id', p.id);
                
                // Badges
                const isNew = productosDestacados.has(p.id);
                let badgeHTML = '';
                if (p.sob_consulta) {
                    badgeHTML = `<span class="product-badge badge-sob-consulta">Bajo Consulta</span>`;
                } else if (isNew) {
                    badgeHTML = `<span class="product-badge badge-new">Destacado</span>`;
                }

                const priceHTML = p.sob_consulta
                    ? `<span class="price-sob-consulta">Bajo Consulta</span>`
                    : `<span class="price-main">${p.pyg_str}</span>`;

                const waMsg = encodeURIComponent(`Hola, quisiera consultar sobre el producto: ${p.title}\nPrecio: ${p.sob_consulta ? 'Bajo Consulta' : p.pyg_str}\nLink / Imagen: ${p.image}`);
                const buttonHTML = p.sob_consulta
                    ? `<a href="https://wa.me/595976914662?text=${waMsg}" target="_blank" class="btn btn-sob-consulta btn-consult" style="flex: 1; text-decoration: none;" onclick="event.stopPropagation();">
                        <i class="lab la-whatsapp"></i> Consultar
                       </a>`
                    : `<button class="btn btn-primary btn-add-cart" data-add-id="${p.id}">
                        <i class="las la-cart-plus"></i> Agregar
                       </button>`;

                // El titulo y la marca vienen de raspar el HTML de un tercero:
                // interpolarlos en innerHTML permitiria inyectar marcado. Se
                // dejan vacios aca y se llenan con textContent, que no
                // interpreta HTML. width/height evitan el salto de layout.
                card.innerHTML = `
                    ${badgeHTML}
                    <div class="product-image-container">
                        <img src="${p.image}" alt="" loading="lazy" width="310" height="310">
                    </div>
                    <div class="product-brand"></div>
                    <h4 class="product-name"></h4>
                    <div class="product-price-block">
                        ${priceHTML}
                    </div>
                    <div class="product-actions">
                        ${buttonHTML}
                        <button class="btn btn-outline btn-view" data-view-id="${p.id}" title="Ver Detalle">
                            <i class="las la-eye"></i>
                        </button>
                    </div>
                `;
                // GENERIC no es una marca: es la etiqueta interna para "no se
                // pudo detectar". Mostrarsela al cliente en 1.193 productos
                // hacia parecer que existe un fabricante llamado asi.
                card.querySelector('.product-brand').textContent =
                    p.brand && p.brand !== 'GENERIC' ? p.brand : '';
                card.querySelector('.product-name').textContent = p.title;
                card.querySelector('img').alt = p.title;

                // Sin listeners por tarjeta: los maneja la delegacion definida
                // debajo de renderProducts. Antes eran 4 listeners x 36
                // tarjetas = 144, recreados en cada render.
                card.dataset.productId = p.id;
                productsGrid.appendChild(card);
            });

            escribirEstadoEnURL();

            // Render Pagination Controls
            renderPaginationControls(totalPages);

            // El nombre sale de la taxonomia, no de un mapa escrito a mano.
            catalogTitle.textContent = currentCategory === 'all'
                ? 'Todos los Productos'
                : (NOMBRE_DE_CATEGORIA[currentCategory] || 'Catálogo');
            resultsCount.textContent = `Mostrando ${startIndex + 1} - ${Math.min(endIndex, totalFilteredProducts)} de ${totalFilteredProducts} productos`;

        }
    }

    // ----------------------------------------------------------------------
    // DELEGACION DE EVENTOS DE LAS TARJETAS
    // ----------------------------------------------------------------------
    // Un listener en el contenedor en vez de cuatro por tarjeta. Con 36
    // tarjetas por pagina eran 144 listeners recreados en cada render.
    productsGrid.addEventListener('click', (e) => {
        const agregar = e.target.closest('.btn-add-cart');
        if (agregar) {
            e.stopPropagation();
            addToCart(Number(agregar.dataset.addId));
            return;
        }
        const ver = e.target.closest('.btn-view');
        if (ver) {
            e.stopPropagation();
            openProductModal(Number(ver.dataset.viewId));
            return;
        }
        const tarjeta = e.target.closest('[data-product-id]');
        if (tarjeta && (e.target.closest('.product-image-container') || e.target.closest('.product-name'))) {
            openProductModal(Number(tarjeta.dataset.productId));
        }
    });

    // Imagen rota: se oculta solo la imagen, no la tarjeta. Ocultar la tarjeta
    // dejaba huecos en la grilla y hacia mentir al contador de resultados.
    // El evento 'error' de <img> no burbujea: hay que capturarlo (tercer
    // argumento en true).
    productsGrid.addEventListener('error', (e) => {
        if (e.target.tagName !== 'IMG') return;
        e.target.style.visibility = 'hidden';
        e.target.closest('.product-image-container')?.classList.add('sin-imagen');
    }, true);

    // ----------------------------------------------------------------------
    // PAGINATION CONTROLS GENERATOR
    // ----------------------------------------------------------------------
    function renderPaginationControls(totalPages) {
        paginationContainer.innerHTML = '';
        
        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'flex';
        const paginationList = document.createElement('ul');
        paginationList.className = 'pagination';

        // 1. Previous Page Button
        if (currentPage > 1) {
            const prevLi = document.createElement('li');
            prevLi.className = 'page-item';
            prevLi.innerHTML = `<button class="page-link page-link-prev"><i class="las la-angle-left"></i> Anterior</button>`;
            prevLi.addEventListener('click', () => {
                currentPage--;
                renderProducts();
                scrollToCatalog();
            });
            paginationList.appendChild(prevLi);
        }

        // 2. Page Number Buttons
        // Show at most 5 page buttons around currentPage
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            const numLi = document.createElement('li');
            numLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
            numLi.innerHTML = `<button class="page-link">${i}</button>`;
            numLi.addEventListener('click', () => {
                currentPage = i;
                renderProducts();
                scrollToCatalog();
            });
            paginationList.appendChild(numLi);
        }

        // 3. Next Page Button
        if (currentPage < totalPages) {
            const nextLi = document.createElement('li');
            nextLi.className = 'page-item';
            nextLi.innerHTML = `<button class="page-link page-link-next">Siguiente <i class="las la-angle-right"></i></button>`;
            nextLi.addEventListener('click', () => {
                currentPage++;
                renderProducts();
                scrollToCatalog();
            });
            paginationList.appendChild(nextLi);
        }

        paginationContainer.appendChild(paginationList);
    }

    // ----------------------------------------------------------------------
    // SUB-FILTERS HELPER AND RENDERING LOGIC
    // ----------------------------------------------------------------------
    // El atajo "TV 55" existe porque el proveedor no siempre pone la comilla.
    // Le faltaba el \b inicial y se metia dentro de otras palabras: "RECEPTOR
    // HTV H8 4K IPTV 16GB/2GB" matcheaba el "TV 16" de "IPTV 16GB" y publicaba
    // dos receptores como televisores de 16 pulgadas, con su opcion propia en
    // el filtro de tamanio.
    function getTvSize(title) {
        let match = title.match(/(\d{2,3})\s*(?:"|polegadas|inch|'|Pulgadas)/i);
        if (!match) {
            const abreviado = title.match(/\bTV\s+(\d{2,3})(?!\s*(?:gb|tb|mb|hz|k\b))/i);
            // Un televisor de menos de 24 o mas de 110 pulgadas no existe en
            // este catalogo: si el numero cae fuera, no era una medida.
            if (abreviado && +abreviado[1] >= 24 && +abreviado[1] <= 110) match = abreviado;
        }
        if (match) {
            let val = parseInt(match[1], 10);
            if (val >= 30 && val <= 39) return "32\"";
            if (val >= 40 && val <= 47) return "43\"";
            if (val >= 48 && val <= 52) return "50\"";
            if (val >= 53 && val <= 59) return "55\"";
            if (val >= 60 && val <= 69) return "65\"";
            if (val >= 70 && val <= 79) return "75\"";
            if (val >= 80) return "85\"+";
            return val + '"';
        }
        return null;
    }

    // ----------------------------------------------------------------------
    // PROYECTORES
    // ----------------------------------------------------------------------
    //
    // Lo que decide una compra de proyector es el brillo, no la marca. El
    // catalogo lo escribe de seis formas distintas:
    //
    //   "4800 LUMENS"  "350 LUMENES"  "900LUM"  "3600L"  "3000L/WXGA"  "400L HDMI"
    //
    // Se exige la unidad. Sin ella, los numeros de modelo se colarian como
    // brillo: "DUB 3800" y "EH-LS300B" llevan cifras de tres y cuatro digitos
    // que no tienen nada que ver. Verificado contra los 21 titulos reales:
    // 14 con brillo, cero falsos positivos.
    function getProjectorLumens(title) {
        const m = title.match(/(\d{3,5})\s*(?:lumens|lumenes|lum\b|l\b)/i);
        return m ? parseInt(m[1], 10) : null;
    }

    function getProjectorBrightness(title) {
        const lm = getProjectorLumens(title);
        if (lm === null) return null;
        return TRAMOS_BRILLO.find((t) => lm < t.hasta).nombre;
    }

    function getProjectorResolution(title) {
        const t = title.toUpperCase();
        if (/\b4K\b/.test(t)) return '4K';
        if (/\bFHD\b|\bFULL ?HD\b|\b1080P?\b/.test(t)) return 'Full HD';
        if (/\bWXGA\b/.test(t)) return 'WXGA';
        if (/\bHD\b/.test(t)) return 'HD';
        return null;
    }

    function getMonitorSize(title) {
        const t = title.toLowerCase();

        if (t.includes('soporte') || t.includes('suporte') || t.includes('brazo')) return null;

        // Normalize spaces in decimal numbers (e.g. "23 8" -> "23.8", "31 5" -> "31.5")
        const cleaned = t.replace(/\b(\d{2})\s+(\d{1,2})\b/g, '$1.$2');

        // 1. Match explicit quotes: e.g. 24", 23.8", 27", 15.6"
        let match = cleaned.match(/(\d{2}(?:\.\d+)?)\s*"/);
        
        // 2. Match explicit unit words: e.g. 24 pulgadas, 27 inch, 23.8 polegadas
        if (!match) {
            match = cleaned.match(/(\d{2}(?:\.\d+)?)\s*(?:pulgadas|polegadas|inch|inches)\b/i);
        }

        // 3. Match MON / MONITOR followed by size number: e.g. "MON 24 ", "MON 23.8", "MONITOR 27"
        if (!match) {
            match = cleaned.match(/\b(?:mon|monitor)\b.*?\b(14|15\.4|15\.6|15|16|17|18\.5|18|19|20|21\.45|21\.5|21|22|23\.6|23\.8|24|24\.5|25|26|27|28|29|30|31\.5|32|34|40|49)\b/i);
        }

        if (match) {
            const val = parseFloat(match[1]);
            // Tramos contiguos. Antes quedaban huecos (28-30.9, 35-40, 44-48)
            // y cada medida que caia en uno se convertia en su propia opcion
            // del filtro: hoy hay un monitor de 28" y otro de 29" con una
            // casilla para cada uno.
            if (val < 13) return null;   // no es la medida de un monitor
            if (val < 17) return '15-16';
            if (val < 20) return '17-19';
            if (val < 23) return '20-22';
            if (val < 25) return '24';
            if (val < 28) return '27';
            if (val < 31) return '28-30';
            if (val < 33) return '32';
            if (val < 36) return '34';
            if (val < 45) return '40';
            return '49';
        }
        return null;
    }


    // Se decide por el CHIP, que es lo que el comprador filtra, no por la marca
    // que ensambla la placa. Antes esta funcion buscaba "rx " CON ESPACIO y el
    // proveedor escribe "RX580" pegado: once placas AMD (RX 580, RX 560, RX
    // 7600, R5 230, R5 220, R7 350, HD 7670) se mostraban como NVIDIA porque
    // caian en el `return 'NVIDIA'` del final.
    //
    // "ASROCK" y "CHALLENGER" salieron de la lista de AMD: ASRock tambien
    // fabrica placas Intel Arc, y la linea Challenger existe en las dos. Con
    // ellas dentro, "VGA ASROCK INTEL ARC B570 CHALLENGER" quedaba como AMD.
    // Las AMD de ASRock se reconocen igual por su propio modelo (RX 9070 XT).
    //
    // Si no hay evidencia de ningun chip devuelve null: el producto sigue
    // visible en la categoria, pero ninguna opcion del filtro lo reclama.
    function getGpuChip(title) {
        const t = title.toLowerCase();
        if (/\bintel\b|\barc\s?[ab]\d{3}\b/.test(t)) return 'INTEL';
        if (/radeon|\brx ?\d{3,4}|\br[3579][ -]?\d{3}\b|\bhd ?\d{4}\b|\bvega\b|\bamd\b|xfx|sapphire|powercolor|power color|hellhound|steel legend|\bpulse\b/.test(t)) {
            return 'AMD';
        }
        if (/nvidia|geforce|\brtx ?\d|\bgtx ?\d|\bgt ?\d{3}|\bg\d{3}\b|quadro/.test(t)) return 'NVIDIA';
        return null;
    }

    // El proveedor escribe el socket pegado a la abreviatura: "MB 1851 ...",
    // "MB AM5 ...". Ese es el dato mas confiable del titulo, asi que se lee
    // primero y el chipset queda de respaldo.
    //
    // Antes terminaba en `return 'INTEL'`, o sea que cualquier placa que el
    // codigo no reconociera se declaraba Intel. Hoy hay 19 placas de socket
    // 1851 y 775 que ningun patron detectaba y que aparecian como Intel de
    // pura casualidad: la casualidad se acaba el dia que el proveedor traiga
    // un socket AMD nuevo, y entonces se venden placas AMD como Intel.
    //
    // Ojo con los chipsets de la serie 800: B850 y X870 son AMD, B860 y Z890
    // son Intel. Un digito de diferencia.
    const SOCKETS_AMD = new Set(['am3', 'am4', 'am5', 'fm2']);
    const SOCKETS_INTEL = new Set(['775', '1150', '1151', '1155', '1200', '1700', '1851', '2011']);

    function getMbPlatform(title) {
        const t = title.toLowerCase();

        const socket = t.match(/^mb\s+(am\d|fm\d|\d{3,4})\b/);
        if (socket) {
            if (SOCKETS_AMD.has(socket[1])) return 'AMD';
            if (SOCKETS_INTEL.has(socket[1])) return 'INTEL';
        }
        if (/\b(am[345]|fm2|a320|a520|a620|b350|b450|b550|b650|b840|b850|x370|x470|x570|x670|x870)\b/.test(t)) return 'AMD';
        if (/\b(h81|h110|h310|h410|h470|h510|h610|h770|h810|b250|b360|b365|b460|b560|b660|b760|b860|z170|z270|z370|z390|z490|z590|z690|z790|z890|x99)\b/.test(t)) return 'INTEL';
        if (/\blga\s?(1150|1151|1155|1200|1700|1851|2011)\b/.test(t)) return 'INTEL';
        if (/\bryzen\b|\bamd\b/.test(t)) return 'AMD';
        if (/\bintel\b/.test(t)) return 'INTEL';
        return null;
    }

    // Aca el `return` del final SI es legitimo, a diferencia de los otros
    // clasificadores: "gamer" y "ofimatica" son un segmento de venta, no un
    // dato fisico. Una notebook que no nombra ninguna GPU dedicada ni ninguna
    // linea gamer es, efectivamente, de oficina. No hay nada que adivinar.
    //
    // Lo que si faltaba era la mitad de las lineas gamer del mercado. Hoy no
    // hay stock de ninguna de ellas, asi que no cambia ningun producto: se
    // agregan para que el dia que entre una ROG o una Legion no aparezca en
    // "Ofimatica" sin que nadie se entere.
    const LINEAS_GAMER = [
        'rtx', 'gtx', 'gaming', 'gamer', 'nitro', 'predator', 'victus', 'loq', 'tuf',
        'rog', 'legion', 'omen', 'alienware', 'katana', 'sword', 'cyborg', 'raider',
        'stealth', 'vector', 'aorus', 'helios', 'zephyrus', 'strix', 'crosshair', 'titan'
    ];

    function getNotebookType(title) {
        const titleLower = title.toLowerCase();
        for (let term of LINEAS_GAMER) {
            if (titleLower.includes(term)) {
                return 'Gamer';
            }
        }
        return 'Ofimática';
    }

    function getRamGeneration(title) {
        const match = title.match(/DDR[345]/i);
        return match ? match[0].toUpperCase() : null;
    }

    // El catalogo marca la memoria de notebook con "NB" justo despues de "MEM":
    // "MEM NB DDR4 8GB 3200 KINGSTON KCP432SS8/8". Las 77 memorias que lo
    // llevan son SODIMM sin una sola excepcion.
    //
    // Antes esta funcion no miraba "NB" y buscaba la palabra "SODIMM", que el
    // proveedor solo escribe cuando se acuerda: aparece en 22 de las 77. Las
    // otras 55 caian en el `return 'PC'` del final y se mostraban al filtrar
    // por PC. Un modulo SODIMM no entra fisicamente en un motherboard de
    // escritorio, asi que era una venta equivocada esperando a pasar.
    //
    // "LO-DIMM" no sirve como senial: el proveedor lo escribe tanto en modulos
    // de notebook como de escritorio ("MEM DDR4 16GB 3200 MACROWAY LO-DIMM").
    function getRamType(title) {
        const t = title.toLowerCase();
        if (
            /\bnb\b/.test(t) ||
            t.includes('sodimm') ||
            t.includes('so-dimm') ||
            t.includes('notebook') ||
            t.includes('laptop') ||
            t.includes('macbook') ||
            /\bmac\b/.test(t)
        ) {
            return 'Laptop';
        }
        return 'PC';
    }

    function getRamFrequency(title) {
        const match = title.match(/(\d{4})\s*MHz/i);
        if (match) return match[1] + 'MHz';
        const frequencies = ['1600', '2400', '2666', '3000', '3200', '3600', '4800', '5200', '5600', '6000', '6400', '7200'];
        for (let freq of frequencies) {
            if (title.includes(freq)) {
                return freq + 'MHz';
            }
        }
        return null;
    }

    // Los tramos tenian huecos: 451-499, 601-649, 751-799 y 851-999 no entraban
    // en ninguno y caian en el `return w + 'W'` del final, que le inventa al
    // filtro una opcion suelta para un solo producto ("480W"). Ahora son
    // contiguos y no hay vatiaje que quede afuera.
    function getPsuWattage(title) {
        const match = title.match(/(\d+)\s*W\b/i);
        if (!match) return null;
        const w = parseInt(match[1], 10);
        // Menos de 150W no es una fuente de PC: son adaptadores e inyectores
        // PoE que se colaban en la categoria.
        if (w < 150) return null;
        if (w < 500) return '200W - 450W';
        if (w < 650) return '500W - 600W';
        if (w < 800) return '650W - 750W';
        if (w < 1000) return '800W - 999W';
        return '1000W+';
    }

    // Se pide evidencia de las dos cosas en vez de dar por perifericos todo lo
    // que no diga "CONSOLE". Asi, si el proveedor trae algo que no es ninguna
    // de las dos, queda sin reclamar por el filtro en lugar de anunciarse como
    // periferico de consola.
    const TIPOS_DE_JUEGO = [
        [/\b(console|consola|playstation \d|xbox series|xbox one|nintendo switch)\b/i, 'Consolas'],
        [/\b(controle|control|joystick|gamepad|dualsense|dualshock|volante|simulador|shifter|cambio|painel de instrumentos|headset|estacao de carregamento|unidade de disco)\b/i, 'Periféricos']
    ];

    function getConsoleProductType(title) {
        for (const [patron, tipo] of TIPOS_DE_JUEGO) {
            if (patron.test(title)) return tipo;
        }
        return null;
    }

    function getStorageCapacity(title) {
        const match = title.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\b/i);
        if (!match) return null;
        let num = parseFloat(match[1]);
        let unit = match[2].toUpperCase();
        if (unit === 'TB') num = num * 1000;
        
        // Mismo problema que en las fuentes: los tramos dejaban huecos
        // (301-399, 601-799, 1201-1799, 2401-3499) y cada capacidad que caia
        // en uno se convertia en una opcion suelta del filtro. Ahora son
        // contiguos. Los pendrives y microSD chicos se agrupan en un tramo
        // propio en vez de aparecer como "16GB", "32GB" y "64GB" sueltos.
        if (num < 100) return 'Hasta 64GB';
        if (num < 400) return '120GB - 256GB';
        if (num < 800) return '480GB - 512GB';
        if (num < 1500) return '1TB';
        if (num < 3000) return '2TB';
        return '4TB+';
    }


    function setupAccordionListeners() {
        const headers = sidebarWidget.querySelectorAll('.filter-group-header');
        headers.forEach(h => {
            h.addEventListener('click', () => {
                h.classList.toggle('active');
                const content = h.nextElementSibling;
                content.classList.toggle('show');
            });
        });
    }

    function attachSidebarLinksListeners() {
        const sLinks = sidebarWidget.querySelectorAll('.sidebar-link');
        sLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                filterByCategory(link.getAttribute('data-category'));
            });
        });
    }

    function renderSidebarFilters(category) {
        if (!sidebarWidget) return;

        const catalogLayout = document.querySelector('.catalog-layout');
        const catalogSidebar = document.querySelector('.catalog-sidebar');

        if (category === 'all') {
            if (catalogSidebar) catalogSidebar.style.display = 'none';
            if (catalogLayout) catalogLayout.classList.add('no-sidebar');
            return;
        } else {
            if (catalogSidebar) catalogSidebar.style.display = 'flex';
            if (catalogLayout) catalogLayout.classList.remove('no-sidebar');
        }

        let html = `
            <div class="sidebar-filter-header">
                <button class="back-to-all-btn" id="back-to-all-btn">
                    <i class="las la-arrow-left"></i> Volver a Todo
                </button>
            </div>
            <div class="active-category-banner">
                <span class="active-cat-name">${NOMBRE_DE_CATEGORIA[category] || category}</span>
            </div>
        `;

        if (category === 'monitores') {
            let sizes = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'monitores') {
                    const size = getMonitorSize(p.title);
                    if (size) sizes[size] = (sizes[size] || 0) + 1;
                }
            });
            let sortedSizes = Object.keys(sizes).sort((a, b) => parseFloat(a) - parseFloat(b));

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Pulgadas</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${sortedSizes.map(size => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="monitorSizes" value="${size}" ${activeSubfilters.monitorSizes.includes(size) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${size}"</span>
                                        <span class="option-count">(${sizes[size]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (category === 'procesadores') {
            let brands = { 'AMD': 0, 'INTEL': 0 };
            PRODUCTS.forEach(p => {
                if (p.category === 'procesadores') {
                    const b = p.brand.toUpperCase();
                    if (brands[b] !== undefined) brands[b]++;
                }
            });

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Marca / Plataforma</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${['INTEL', 'AMD'].map(brand => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="procBrands" value="${brand}" ${activeSubfilters.procBrands.includes(brand) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${brand}</span>
                                        <span class="option-count">(${brands[brand]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (category === 'notebooks') {
            let gamerBrands = {};
            let officeBrands = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'notebooks') {
                    const type = getNotebookType(p.title);
                    const brand = p.brand;
                    if (type === 'Gamer') {
                        gamerBrands[brand] = (gamerBrands[brand] || 0) + 1;
                    } else {
                        officeBrands[brand] = (officeBrands[brand] || 0) + 1;
                    }
                }
            });

            let sortedGamerBrands = Object.keys(gamerBrands).sort();
            let sortedOfficeBrands = Object.keys(officeBrands).sort();

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Notebooks Gamer</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            <li>
                                <label class="filter-checkbox-label">
                                    <input type="checkbox" class="filter-checkbox" data-filter-type="notebookTypes" value="Gamer" ${activeSubfilters.notebookTypes.includes('Gamer') ? 'checked' : ''}>
                                    <span class="checkbox-custom"></span>
                                    <strong class="option-name">Ver todo Gamer</strong>
                                </label>
                            </li>
                            ${sortedGamerBrands.map(brand => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="notebookGamerBrands" value="${brand}" ${activeSubfilters.notebookGamerBrands && activeSubfilters.notebookGamerBrands.includes(brand) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${brand}</span>
                                        <span class="option-count">(${gamerBrands[brand]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
                
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Notebooks de Ofimática</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            <li>
                                <label class="filter-checkbox-label">
                                    <input type="checkbox" class="filter-checkbox" data-filter-type="notebookTypes" value="Ofimática" ${activeSubfilters.notebookTypes.includes('Ofimática') ? 'checked' : ''}>
                                    <span class="checkbox-custom"></span>
                                    <strong class="option-name">Ver todo Ofimática</strong>
                                </label>
                            </li>
                            ${sortedOfficeBrands.map(brand => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="notebookOfficeBrands" value="${brand}" ${activeSubfilters.notebookOfficeBrands && activeSubfilters.notebookOfficeBrands.includes(brand) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${brand}</span>
                                        <span class="option-count">(${officeBrands[brand]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (category === 'tarjetas-de-video') {
            // La lista de opciones sale de lo que hay en stock, no escrita a
            // mano: antes eran NVIDIA y AMD fijas y las placas Intel Arc no
            // tenian donde caer. Si manana entra otro chip, aparece solo.
            let chips = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'tarjetas-de-video') {
                    const chip = getGpuChip(p.title);
                    if (chip) chips[chip] = (chips[chip] || 0) + 1;
                }
            });
            const chipsPresentes = ['NVIDIA', 'AMD', 'INTEL']
                .filter((c) => chips[c])
                .concat(Object.keys(chips).filter((c) => !['NVIDIA', 'AMD', 'INTEL'].includes(c)).sort());

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Chipset (GPU)</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${chipsPresentes.map(chip => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="gpuBrands" value="${chip}" ${activeSubfilters.gpuBrands.includes(chip) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${chip}</span>
                                        <span class="option-count">(${chips[chip]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (category === 'placas-madre') {
            let platforms = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'placas-madre') {
                    const platform = getMbPlatform(p.title);
                    if (platform) platforms[platform] = (platforms[platform] || 0) + 1;
                }
            });
            const plataformasPresentes = ['INTEL', 'AMD'].filter((x) => platforms[x]);

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Plataforma</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${plataformasPresentes.map(platform => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="mbBrands" value="${platform}" ${activeSubfilters.mbBrands.includes(platform) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${platform}</span>
                                        <span class="option-count">(${platforms[platform]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
                } else if (category === 'televisores') {
            let sizes = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'televisores') {
                    const size = getTvSize(p.title);
                    if (size) sizes[size] = (sizes[size] || 0) + 1;
                }
            });
            let sortedSizes = Object.keys(sizes).sort((a,b) => parseInt(a) - parseInt(b));

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Tamaño (Pulgadas)</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${sortedSizes.map(size => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="tvSizes" value="${size}" ${activeSubfilters.tvSizes && activeSubfilters.tvSizes.includes(size) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <!-- getTvSize ya devuelve la comilla ('43"', '85"+'): agregar otra
                                             mostraba 43"" en el filtro. -->
                                        <span class="option-name">${size}</span>
                                        <span class="option-count">(${sizes[size]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (category === 'proyectores') {
            // Los tramos se muestran en orden de brillo, no por cantidad: la
            // lista se lee como una escala.
            let brillos = {};
            let resoluciones = {};
            PRODUCTS.forEach(p => {
                if (p.category !== 'proyectores') return;
                const b = getProjectorBrightness(p.title);
                if (b) brillos[b] = (brillos[b] || 0) + 1;
                const r = getProjectorResolution(p.title);
                if (r) resoluciones[r] = (resoluciones[r] || 0) + 1;
            });
            const ordenBrillo = TRAMOS_BRILLO.map(t => t.nombre).filter(n => brillos[n]);
            const ordenResolucion = ['4K', 'Full HD', 'WXGA', 'HD'].filter(r => resoluciones[r]);

            if (ordenBrillo.length) {
                html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Brillo</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${ordenBrillo.map(b => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="projectorBrightness" value="${b}" ${activeSubfilters.projectorBrightness.includes(b) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${b}</span>
                                        <span class="option-count">(${brillos[b]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
            }

            if (ordenResolucion.length) {
                html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Resolución</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${ordenResolucion.map(r => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="projectorResolutions" value="${r}" ${activeSubfilters.projectorResolutions.includes(r) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${r}</span>
                                        <span class="option-count">(${resoluciones[r]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
            }
        } else if (category === 'memorias-ram') {
            let types = {};
            let gens = {};
            let freqs = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'memorias-ram') {
                    const type = getRamType(p.title);
                    if (type) types[type] = (types[type] || 0) + 1;
                    
                    const gen = getRamGeneration(p.title);
                    if (gen) gens[gen] = (gens[gen] || 0) + 1;

                    const freq = getRamFrequency(p.title);
                    if (freq) freqs[freq] = (freqs[freq] || 0) + 1;
                }
            });
            let sortedTypes = Object.keys(types).sort();
            let sortedGens = Object.keys(gens).sort();
            let sortedFreqs = Object.keys(freqs).sort((a, b) => parseInt(a) - parseInt(b));

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Tipo de Equipo</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${sortedTypes.map(type => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="ramTypes" value="${type}" ${activeSubfilters.ramTypes && activeSubfilters.ramTypes.includes(type) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${type}</span>
                                        <span class="option-count">(${types[type]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>

                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Generación</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${sortedGens.map(gen => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="ramGenerations" value="${gen}" ${activeSubfilters.ramGenerations && activeSubfilters.ramGenerations.includes(gen) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${gen}</span>
                                        <span class="option-count">(${gens[gen]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
                
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Frecuencias</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${sortedFreqs.map(freq => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="ramFreqs" value="${freq}" ${activeSubfilters.ramFreqs.includes(freq) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${freq}</span>
                                        <span class="option-count">(${freqs[freq]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (category === 'fuentes-de-poder') {
            let watts = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'fuentes-de-poder') {
                    const watt = getPsuWattage(p.title);
                    if (watt) watts[watt] = (watts[watt] || 0) + 1;
                }
            });
            let sortedWatts = Object.keys(watts).sort((a, b) => parseInt(a) - parseInt(b));

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Potencia</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${sortedWatts.map(watt => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="psuWatts" value="${watt}" ${activeSubfilters.psuWatts.includes(watt) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${watt}</span>
                                        <span class="option-count">(${watts[watt]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (category === 'almacenamiento-ssd') {
            let capacities = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'almacenamiento-ssd') {
                    const cap = getStorageCapacity(p.title);
                    if (cap) capacities[cap] = (capacities[cap] || 0) + 1;
                }
            });
            // El orden sale de una lista explicita, no de leer un numero del
            // texto: `parseFloat('Hasta 64GB')` es NaN, y con NaN el sort deja
            // la opcion donde caiga (aparecia ultima, despues de 4TB+).
            const ORDEN_CAPACIDAD = ['Hasta 64GB', '120GB - 256GB', '480GB - 512GB', '1TB', '2TB', '4TB+'];
            let sortedCapacities = Object.keys(capacities)
                .sort((a, b) => ORDEN_CAPACIDAD.indexOf(a) - ORDEN_CAPACIDAD.indexOf(b));

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Capacidad</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${sortedCapacities.map(cap => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="storageSizes" value="${cap}" ${activeSubfilters.storageSizes && activeSubfilters.storageSizes.includes(cap) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${cap}</span>
                                        <span class="option-count">(${capacities[cap]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (category === 'consolas-y-videojuegos') {
            let types = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'consolas-y-videojuegos') {
                    const type = getConsoleProductType(p.title);
                    if (type) types[type] = (types[type] || 0) + 1;
                }
            });
            let sortedTypes = Object.keys(types).sort();

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Tipo de Producto</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${sortedTypes.map(type => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="consoleTypes" value="${type}" ${activeSubfilters.consoleTypes && activeSubfilters.consoleTypes.includes(type) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${type}</span>
                                        <span class="option-count">(${types[type]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else {
            let brands = {};
            PRODUCTS.forEach(p => {
                // GENERIC es la etiqueta interna de "marca no detectada". Como
                // opcion de filtro no le sirve a nadie: agrupa productos de
                // fabricantes distintos bajo un nombre que no existe.
                if (p.category === category && p.brand && p.brand !== 'GENERIC') {
                    brands[p.brand] = (brands[p.brand] || 0) + 1;
                }
            });
            let sortedBrands = Object.keys(brands).sort();

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Marcas</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${sortedBrands.map(brand => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="generalBrands" value="${brand}" ${activeSubfilters.generalBrands && activeSubfilters.generalBrands.includes(brand) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${brand}</span>
                                        <span class="option-count">(${brands[brand]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }

        sidebarWidget.innerHTML = html;

        setupAccordionListeners();

        const backBtn = document.getElementById('back-to-all-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                filterByCategory('all');
            });
        }

        const checkboxes = sidebarWidget.querySelectorAll('.filter-checkbox');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                // Clear active search bar text so leftover search query does not restrict sidebar selections
                if (searchInput) searchInput.value = '';
                searchQuery = '';

                const type = cb.getAttribute('data-filter-type');
                const val = cb.value;

                if (type === 'notebookGamerBrands') {
                    if (!activeSubfilters.notebookGamerBrands) activeSubfilters.notebookGamerBrands = [];
                    if (cb.checked) {
                        activeSubfilters.notebookGamerBrands.push(val);
                    } else {
                        activeSubfilters.notebookGamerBrands = activeSubfilters.notebookGamerBrands.filter(x => x !== val);
                    }
                } else if (type === 'notebookOfficeBrands') {
                    if (!activeSubfilters.notebookOfficeBrands) activeSubfilters.notebookOfficeBrands = [];
                    if (cb.checked) {
                        activeSubfilters.notebookOfficeBrands.push(val);
                    } else {
                        activeSubfilters.notebookOfficeBrands = activeSubfilters.notebookOfficeBrands.filter(x => x !== val);
                    }
                } else if (type === 'generalBrands') {
                    if (!activeSubfilters.generalBrands) activeSubfilters.generalBrands = [];
                    if (cb.checked) activeSubfilters.generalBrands.push(val);
                    else activeSubfilters.generalBrands = activeSubfilters.generalBrands.filter(x => x !== val);
                } else {
                    if (cb.checked) {
                        activeSubfilters[type].push(val);
                    } else {
                        activeSubfilters[type] = activeSubfilters[type].filter(x => x !== val);
                    }
                }

                if (type === 'notebookTypes' && val === 'Gamer' && !cb.checked) {
                    activeSubfilters.notebookGamerBrands = [];
                }
                if (type === 'notebookTypes' && val === 'Ofimática' && !cb.checked) {
                    activeSubfilters.notebookOfficeBrands = [];
                }

                currentPage = 1;
                renderProducts();
            });
        });
    }

    // ----------------------------------------------------------------------
    // FILTER AND SEARCH HANDLERS
    // ----------------------------------------------------------------------
    function filterByCategory(category) {
        currentCategory = category;
        currentPage = 1; // Reset to page 1

        // Clear active search bar text when switching categories
        if (searchInput) searchInput.value = '';
        searchQuery = '';

        resetSubfilters();
        renderSidebarFilters(category);

        // Sync active states on menus
        syncCategoryLinks(category);

        // Render catalog
        renderProducts();
    }


    function syncCategoryLinks(category) {
        // Desktop nav
        navLinks.forEach(link => {
            if (link.getAttribute('data-category') === category) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Sidebar widgets links
        sidebarLinks.forEach(link => {
            if (link.getAttribute('data-category') === category) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Mobile Nav links
        mobileNavLinks.forEach(link => {
            if (link.getAttribute('data-category') === category) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // Category click listeners
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            filterByCategory(link.getAttribute('data-category'));
        });
    });

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            filterByCategory(link.getAttribute('data-category'));
        });
    });

    mobileNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            filterByCategory(link.getAttribute('data-category'));
            closeMobileMenu();
        });
    });

    footerCatLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const catName = link.getAttribute('data-cat');
            filterByCategory(catName);
            scrollToCatalog();
        });
    });

    quickCatCards.forEach(card => {
        card.addEventListener('click', () => {
            const catName = card.getAttribute('data-cat');
            filterByCategory(catName);
            scrollToCatalog();
        });
    });

    // Search bar logic
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        currentPage = 1; // Reset to page 1
        if (searchQuery.trim().length > 0) {
            searchClearBtn.style.display = 'block';
            
            // If user searches, automatically reset category to "all" and clear sub-filters
            if (currentCategory !== 'all') {
                currentCategory = 'all';
                resetSubfilters();
                syncCategoryLinks('all');
                renderSidebarFilters('all');
            }
        } else {
            searchClearBtn.style.display = 'none';
        }
        renderProducts();
    });

    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        currentPage = 1; // Reset to page 1
        searchClearBtn.style.display = 'none';
        renderProducts();
    });

    resetSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        currentPage = 1; // Reset to page 1
        searchClearBtn.style.display = 'none';
        renderProducts();
    });

    // Sort order logic
    sortSelect.addEventListener('change', (e) => {
        sortOrder = e.target.value;
        currentPage = 1; // Reset to page 1
        renderProducts();
    });

    function scrollToCatalog() {
        const catalogEl = document.getElementById('catalog-section');
        if (catalogEl) {
            const headerHeight = document.querySelector('.header').offsetHeight || 80;
            const elementPosition = catalogEl.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 20;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
            });
        }
    }

    // ----------------------------------------------------------------------
    // MOBILE MENU SYSTEM
    // ----------------------------------------------------------------------
    if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', openMobileMenu);
    if (mobileNavClose) mobileNavClose.addEventListener('click', closeMobileMenu);
    if (mobileNavOverlay) mobileNavOverlay.addEventListener('click', closeMobileMenu);

    // ----------------------------------------------------------------------
    // FOCO EN DIALOGOS
    // ----------------------------------------------------------------------
    // Sin esto se puede tabular "por detras" de un dialogo abierto, y al
    // cerrarlo el foco vuelve al principio de la pagina en vez de al boton
    // que lo abrio. Para quien navega con teclado, eso hace el sitio
    // practicamente inusable.
    const SELECTOR_ENFOCABLE =
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

    let soltarFocoModal = null;
    let soltarFocoCarrito = null;
    let soltarFocoMenu = null;

    function atraparFoco(contenedor) {
        const previo = document.activeElement;
        const enfocables = () => [...contenedor.querySelectorAll(SELECTOR_ENFOCABLE)]
            .filter((el) => el.offsetParent !== null);

        const alTeclear = (e) => {
            if (e.key !== 'Tab') return;
            const lista = enfocables();
            if (lista.length === 0) return;
            const primero = lista[0];
            const ultimo = lista[lista.length - 1];
            if (e.shiftKey && document.activeElement === primero) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault();
                primero.focus();
            }
        };

        document.addEventListener('keydown', alTeclear);
        enfocables()[0]?.focus();

        return function soltarFoco() {
            document.removeEventListener('keydown', alTeclear);
            if (previo && document.contains(previo)) previo.focus();
        };
    }

    // Escape cierra el dialogo que este abierto.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (soltarFocoModal) closeProductModal();
        else if (soltarFocoCarrito) closeCartDrawer();
        else if (soltarFocoMenu) closeMobileMenu();
    });

    function openMobileMenu() {
        mobileNav.classList.add('active');
        mobileNavOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        soltarFocoMenu = atraparFoco(mobileNav);
    }

    function closeMobileMenu() {
        if (soltarFocoMenu) { soltarFocoMenu(); soltarFocoMenu = null; }
        mobileNav.classList.remove('active');
        mobileNavOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    // ----------------------------------------------------------------------
    // PRODUCT DETAILS MODAL SYSTEM
    // ----------------------------------------------------------------------
    function openProductModal(id) {
        const p = PRODUCTS.find(prod => prod.id === id);
        if (!p) return;

        // Filter out specs that are already present in the title
        const titleLower = p.title.toLowerCase();
        const filteredSpecs = (p.specs || []).filter(spec => !titleLower.includes(spec.toLowerCase().trim()));

        const isSobConsulta = p.sob_consulta;
        const waMsg = encodeURIComponent(`Hola, quisiera consultar sobre el producto: ${p.title}\nPrecio: ${isSobConsulta ? 'Bajo Consulta' : p.pyg_str}\nLink / Imagen: ${p.image}`);

        // La lista del proveedor trae referencia, titulo y precio: NO trae stock.
        // Que un producto figure en la lista significa que el proveedor lo cotiza
        // hoy, no que lo tenga fisicamente. Decia "Stock Disponible" con un tilde
        // verde en el 100% de los productos, y el 31/08 aparecio el primer caso
        // comprobado de un producto anunciado como disponible que el proveedor ya
        // no tenia. No prometemos lo que no sabemos.
        const stockBadgeHTML = isSobConsulta
            ? `<span class="modal-stock-badge" style="background: rgba(255, 146, 9, 0.15); color: #ff9209; border-color: rgba(255, 146, 9, 0.3);"><i class="las la-clock"></i> Bajo Consulta</span>`
            : `<span class="modal-stock-badge" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);"><i class="las la-box"></i> Bajo pedido</span>`;

        const priceBlockHTML = isSobConsulta
            ? `<span class="modal-price-label">Estado:</span><span class="modal-price-main" style="color: #ff9209;">Bajo Consulta</span>`
            : `<span class="modal-price-label">Precio en Gs.:</span><span class="modal-price-main">${p.pyg_str}</span>`;

        // Hay 95 productos (procesadores OEM, discos pull) cuyo propio titulo dice
        // SEM GARANTIA. Prometerles 3 meses al lado es una promesa que despues hay
        // que sostener: el cliente muestra la captura y la discusion esta perdida.
        // S/G y S/GARANTIA son la abreviatura del proveedor, igual que S/CX (sin
        // caja) y S/FAN (sin cooler). Sin la variante pegada se escapaban los
        // discos "PULL ... S/GARANTIA".
        const sinGarantia = /\b(?:sem|sin)\s+garantia\b|\bs\/\s*garantia\b|\bs\/g\b/i.test(p.title);
        const garantiaHTML = sinGarantia
            ? `<span class="bullet-item" style="color: #ff9209;"><i class="las la-exclamation-triangle"></i> Producto sin garantía</span>`
            : `<span class="bullet-item"><i class="las la-shield-alt"></i> Garantía de 3 meses en productos</span>`;

        const actionsRowHTML = isSobConsulta
            ? `<a href="https://wa.me/595976914662?text=${waMsg}" target="_blank" class="btn btn-sob-consulta" style="width: 100%; font-size: 1rem; padding: 12px 20px; text-decoration: none;">
                <i class="lab la-whatsapp"></i> Consultar disponibilidad por WhatsApp
               </a>`
            : `<button class="btn btn-primary btn-add-cart" id="modal-add-to-cart-btn">
                <i class="las la-cart-plus"></i> Agregar al Carrito
               </button>
               <a href="https://wa.me/595976914662?text=${waMsg}" target="_blank" class="btn btn-success btn-whatsapp-query">
                <i class="lab la-whatsapp"></i> Preguntar por WhatsApp
               </a>`;

        productModalBody.innerHTML = `
            <div class="modal-details-grid">
                <div class="modal-image-col">
                    <img src="${p.image}" alt="" width="400" height="400">
                </div>
                <div class="modal-info-col">
                    <span class="modal-brand">${p.brand && p.brand !== 'GENERIC' ? p.brand : ''}</span>
                    <h2 class="modal-title">${p.title}</h2>
                    <div class="modal-meta-row">
                        ${stockBadgeHTML}
                    </div>
                    
                    <div class="modal-price-block">
                        ${priceBlockHTML}
                        <div class="modal-info-bullets">
                            ${garantiaHTML}
                            <span class="bullet-item"><i class="las la-truck"></i> Envío con costo adicional</span>
                            <span class="bullet-item"><i class="las la-clock"></i> Stock sujeto a confirmación</span>
                        </div>
                    </div>

                    ${filteredSpecs.length > 0 ? `
                        <h4 class="modal-desc-title"><i class="las la-file-alt"></i> Especificaciones del Producto</h4>
                        <ul class="modal-specs-list">
                            ${filteredSpecs.map(spec => `
                                <li class="modal-spec-item">
                                    <i class="las la-check-circle"></i>
                                    <span>${spec}</span>
                                </li>
                            `).join('')}
                        </ul>
                    ` : `
                        <h4 class="modal-desc-title"><i class="las la-info-circle"></i> Información del Producto</h4>
                        <p class="modal-description">
                            Este producto original de la marca ${p.brand} cuenta con alta calidad y durabilidad. Es ideal para soluciones de computación avanzadas, garantizando una excelente relación costo/beneficio y el rendimiento óptimo que necesitas para tu setup tecnológico. Cuenta con garantía de 3 meses en todos los productos, gestionada directamente por AXTECH.
                        </p>
                    `}

                    <div class="modal-actions-row">
                        ${actionsRowHTML}
                    </div>
                </div>
            </div>
        `;

        // Event listener inside modal
        if (!isSobConsulta) {
            document.getElementById('modal-add-to-cart-btn').addEventListener('click', () => {
                addToCart(p.id);
                closeProductModal();
                openCartDrawer();
            });
        }

        // Display modal
        productModal.classList.add('active');
        productModalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        soltarFocoModal = atraparFoco(productModal);
    }

    function closeProductModal() {
        if (soltarFocoModal) { soltarFocoModal(); soltarFocoModal = null; }
        productModal.classList.remove('active');
        productModalOverlay.classList.remove('active');
        if (!cartDrawer.classList.contains('active')) {
            document.body.style.overflow = 'auto';
        }
    }

    if (productModalClose) productModalClose.addEventListener('click', closeProductModal);
    if (productModalOverlay) productModalOverlay.addEventListener('click', closeProductModal);

    // ----------------------------------------------------------------------
    // SHOPPING CART DRAWER SYSTEM
    // ----------------------------------------------------------------------
    /** Resuelve el producto de una linea del carrito contra el catalogo actual. */
    function productoDeItem(item) {
        return PRODUCTS.find(p => p.id === item.id);
    }

    function addToCart(id) {
        const p = PRODUCTS.find(prod => prod.id === id);
        if (!p) return;

        const cartItem = cart.find(item => item.id === id);
        if (cartItem) {
            cartItem.quantity++;
        } else {
            // Solo el id: el producto se resuelve al renderizar, asi el
            // carrito nunca muestra un precio desactualizado.
            cart.push({ id, quantity: 1 });
        }

        saveCartToStorage();
        updateCartUI();
        animateCartBadge();
        showToast(`${p.title} agregado al carrito`, 'success');
    }

    function removeFromCart(id) {
        cart = cart.filter(item => item.id !== id);
        saveCartToStorage();
        updateCartUI();
    }

    function adjustQuantity(id, change) {
        const cartItem = cart.find(item => item.id === id);
        if (!cartItem) return;

        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(id);
        } else {
            saveCartToStorage();
            updateCartUI();
        }
    }

    function saveCartToStorage() {
        localStorage.setItem('axtech_cart', JSON.stringify(cart));
    }

    function updateCartUI() {
        // Count total items
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCountBadge.textContent = totalItems;

        // Handle empty state vs items list
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '';
            cartEmptyState.style.display = 'flex';
            cartDrawerFooter.style.display = 'none';
        } else {
            cartEmptyState.style.display = 'none';
            cartDrawerFooter.style.display = 'block';

            // Los precios se leen del catalogo actual, no de lo guardado.
            const subtotal = cart.reduce((sum, item) => {
                const p = productoDeItem(item);
                return sum + (p ? p.pyg * item.quantity : 0);
            }, 0);

            const subtotalFormatted = `Gs. ${subtotal.toLocaleString('es-PY')}`.replace(/,/g, '.');
            cartSubtotalPrice.textContent = subtotalFormatted;
            cartTotalPrice.textContent = subtotalFormatted;

            // Render list items
            cartItemsContainer.innerHTML = '';
            cart.forEach(item => {
                const producto = productoDeItem(item);
                if (!producto) return;

                const itemEl = document.createElement('div');
                itemEl.className = 'cart-item';

                const itemTotalPyg = producto.pyg * item.quantity;
                const formattedItemPyg = `Gs. ${itemTotalPyg.toLocaleString('es-PY')}`.replace(/,/g, '.');

                // El titulo se inserta con textContent, no interpolado: viene
                // de raspar el HTML de un tercero.
                itemEl.innerHTML = `
                    <div class="cart-item-img">
                        <img src="${producto.image}" alt="" width="60" height="60">
                    </div>
                    <div class="cart-item-info">
                        <span class="cart-item-title"></span>
                        <span class="cart-item-price">${formattedItemPyg}</span>
                        <div class="cart-item-controls">
                            <div class="quantity-adjuster">
                                <button class="qty-btn btn-minus" data-id="${producto.id}"><i class="las la-minus"></i></button>
                                <span class="qty-val">${item.quantity}</span>
                                <button class="qty-btn btn-plus" data-id="${producto.id}"><i class="las la-plus"></i></button>
                            </div>
                            <button class="btn-remove-item" data-remove-id="${producto.id}" title="Quitar item"><i class="las la-trash"></i></button>
                        </div>
                    </div>
                `;
                const titulo = itemEl.querySelector('.cart-item-title');
                titulo.textContent = producto.title;
                titulo.title = producto.title;
                itemEl.querySelector('img').alt = producto.title;

                // Quantity change listeners
                itemEl.querySelector('.btn-minus').addEventListener('click', () => adjustQuantity(producto.id, -1));
                itemEl.querySelector('.btn-plus').addEventListener('click', () => adjustQuantity(producto.id, 1));
                itemEl.querySelector('.btn-remove-item').addEventListener('click', () => removeFromCart(producto.id));

                cartItemsContainer.appendChild(itemEl);
            });
        }
    }

    function animateCartBadge() {
        cartCountBadge.style.transform = 'scale(1.4)';
        setTimeout(() => {
            cartCountBadge.style.transform = 'scale(1)';
        }, 300);
    }

    // Toggle drawers
    function openCartDrawer() {
        cartDrawer.classList.add('active');
        cartDrawerOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        soltarFocoCarrito = atraparFoco(cartDrawer);
    }

    function closeCartDrawer() {
        if (soltarFocoCarrito) { soltarFocoCarrito(); soltarFocoCarrito = null; }
        cartDrawer.classList.remove('active');
        cartDrawerOverlay.classList.remove('active');
        if (!productModal.classList.contains('active')) {
            document.body.style.overflow = 'auto';
        }
    }

    if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCartDrawer);
    if (cartDrawerClose) cartDrawerClose.addEventListener('click', closeCartDrawer);
    if (cartDrawerOverlay) cartDrawerOverlay.addEventListener('click', closeCartDrawer);
    if (startShoppingBtn) startShoppingBtn.addEventListener('click', closeCartDrawer);

    // ----------------------------------------------------------------------
    // WHATSAPP CHECKOUT ORDER GENERATOR
    // ----------------------------------------------------------------------
    if (cartCheckoutBtn) {
        cartCheckoutBtn.addEventListener('click', () => {
            if (cart.length === 0) return;

            // El pedido se arma con los precios del catalogo actual, no con lo
            // que estaba guardado: nunca se le manda al cliente un precio viejo.
            const lineas = cart
                .map(item => ({ producto: productoDeItem(item), cantidad: item.quantity }))
                .filter(l => l.producto);
            if (lineas.length === 0) return;

            const subtotal = lineas.reduce((sum, l) => sum + (l.producto.pyg * l.cantidad), 0);
            const totalFormatted = `Gs. ${subtotal.toLocaleString('es-PY')}`.replace(/,/g, '.');

            const intro = lineas.length > 1 ? 'Estoy interesado en los siguientes productos:' : 'Estoy interesado en el siguiente producto:';
            let orderText = `Hola *AXTECH*!\n${intro}\n\n`;

            lineas.forEach((l, index) => {
                orderText += `*${index + 1}.* ${l.producto.title}\n`;
                orderText += `   _Cant:_ ${l.cantidad} x ${l.producto.pyg_str}\n\n`;
            });

            orderText += `*TOTAL ESTIMADO:* ${totalFormatted}`;

            // Open WhatsApp link
            const phoneNumber = '595976914662'; // Store WhatsApp number
            const encodedText = encodeURIComponent(orderText);
            const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodedText}`;

            window.open(whatsappURL, '_blank');
        });
    }

    // ----------------------------------------------------------------------
    // TOAST NOTIFICATIONS
    // ----------------------------------------------------------------------
    function showToast(message, type = 'success') {
        if (!notificationContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'la-check-circle';
        if (type === 'error') icon = 'la-exclamation-circle';
        if (type === 'info') icon = 'la-info-circle';
        
        toast.innerHTML = `
            <i class="las ${icon}"></i>
            <span>${message}</span>
        `;
        
        notificationContainer.appendChild(toast);
        
        // Remove toast after animation completes
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // ----------------------------------------------------------------------
    // SEARCH AUTOCOMPLETE SUGGESTION LOGIC
    // ----------------------------------------------------------------------
    function renderSearchSuggestions(val) {
        if (!searchSuggestions) return;
        const query = val.toLowerCase().trim();
        if (query.length < 2) {
            searchSuggestions.style.display = 'none';
            searchSuggestions.innerHTML = '';
            return;
        }

        const queryWords = query.split(/\s+/).filter(w => w.length > 0);
        const matches = PRODUCTS.filter(p => {
            const textToSearch = `${p.title} ${p.brand} ${p.category}`.toLowerCase();
            let isMatch = queryWords.every(word => textToSearch.includes(word));
            if (isMatch && p.category === 'notebooks') {
                const isPartQuery = queryWords.some(w => ['ssd', 'rtx', 'gtx', 'ram', 'intel', 'ryzen', 'ddr4', 'ddr5', '1tb', '512gb', 'm.2', 'monitor'].includes(w));
                const isNotebookQuery = queryWords.some(w => ['notebook', 'laptop', 'acer', 'asus', 'lenovo', 'hp', 'macbook'].includes(w));
                if (isPartQuery && !isNotebookQuery) {
                    isMatch = false;
                }
            }
            return isMatch;
        }).slice(0, 6); // Limit to top 6 results

        if (matches.length === 0) {
            searchSuggestions.innerHTML = '<div class="suggestion-no-results">No se encontraron productos</div>';
            searchSuggestions.style.display = 'block';
            return;
        }

        searchSuggestions.innerHTML = matches.map(p => `
            <div class="suggestion-item" data-suggestion-id="${p.id}">
                <img src="${p.image}" alt="" width="48" height="48" class="suggestion-img" loading="lazy">
                <div class="suggestion-info">
                    <span class="suggestion-brand">${p.brand && p.brand !== 'GENERIC' ? p.brand : ''}</span>
                    <span class="suggestion-title">${p.title}</span>
                    <span class="suggestion-price">${p.pyg_str}</span>
                </div>
            </div>
        `).join('');

        searchSuggestions.style.display = 'block';

        // Add click events to suggestions
        searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.getAttribute('data-suggestion-id'));
                const p = PRODUCTS.find(prod => prod.id === id);
                if (p) {
                    searchInput.value = p.title;
                    searchQuery = p.title;
                    searchSuggestions.style.display = 'none';
                    searchClearBtn.style.display = 'block';
                    currentPage = 1;
                    renderProducts();
                    openProductModal(id);
                }
            });
        });
    }

    // Autocomplete input listener
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderSearchSuggestions(e.target.value);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                searchSuggestions.style.display = 'none';
                searchInput.blur();
            }
        });
    }

    // Hide search suggestions on click outside
    document.addEventListener('click', (e) => {
        if (searchInput && searchSuggestions && !searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
            searchSuggestions.style.display = 'none';
        }
    });



});
