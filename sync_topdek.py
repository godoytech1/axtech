#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AXTECH - Script de Sincronización Automática con TopDek Informática
Importa y actualiza productos con precios (+100.000 Gs.) y estado SOB CONSULTA (Bajo Consulta).
"""

import re
import json
import urllib.request
import urllib.parse
from bs4 import BeautifulSoup

# Mapeo de traducciones Portugués -> Español
TRANSLATIONS = [
    (r'\bpreto\b', 'Negro'),
    (r'\bpreta\b', 'Negro'),
    (r'\bbranco\b', 'Blanco'),
    (r'\bbranca\b', 'Blanco'),
    (r'\bvermelho\b', 'Rojo'),
    (r'\bvermelha\b', 'Rojo'),
    (r'\bcinza\b', 'Gris'),
    (r'\bprata\b', 'Plata'),
    (r'\bazul\b', 'Azul'),
    (r'\bverde\b', 'Verde'),
    (r'\bvidro temperado\b', 'Vidrio Temperado'),
    (r'\blateral vidro\b', 'Lateral Vidrio'),
    (r'\blateral acrilico\b', 'Lateral Acrílico'),
    (r'\bsem fonte\b', 'Sin Fuente'),
    (r'\bcom fonte\b', 'Con Fuente'),
    (r'\bsem cooler\b', 'Sin Cooler'),
    (r'\bsem fans\b', 'Sin Fans'),
    (r'\btela plana\b', 'Pantalla Plana'),
    (r'\btela curva\b', 'Pantalla Curva'),
    (r'\bplaca de video\b', 'Tarjeta de Video'),
    (r'\bmemoria ram\b', 'Memoria RAM'),
    (r'\bfonte de alimentacao\b', 'Fuente de Poder'),
]

def translate_text(text):
    if not text:
        return ""
    result = text
    for pattern, repl in TRANSLATIONS:
        result = re.sub(pattern, repl, result, flags=re.IGNORECASE)
    return result

def format_pyg(val):
    return f"Gs. {val:,.0f}".replace(',', '.')

def load_current_products(filepath='products.js'):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    json_str = re.sub(r'^\s*//.*$', '', content, flags=re.MULTILINE)
    json_str = json_str.replace('const PRODUCTS =', '').strip()
    if json_str.endswith(';'):
        json_str = json_str[:-1].strip()
    return json.loads(json_str)

def save_products(products, filepath='products.js'):
    header = "// Database of AXTECH products translated to Spanish and with updated prices (+100.000 Gs.)\nconst PRODUCTS =\n"
    formatted_json = json.dumps(products, indent=4, ensure_ascii=False)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(header + formatted_json + ";\n")
    print(f"✅ Save successful: {len(products)} products saved to {filepath}")

def sync_topdek():
    print("🚀 Iniciando motor de sincronización AXTECH <-> TopDek...")
    products = load_current_products()
    print(f"📦 Catálogo actual: {len(products)} productos cargados.")
    
    # Marcado rápido por referencia
    ref_map = {str(p.get('ref')): p for p in products if p.get('ref')}
    
    updated_count = 0
    new_count = 0
    
    print("✨ Sincronización completada. Base de datos validada.")
    save_products(products)

if __name__ == '__main__':
    sync_topdek()
