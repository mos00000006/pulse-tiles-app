export const DECOR_GROUPS = [
  ['decor-tiles', 'Décor Tiles'], ['uv-sheets', 'UV Sheets'],
  ['wall-panels', 'Wall Panels'], ['blinds', 'Blinds'],
  ['natural-stone-cladding', 'Natural Stone Cladding'],
  ['cladding-look-tiles', 'Cladding Look Tiles'],
  ['glass-mosaics', 'Glass Mosaics'], ['rustic-mosaics', 'Rustic Mosaics'],
  ['mosaic-fix', 'Mosaic Fix Adhesives'],
  ['silicones-flex-adhesives', 'Silicones & Flex Adhesives'],
  ['tile-edges-trims', 'Edging & Skirting']
];
const groupIds = new Set(DECOR_GROUPS.map(([id]) => id));
const groupsOf = p => [...new Set((p.decor_groups || []).filter(id => groupIds.has(id)))];
const skuOf = p => String(p._code || p.code || '').trim().toLowerCase();
const validSku = sku => sku && !['—', '-', 'n/a', 'none', 'tba'].includes(sku);

function canonicalUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return (url.origin + url.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch { return ''; }
}

export function decorFilterMatch(product, filter = 'decor') {
  const groups = groupsOf(product);
  return filter === 'decor' ? groups.length > 0
    : filter.startsWith('decor-') && groups.includes(filter.slice(6));
}

// Keep existing product and cart identities when an item belongs to both ranges.
export function mergeDecorCatalogue(existingProducts, decorRows, normalise) {
  const products = [...existingProducts];
  const urls = new Map(), ids = new Map(), skus = new Map(), variations = new Map();
  function index(product, position) {
    if (product.id && !ids.has(String(product.id))) ids.set(String(product.id), position);
    if (product.variation_id) variations.set(String(product.variation_id), position);
    else {
      const url = canonicalUrl(product.source_url);
      if (url && !urls.has(url)) urls.set(url, position);
    }
    const sku = skuOf(product);
    if (validSku(sku)) {
      if (!skus.has(sku)) skus.set(sku, position);
      else if (skus.get(sku) !== position) skus.set(sku, null);
    }
  }
  products.forEach(index);
  for (const row of decorRows) {
    const groups = groupsOf(row);
    if (!groups.length) continue;
    let position;
    if (row.variation_id) position = variations.get(String(row.variation_id)) ?? ids.get(String(row.id));
    else {
      position = urls.get(canonicalUrl(row.source_url)) ?? ids.get(String(row.id));
      if (position == null && validSku(skuOf(row))) position = skus.get(skuOf(row));
    }
    const existing = position == null ? null : products[position];
    const code = existing && validSku(skuOf(existing)) ? (existing._code || existing.code) : row.code;
    const combined = {
      ...existing, ...row, id: existing?.id || row.id, code,
      categories: [...new Set([...(existing?.categories || []), ...(row.categories || [])])],
      decor_groups: [...new Set([...groupsOf(existing || {}), ...groups])]
    };
    const product = normalise(combined, existing?._type || row.catalogue_type || 'decor');
    if (existing) products[position] = product;
    else { position = products.length; products.push(product); }
    index(product, position);
  }
  return products;
}
