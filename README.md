# Atef Tech Gadgets — Catalog Site

A static product catalog (keyboards, mice, and whatever you add next) built to run for free on **GitHub Pages**. There is no database and no backend — the entire catalog is generated from plain folders, images, and JSON files in this repo.

## How it works

```
products/
  keyboards/                     <- category
    category.json                <- (optional) display name/description for the category
    mechanical/                  <- subcategory
      info.json                  <- product data for everything in this subcategory
      images/
        aurora-tkl.jpg           <- filename (without extension) must match the product's slug/name
        titan-full-size.jpg
    membrane/
      info.json
      images/
        breeze-office.jpg
  mice/
    category.json
    wireless/
      info.json
      images/
        nova-wireless.jpg
```

A build script (`scripts/build-catalog.js`) walks this folder structure, matches each product to its image by filename, computes discounted prices, and writes a single `catalog.json` at the repo root. The website (`index.html` + `assets/js/app.js`) fetches `catalog.json` and renders everything dynamically: category/subcategory navigation, search, sorting, discount badges, and a product detail popup.

**You never touch HTML/CSS/JS to add a product.** You only add folders, images, and JSON.

## Adding a new product to an existing subcategory

1. Drop the image into `products/<category>/<subcategory>/images/`. Name the file exactly like the product, e.g. `Wireless Comfort Mouse.jpg` → the build script will slugify it, so `wireless-comfort-mouse.jpg` also works.
2. Add an entry to that subcategory's `info.json`:

   ```json
   {
     "slug": "wireless-comfort-mouse",
     "name": "Wireless Comfort Mouse",
     "price": 45.0,
     "discount": 10,
     "description": "One-line pitch shown on the card and in search.",
     "specs": {
       "Connectivity": "Bluetooth 5.0",
       "Battery Life": "6 months"
     },
     "tags": ["wireless", "ergonomic"],
     "inStock": true,
     "featured": false
   }
   ```

   Only `name` and `price` are required — everything else has a sensible default. `slug` can be omitted; it will be generated from `name`, but setting it explicitly guarantees a stable match to your image filename.
3. Commit and push. GitHub Actions rebuilds `catalog.json` and redeploys automatically (see below). Locally, run `npm run build` if you want to preview first.

## Adding a brand-new category or subcategory

Just create the folder. Example — adding a "Headsets" category with an "Wireless" subcategory:

```
products/headsets/category.json
products/headsets/wireless/info.json
products/headsets/wireless/images/...
```

`category.json` is optional:
```json
{ "displayName": "Headsets", "description": "Audio gear for calls, music and gaming." }
```

If you skip `category.json` or `displayName` in `info.json`, the folder name is used (e.g. `wireless` → "Wireless").

## Discounts & pricing

- `price` is the regular price.
- `discount` is a percentage (0–100). The site shows the discounted price plus a strikethrough original price and a "-X%" badge automatically. Omit or set to `0` for no discount.

## Editing site branding / contact info

Edit `site.config.json` at the repo root:

```json
{
  "businessName": "Atef Tech Gadgets",
  "tagline": "Your one-line pitch.",
  "currency": "USD",
  "currencySymbol": "$",
  "contact": {
    "email": "you@yourbusiness.com",
    "whatsapp": "41791234567",
    "instagram": "yourhandle",
    "telegram": "yourhandle"
  }
}
```

These values flow straight into the header, footer, and the "Enquire about this item" button in the product popup — no code changes needed.

## Local preview

```bash
npm run build   # regenerates catalog.json from products/
npm run dev     # rebuilds and serves the site at http://localhost:3000
```

(`npm run dev` uses `npx serve` — a plain `open index.html` won't work because the browser needs to `fetch()` catalog.json over HTTP.)

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The included workflow (`.github/workflows/deploy.yml`) will:
   - run `node scripts/build-catalog.js` to regenerate `catalog.json` from whatever is in `products/`,
   - publish the site to GitHub Pages.
4. Your site will be live at `https://<username>.github.io/<repo-name>/`.

From then on, adding a product is: **add image + edit JSON + `git push`.** The site updates itself within a minute or two.

## Project structure

```
index.html                  Page shell
assets/css/style.css        All styling (light/dark theme, responsive grid)
assets/js/app.js            Fetches catalog.json, renders UI, search/sort/filter, modal
assets/img/placeholder.svg  Fallback image for products missing a photo
scripts/build-catalog.js    Scans products/ and generates catalog.json
site.config.json            Business name, tagline, currency, contact links
products/                   Your categories, subcategories, images and info.json files
catalog.json                Generated output — do not edit by hand
.github/workflows/deploy.yml GitHub Action: build + deploy on every push to main
```
