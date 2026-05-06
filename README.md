# The Seagulls Nest

Small Vue + Vite mobile-first app for coastal stays: weather, tides, sea temperature and useful local links.

## Environment

Copy the example file before running the app:

```bash
cp .env.example .env
```

Required variable:

- `VITE_API_MAREE_KEY`: api-maree.fr key used for live tides

## Stack

- Vue 3
- Vite
- Tailwind CSS 4
- Vite PWA plugin
- Open-Meteo
- api-maree.fr

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## What to change for another destination

### 1. Main destination config

Edit [`src/data/destination.json`](src/data/destination.json).

This file contains:

- app name
- app description
- city and region labels
- latitude / longitude for Open-Meteo
- timezone
- fallback tide site
- tide visual max height
- Vite dev server host / port / HTTPS
- PWA metadata

Typical fields:

```json
{
  "destination": {
    "city": { "fr": "Dinard", "en": "Dinard" },
    "region": { "fr": "Côte d'Émeraude", "en": "Emerald Coast" },
    "timezone": "Europe/Paris",
    "coordinates": {
      "lat": 48.6329,
      "lon": -2.0625
    },
    "tide": {
      "fallbackSite": {
        "site_id": "saint-malo",
        "name": "Saint-Malo"
      }
    }
  },
  "development": {
    "port": 5173
  }
}
```

### 2. Useful links

Edit [`src/data/useful-links.json`](src/data/useful-links.json).

Each entry supports translation:

```json
{
  "id": "city-site",
  "title": {
    "fr": "Site de la ville",
    "en": "City website"
  },
  "description": {
    "fr": "Informations pratiques",
    "en": "Practical information"
  },
  "url": "https://example.com/"
}
```

## Project structure

```text
src/
  components/
    WaterScene.vue
  composables/
    useDestinationData.js
    useLocale.js
    useMotionGlass.js
  data/
    destination.json
    useful-links.json
  App.vue
  main.js
  style.css
```

## APIs

- Weather forecast: [Open-Meteo docs](https://open-meteo.com/en/docs)
- Marine / sea temperature: [Open-Meteo marine docs](https://open-meteo.com/en/docs/marine-weather-api)
- Tides: [api-maree.fr documentation](https://api-maree.fr/documentation)

## License

Add the license that matches how you want to publish the project.
