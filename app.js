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
        consoleTypes: []
    };

    const SEARCH_STOP_WORDS = new Set([
        'de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
        'y', 'e', 'o', 'u', 'con', 'sin', 'para', 'por', 'en', 'a', 'com',
        'sem', 'em', 'da', 'do', 'dos', 'das'
    ]);

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
    }

    // Load cart from localStorage if exists
    if (localStorage.getItem('axtech_cart')) {
        try {
            cart = JSON.parse(localStorage.getItem('axtech_cart'));
        } catch (e) {
            cart = [];
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
    // INITIALIZATION & SETUP
    // ----------------------------------------------------------------------
    initSlider();
    updateCategoryBadges();
    renderSidebarFilters('all');
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
    function updateCategoryBadges() {
        const counts = {
            'all': PRODUCTS.filter(p => p.category !== 'Televisores').length,
            'Notebooks': 0,
            'Consolas y Videojuegos': 0,
            'Tarjetas de Video': 0,
            'Almacenamiento (SSD)': 0,
            'Memorias RAM': 0,
            'Fuentes de Poder': 0,
            'Procesadores': 0,
            'Placas Madre': 0,
            'Monitores': 0,
            'Periféricos': 0,
            'Relojes Mi Band': 0,
            'Smart Home / Domótica': 0,
            'Televisores': 0,
            'Gabinetes': 0
        };

        PRODUCTS.forEach(p => {
            if (counts[p.category] !== undefined) {
                counts[p.category]++;
            }
        });

        // Update DOM elements with count badges
        const badges = document.querySelectorAll('[data-count-cat]');
        badges.forEach(b => {
            const cat = b.getAttribute('data-count-cat');
            if (counts[cat] !== undefined) {
                b.textContent = counts[cat];
            }
        });
    }

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
            const isTvExplicitQuery = rawQuery && ['tv', 'televisor', 'televisores', 'smart'].some(w => rawQuery.includes(w));

            // Category match
            const categoryMatch = currentCategory === 'all' 
                ? (p.category !== 'Televisores' || isTvExplicitQuery) 
                : p.category === currentCategory;
            
            // Search match (intelligent multi-word search, matching all words in any order, ignoring stop words)
            let searchMatch = true;
            if (rawQuery) {
                const isRefSearch = /^\d{5,6}$/.test(rawQuery);

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
                const isMonitorQuery = p.category === 'Monitores' || queryWords.includes('monitor') || queryWords.includes('monitores');
                const sizeNumberWord = queryWords.find(w => /^\d{2}$/.test(w) && ['24', '27', '32', '20', '22', '34'].includes(w));

                if (isMonitorQuery && sizeNumberWord) {
                    if (!isMonitorTitleSizeMatch(p.title, sizeNumberWord)) {
                        return false;
                    }
                }

                const titleLower = p.title.toLowerCase();
                const titleOrigLower = (p.title_orig || '').toLowerCase();
                const brandLower = p.brand.toLowerCase();
                const categoryLower = p.category.toLowerCase();
                const specsLower = (p.specs || []).join(' ').toLowerCase();

                const textToSearch = isRefSearch
                    ? `${titleLower} ${titleOrigLower} ${brandLower} ${p.ref} ${categoryLower} ${specsLower}`
                    : `${titleLower} ${titleOrigLower} ${brandLower} ${categoryLower} ${specsLower}`;

                searchMatch = queryWords.every(word => {
                    if (word === sizeNumberWord && isMonitorQuery) {
                        return true; // Already strictly validated by isMonitorTitleSizeMatch
                    }
                    if (textToSearch.includes(word)) {
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
                if (searchMatch && p.category === 'Notebooks') {
                    const isPartQuery = queryWords.some(w => ['ssd', 'rtx', 'gtx', 'ram', 'intel', 'ryzen', 'ddr4', 'ddr5', '1tb', '512gb', 'm.2', 'monitor'].includes(w));
                    const isNotebookQuery = queryWords.some(w => ['notebook', 'laptop', 'acer', 'asus', 'lenovo', 'hp', 'macbook'].includes(w));
                    if (isPartQuery && !isNotebookQuery) {
                        searchMatch = false;
                    }
                }
            }
            
            if (!categoryMatch || !searchMatch) return false;

            // Sub-filters
            if (currentCategory === 'Monitores') {
                if (activeSubfilters.monitorSizes.length > 0) {
                    const size = getMonitorSize(p.title);
                    if (!size || !activeSubfilters.monitorSizes.includes(size)) return false;
                }
            } else if (currentCategory === 'Procesadores') {
                if (activeSubfilters.procBrands.length > 0) {
                    const brand = p.brand.toUpperCase();
                    if (!activeSubfilters.procBrands.includes(brand)) return false;
                }
            } else if (currentCategory === 'Notebooks') {
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
            } else if (currentCategory === 'Tarjetas de Video') {
                if (activeSubfilters.gpuBrands.length > 0) {
                    const chip = getGpuChip(p.title);
                    if (!chip || !activeSubfilters.gpuBrands.includes(chip)) return false;
                }
            } else if (currentCategory === 'Placas Madre') {
                if (activeSubfilters.mbBrands.length > 0) {
                    const platform = getMbPlatform(p.title);
                    if (!platform || !activeSubfilters.mbBrands.includes(platform)) return false;
                }
            } else if (currentCategory === 'Memorias RAM') {
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
            } else if (currentCategory === 'Televisores') {
                if (activeSubfilters.tvSizes && activeSubfilters.tvSizes.length > 0) {
                    const size = getTvSize(p.title);
                    if (!size || !activeSubfilters.tvSizes.includes(size)) return false;
                }
            } else if (currentCategory === 'Fuentes de Poder') {
                if (activeSubfilters.psuBrands.length > 0) {
                    if (!activeSubfilters.psuBrands.includes(p.brand)) return false;
                }
                if (activeSubfilters.psuWatts.length > 0) {
                    const watts = getPsuWattage(p.title);
                    if (!watts || !activeSubfilters.psuWatts.includes(watts)) return false;
                }
            } else if (currentCategory === 'Almacenamiento (SSD)') {
                if (activeSubfilters.storageSizes && activeSubfilters.storageSizes.length > 0) {
                    const capacity = getStorageCapacity(p.title);
                    if (!capacity || !activeSubfilters.storageSizes.includes(capacity)) return false;
                }
            } else if (currentCategory === 'Consolas y Videojuegos') {
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
                    if (a.category === 'Monitores') scoreA += 50;
                    if (b.category === 'Monitores') scoreB += 50;
                    if (titleA.includes('soporte') || titleA.includes('brazo')) scoreA -= 40;
                    if (titleB.includes('soporte') || titleB.includes('brazo')) scoreB -= 40;
                }

                return scoreB - scoreA;
            });
        } else if (currentCategory === 'all' && sortOrder === 'default' && searchQuery === '') {
            // Group filtered products by category
            const monitors = filtered.filter(p => p.category === 'Monitores');
            const mibands = filtered.filter(p => p.category === 'Relojes Mi Band');
            const processors = filtered.filter(p => p.category === 'Procesadores');
            const notebooks = filtered.filter(p => p.category === 'Notebooks');
            const others = filtered.filter(p => 
                p.category !== 'Monitores' && 
                p.category !== 'Relojes Mi Band' && 
                p.category !== 'Procesadores' && 
                p.category !== 'Notebooks'
            );

            // Mix them round-robin
            const mixed = [];
            const maxLength = Math.max(monitors.length, mibands.length, processors.length, notebooks.length, others.length);
            
            for (let i = 0; i < maxLength; i++) {
                if (i < monitors.length) mixed.push(monitors[i]);
                if (i < mibands.length) mixed.push(mibands[i]);
                if (i < processors.length) mixed.push(processors[i]);
                if (i < notebooks.length) mixed.push(notebooks[i]);
                if (i < others.length) mixed.push(others[i]);
            }
            
            filtered = mixed;
        } else if (currentCategory === 'Consolas y Videojuegos' && sortOrder === 'default') {
            filtered.sort((a, b) => {
                const typeA = getConsoleProductType(a.title);
                const typeB = getConsoleProductType(b.title);
                if (typeA === 'Consolas' && typeB !== 'Consolas') return -1;
                if (typeA !== 'Consolas' && typeB === 'Consolas') return 1;
                return 0;
            });
        } else if (sortOrder === 'price-asc') {
            filtered.sort((a, b) => a.pyg - b.pyg);
        } else if (sortOrder === 'price-desc') {
            filtered.sort((a, b) => b.pyg - a.pyg);
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

        // Simulate rendering delay for a premium transition feel
        setTimeout(() => {
            loader.style.display = 'none';
            
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
                const isNew = (p.id <= 3 || p.id === 25 || p.id === 37 || p.id === 49) && !p.sob_consulta;
                let badgeHTML = '';
                if (p.sob_consulta) {
                    badgeHTML = `<span class="product-badge badge-sob-consulta">Bajo Consulta</span>`;
                } else if (isNew) {
                    badgeHTML = `<span class="product-badge badge-new">Destacado</span>`;
                }

                const priceHTML = p.sob_consulta
                    ? `<span class="price-sob-consulta">Bajo Consulta</span>`
                    : `<span class="price-main">${p.pyg_str}</span>`;

                const waMsg = encodeURIComponent(`Hola AXTECH, quisiera consultar disponibilidad del producto: ${p.title}`);
                const buttonHTML = p.sob_consulta
                    ? `<a href="https://wa.me/595976914662?text=${waMsg}" target="_blank" class="btn btn-sob-consulta btn-consult" style="flex: 1; text-decoration: none;" onclick="event.stopPropagation();">
                        <i class="lab la-whatsapp"></i> Consultar
                       </a>`
                    : `<button class="btn btn-primary btn-add-cart" data-add-id="${p.id}">
                        <i class="las la-cart-plus"></i> Agregar
                       </button>`;

                card.innerHTML = `
                    ${badgeHTML}
                    <div class="product-image-container">
                        <img src="${p.image}" alt="${p.title}" loading="lazy">
                    </div>
                    <div class="product-brand">${p.brand}</div>
                    <h4 class="product-name">${p.title}</h4>
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

                // Add Event Listeners to actions in this card
                if (!p.sob_consulta) {
                    card.querySelector('.btn-add-cart').addEventListener('click', (e) => {
                        e.stopPropagation();
                        addToCart(p.id);
                    });
                }
                
                card.querySelector('.btn-view').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openProductModal(p.id);
                });
                
                card.querySelector('.product-image-container').addEventListener('click', () => {
                    openProductModal(p.id);
                });

                const cardImg = card.querySelector('img');
                if (cardImg) {
                    cardImg.addEventListener('error', () => {
                        card.style.display = 'none';
                    });
                }

                card.querySelector('.product-name').addEventListener('click', () => {
                    openProductModal(p.id);
                });

                productsGrid.appendChild(card);
            });

            // Render Pagination Controls
            renderPaginationControls(totalPages);

            // Update title and results count
            const categoryNames = {
                'all': 'Todos los Productos',
                'Notebooks': 'Notebooks y Portátiles',
                'Consolas y Videojuegos': 'Consolas',
                'Televisores': 'Televisores y Smart TVs',
                'Tarjetas de Video': 'Tarjetas de Video y GPU',
                'Almacenamiento (SSD)': 'Discos M.2 y Almacenamiento SSD',
                'Memorias RAM': 'Memorias RAM para PC y Notebook',
                'Fuentes de Poder': 'Fuentes de Poder',
                'Procesadores': 'Procesadores Intel y AMD Ryzen',
                'Placas Madre': 'Placas Madre Intel y AMD',
                'Monitores': 'Monitores Gamer y de Oficina',
                'Periféricos': 'Teclados, Mouses y Auriculares',
                'Relojes Mi Band': 'Relojes Inteligentes Xiaomi',
                'Smart Home / Domótica': 'Domótica y Dispositivos Smart',
                'Gabinetes': 'Gabinetes y Chasis para PC'
            };
            catalogTitle.textContent = categoryNames[currentCategory] || 'Catálogo';
            resultsCount.textContent = `Mostrando ${startIndex + 1} - ${Math.min(endIndex, totalFilteredProducts)} de ${totalFilteredProducts} productos`;

        }, 300);
    }

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
    function getTvSize(title) {
        let match = title.match(/(\d{2,3})\s*(?:"|polegadas|inch|'|Pulgadas)/i);
        if (!match) match = title.match(/TV\s+(\d{2,3})/i);
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

    function getMonitorSize(title) {
        let match = title.match(/(\d{2}(?:\.\d+)?)\s*(?:"|pulgadas|polegadas|inch|inches|'|\b)/i);
        if (!match) match = title.match(/monitor\s+(\d{2}(?:\.\d+)?)/i);
        if (match) {
            let val = parseFloat(match[1]);
            if (val >= 23.0 && val <= 24.9) return "24";
            if (val >= 26.0 && val <= 27.9) return "27";
            if (val >= 31.0 && val <= 32.9) return "32";
            if (val >= 21.0 && val <= 22.9) return "22";
            if (val >= 19.0 && val <= 20.9) return "20";
            if (val >= 33.0 && val <= 35.0) return "34";
            if (val >= 17.0 && val <= 18.9) return "17-18";
            if (val >= 15.0 && val <= 16.9) return "15-16";
            return Math.round(val).toString();
        }
        return null;
    }

    function getGpuChip(title) {
        const t = title.toLowerCase();
        if (t.includes('radeon') || t.includes('amd') || t.includes('xfx') || t.includes('sapphire') || t.includes('powercolor') || t.includes('power color') || t.includes('hellhound') || t.includes('asrock') || t.includes('rx ') || t.includes('challenger') || t.includes('steel legend') || t.includes('pulse')) {
            return 'AMD';
        }
        return 'NVIDIA';
    }

    function getMbPlatform(title) {
        const t = title.toLowerCase();
        if (t.includes('am4') || t.includes('am5') || t.includes('a320') || t.includes('a520') || t.includes('b350') || t.includes('b450') || t.includes('b550') || t.includes('b650') || t.includes('x370') || t.includes('x470') || t.includes('x570') || t.includes('x670') || t.includes('a620') || t.includes('x870') || t.includes('b850')) {
            return 'AMD';
        }
        if (t.includes('h110') || t.includes('h310') || t.includes('h410') || t.includes('h510') || t.includes('h610') || t.includes('h81') || t.includes('b250') || t.includes('b360') || t.includes('b365') || t.includes('b460') || t.includes('b560') || t.includes('b660') || t.includes('b760') || t.includes('z170') || t.includes('z270') || t.includes('z370') || t.includes('z390') || t.includes('z490') || t.includes('z590') || t.includes('z690') || t.includes('z790') || t.includes('lga1151') || t.includes('lga1200') || t.includes('lga1700') || t.includes('lga 1700') || t.includes('lga 1200') || t.includes('lga 1151') || t.includes('lga1851') || t.includes('h470') || t.includes('b760m') || t.includes('h610m') || t.includes('h510m') || t.includes('1700') || t.includes('1155') || t.includes('1150') || t.includes('2011') || t.includes('x99') || t.includes('1151')) {
            return 'INTEL';
        }
        if (t.includes('intel')) return 'INTEL';
        if (t.includes('amd')) return 'AMD';
        return 'INTEL';
    }

    function getNotebookType(title) {
        const titleLower = title.toLowerCase();
        const gamerTerms = ['rtx', 'gtx', 'gaming', 'gamer', 'nitro', 'predator', 'victus', 'loq', 'tuf'];
        for (let term of gamerTerms) {
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

    function getRamType(title) {
        const t = title.toLowerCase();
        if (t.includes('sodimm') || t.includes('notebook') || t.includes('laptop') || t.includes('macbook') || /\bmac\b/i.test(t) || t.includes('so-dimm')) {
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

    function getPsuWattage(title) {
        const match = title.match(/(\d+)\s*W\b/i);
        if (!match) return null;
        let w = parseInt(match[1], 10);
        if (w >= 200 && w <= 450) return "200W - 450W";
        if (w >= 500 && w <= 600) return "500W - 600W";
        if (w >= 650 && w <= 750) return "650W - 750W";
        if (w >= 800 && w <= 850) return "800W - 850W";
        if (w >= 1000) return "1000W+";
        return w + 'W';
    }

    function getConsoleProductType(title) {
        const t = title.toUpperCase();
        if (t.includes('CONSOLE') || t.includes('CONSOLA')) {
            return 'Consolas';
        }
        return 'Periféricos';
    }

    function getStorageCapacity(title) {
        const match = title.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\b/i);
        if (!match) return null;
        let num = parseFloat(match[1]);
        let unit = match[2].toUpperCase();
        if (unit === 'TB') num = num * 1000;
        
        if (num >= 100 && num <= 300) return "120GB - 256GB";
        if (num >= 400 && num <= 600) return "480GB - 512GB";
        if (num >= 800 && num <= 1200) return "1TB";
        if (num >= 1800 && num <= 2400) return "2TB";
        if (num >= 3500) return "4TB+";
        return num + 'GB';
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
                <span class="active-cat-name">${category}</span>
            </div>
        `;

        if (category === 'Monitores') {
            let sizes = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'Monitores') {
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
        } else if (category === 'Procesadores') {
            let brands = { 'AMD': 0, 'INTEL': 0 };
            PRODUCTS.forEach(p => {
                if (p.category === 'Procesadores') {
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
        } else if (category === 'Notebooks') {
            let gamerBrands = {};
            let officeBrands = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'Notebooks') {
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
        } else if (category === 'Tarjetas de Video') {
            let chips = { 'NVIDIA': 0, 'AMD': 0 };
            PRODUCTS.forEach(p => {
                if (p.category === 'Tarjetas de Video') {
                    const chip = getGpuChip(p.title);
                    if (chip) chips[chip] = (chips[chip] || 0) + 1;
                }
            });

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Chipset (GPU)</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${['NVIDIA', 'AMD'].map(chip => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="gpuBrands" value="${chip}" ${activeSubfilters.gpuBrands.includes(chip) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${chip}</span>
                                        <span class="option-count">(${chips[chip] || 0})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (category === 'Placas Madre') {
            let platforms = { 'INTEL': 0, 'AMD': 0 };
            PRODUCTS.forEach(p => {
                if (p.category === 'Placas Madre') {
                    const platform = getMbPlatform(p.title);
                    if (platform) platforms[platform] = (platforms[platform] || 0) + 1;
                }
            });

            html += `
                <div class="filter-group">
                    <button class="filter-group-header active">
                        <span>Plataforma</span>
                        <i class="las la-angle-down"></i>
                    </button>
                    <div class="filter-group-content show">
                        <ul class="filter-options">
                            ${['INTEL', 'AMD'].map(platform => `
                                <li>
                                    <label class="filter-checkbox-label">
                                        <input type="checkbox" class="filter-checkbox" data-filter-type="mbBrands" value="${platform}" ${activeSubfilters.mbBrands.includes(platform) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="option-name">${platform}</span>
                                        <span class="option-count">(${platforms[platform] || 0})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
                } else if (category === 'Televisores') {
            let sizes = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'Televisores') {
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
                                        <span class="option-name">${size}"</span>
                                        <span class="option-count">(${sizes[size]})</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (category === 'Memorias RAM') {
            let types = {};
            let gens = {};
            let freqs = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'Memorias RAM') {
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
        } else if (category === 'Fuentes de Poder') {
            let watts = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'Fuentes de Poder') {
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
        } else if (category === 'Almacenamiento (SSD)') {
            let capacities = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'Almacenamiento (SSD)') {
                    const cap = getStorageCapacity(p.title);
                    if (cap) capacities[cap] = (capacities[cap] || 0) + 1;
                }
            });
            let sortedCapacities = Object.keys(capacities).sort((a, b) => {
                const getVal = str => {
                    let num = parseFloat(str);
                    if (str.includes('TB')) return num * 1024;
                    return num;
                };
                return getVal(a) - getVal(b);
            });

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
        } else if (category === 'Consolas y Videojuegos') {
            let types = {};
            PRODUCTS.forEach(p => {
                if (p.category === 'Consolas y Videojuegos') {
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
                if (p.category === category) {
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

    function openMobileMenu() {
        mobileNav.classList.add('active');
        mobileNavOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
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
        const waMsg = encodeURIComponent('Hola AXTECH, quisiera consultar disponibilidad del producto: ' + p.title);
        
        const stockBadgeHTML = isSobConsulta
            ? `<span class="modal-stock-badge" style="background: rgba(255, 146, 9, 0.15); color: #ff9209; border-color: rgba(255, 146, 9, 0.3);"><i class="las la-clock"></i> Bajo Consulta</span>`
            : `<span class="modal-stock-badge"><i class="las la-check"></i> Stock Disponible</span>`;

        const priceBlockHTML = isSobConsulta
            ? `<span class="modal-price-label">Estado:</span><span class="modal-price-main" style="color: #ff9209;">Bajo Consulta</span>`
            : `<span class="modal-price-label">Precio en Gs.:</span><span class="modal-price-main">${p.pyg_str}</span>`;

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
                    <img src="${p.image}" alt="${p.title}">
                </div>
                <div class="modal-info-col">
                    <span class="modal-brand">${p.brand}</span>
                    <h2 class="modal-title">${p.title}</h2>
                    <div class="modal-meta-row">
                        ${stockBadgeHTML}
                    </div>
                    
                    <div class="modal-price-block">
                        ${priceBlockHTML}
                        <div class="modal-info-bullets">
                            <span class="bullet-item"><i class="las la-shield-alt"></i> Garantía de 3 meses en productos</span>
                            <span class="bullet-item"><i class="las la-truck"></i> Envío con costo adicional</span>
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
    }

    function closeProductModal() {
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
    function addToCart(id) {
        const p = PRODUCTS.find(prod => prod.id === id);
        if (!p) return;

        // Check if item already in cart
        const cartItem = cart.find(item => item.product.id === id);
        if (cartItem) {
            cartItem.quantity++;
        } else {
            cart.push({
                product: p,
                quantity: 1
            });
        }

        // Save to localStorage & update
        saveCartToStorage();
        updateCartUI();
        animateCartBadge();
        showToast(`${p.title} agregado al carrito`, 'success');
    }

    function removeFromCart(id) {
        cart = cart.filter(item => item.product.id !== id);
        saveCartToStorage();
        updateCartUI();
    }

    function adjustQuantity(id, change) {
        const cartItem = cart.find(item => item.product.id === id);
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

            // Calculate Subtotal in pyg (Guaranies)
            const subtotal = cart.reduce((sum, item) => sum + (item.product.pyg * item.quantity), 0);
            
            // Format Guaraní Price
            const subtotalFormatted = `Gs. ${subtotal.toLocaleString('es-PY')}`.replace(/,/g, '.');
            cartSubtotalPrice.textContent = subtotalFormatted;
            cartTotalPrice.textContent = subtotalFormatted;

            // Render list items
            cartItemsContainer.innerHTML = '';
            cart.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'cart-item';
                
                const itemTotalPyg = item.product.pyg * item.quantity;
                const formattedItemPyg = `Gs. ${itemTotalPyg.toLocaleString('es-PY')}`.replace(/,/g, '.');

                itemEl.innerHTML = `
                    <div class="cart-item-img">
                        <img src="${item.product.image}" alt="${item.product.title}">
                    </div>
                    <div class="cart-item-info">
                        <span class="cart-item-title" title="${item.product.title}">${item.product.title}</span>
                        <span class="cart-item-price">${formattedItemPyg}</span>
                        <div class="cart-item-controls">
                            <div class="quantity-adjuster">
                                <button class="qty-btn btn-minus" data-id="${item.product.id}"><i class="las la-minus"></i></button>
                                <span class="qty-val">${item.quantity}</span>
                                <button class="qty-btn btn-plus" data-id="${item.product.id}"><i class="las la-plus"></i></button>
                            </div>
                            <button class="btn-remove-item" data-remove-id="${item.product.id}" title="Quitar item"><i class="las la-trash"></i></button>
                        </div>
                    </div>
                `;

                // Quantity change listeners
                itemEl.querySelector('.btn-minus').addEventListener('click', () => adjustQuantity(item.product.id, -1));
                itemEl.querySelector('.btn-plus').addEventListener('click', () => adjustQuantity(item.product.id, 1));
                itemEl.querySelector('.btn-remove-item').addEventListener('click', () => removeFromCart(item.product.id));

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
    }

    function closeCartDrawer() {
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

            const subtotal = cart.reduce((sum, item) => sum + (item.product.pyg * item.quantity), 0);
            const totalFormatted = `Gs. ${subtotal.toLocaleString('es-PY')}`.replace(/,/g, '.');

            const intro = cart.length > 1 ? 'Estoy interesado en los siguientes productos:' : 'Estoy interesado en el siguiente producto:';
            let orderText = `Hola *AXTECH*!\n${intro}\n\n`;
            
            cart.forEach((item, index) => {
                orderText += `*${index + 1}.* ${item.product.title}\n`;
                orderText += `   _Cant:_ ${item.quantity} x ${item.product.pyg_str}\n\n`;
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
            const textToSearch = `${p.title} ${p.brand} ${p.ref} ${p.category}`.toLowerCase();
            let isMatch = queryWords.every(word => textToSearch.includes(word));
            if (isMatch && p.category === 'Notebooks') {
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
                <img src="${p.image}" alt="${p.title}" class="suggestion-img">
                <div class="suggestion-info">
                    <span class="suggestion-brand">${p.brand}</span>
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
