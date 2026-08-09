#!/usr/bin/env node
'use strict';

/**
 * Scans products/<category>/<subcategory>/info.json + images/, cross-links
 * each product to its image by matching filename (without extension) to the
 * product slug, and writes the result to catalog.json at the repo root.
 *
 * Run: node scripts/build-catalog.js  (or `npm run build`)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_DIR = path.join(ROOT, 'products');
const SITE_CONFIG_PATH = path.join(ROOT, 'site.config.json');
const OUTPUT_PATH = path.join(ROOT, 'catalog.json');
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg', '.gif'];

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(slug) {
  return String(slug)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function readJSON(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${path.relative(ROOT, filePath)}: ${err.message}`);
  }
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

function findProductImage(imagesDir, slug) {
  if (!fs.existsSync(imagesDir)) return null;
  const files = fs.readdirSync(imagesDir);
  const match = files.find((file) => {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(ext)) return false;
    return slugify(path.basename(file, ext)) === slug;
  });
  return match || null;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function buildCatalog() {
  const site = readJSON(SITE_CONFIG_PATH, {});
  const warnings = [];
  const categories = [];
  const flatProducts = [];

  for (const categorySlugRaw of listDirs(PRODUCTS_DIR)) {
    const categoryDir = path.join(PRODUCTS_DIR, categorySlugRaw);
    const categorySlug = slugify(categorySlugRaw);
    const categoryMeta = readJSON(path.join(categoryDir, 'category.json'), {});

    const subcategories = [];

    for (const subSlugRaw of listDirs(categoryDir)) {
      const subDir = path.join(categoryDir, subSlugRaw);
      const infoPath = path.join(subDir, 'info.json');
      if (!fs.existsSync(infoPath)) continue; // not a product subcategory folder

      const info = readJSON(infoPath, { products: [] });
      const subSlug = slugify(subSlugRaw);
      const imagesDir = path.join(subDir, 'images');
      const products = [];

      for (const raw of info.products || []) {
        if (!raw.name) {
          warnings.push(`Skipped a product with no "name" in ${path.relative(ROOT, infoPath)}`);
          continue;
        }
        const slug = slugify(raw.slug || raw.name);
        const imageFile = findProductImage(imagesDir, slug);
        if (!imageFile) {
          warnings.push(
            `No image found for "${raw.name}" (expected a file named "${slug}.*") in ${path.relative(ROOT, imagesDir)}`
          );
        }
        const price = Number(raw.price) || 0;
        const discount = Number(raw.discount) || 0;
        const finalPrice = discount > 0 ? round2(price * (1 - discount / 100)) : price;

        products.push({
          slug,
          name: raw.name,
          description: raw.description || '',
          price: round2(price),
          discount,
          finalPrice,
          currency: raw.currency || site.currency || 'USD',
          specs: raw.specs || {},
          tags: raw.tags || [],
          inStock: raw.inStock !== false,
          featured: !!raw.featured,
          image: imageFile
            ? `products/${categorySlugRaw}/${subSlugRaw}/images/${imageFile}`
            : 'assets/img/placeholder.svg',
          categorySlug,
          categoryName: categoryMeta.displayName || titleCase(categorySlugRaw),
          subcategorySlug: subSlug,
          subcategoryName: info.displayName || titleCase(subSlugRaw),
        });
      }

      subcategories.push({
        slug: subSlug,
        displayName: info.displayName || titleCase(subSlugRaw),
        description: info.description || '',
        products,
      });

      flatProducts.push(...products);
    }

    if (subcategories.length === 0) continue;

    categories.push({
      slug: categorySlug,
      displayName: categoryMeta.displayName || titleCase(categorySlugRaw),
      description: categoryMeta.description || '',
      subcategories,
    });
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    site,
    categories,
    products: flatProducts,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2) + '\n');

  console.log(
    `Catalog built: ${flatProducts.length} product(s) across ${categories.length} categor${
      categories.length === 1 ? 'y' : 'ies'
    }.`
  );
  if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach((w) => console.log(`  - ${w}`));
  }
}

buildCatalog();
