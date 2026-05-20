import { computed, ref, watch } from "vue";
import destinationConfig from "../data/destination.json";

const STORAGE_KEY = "coastal-companion-locale";

const messages = {
  fr: {
    today: "En ce moment",
    todayShort: "Auj.",
    motionBlocked: "Mouvement bloquÃ©",
    motionPromptTitle: "Activer le gyroscope ?",
    motionPromptBody: "Sur iPhone, l'animation de l'eau peut suivre les mouvements de l'appareil si vous autorisez le gyroscope.",
    motionPromptAllow: "Autoriser",
    motionPromptLater: "Plus tard",
    motionPromptLoading: "Demande en cours...",
    motionPromptDeniedTitle: "Gyroscope refusÃ©",
    motionPromptDeniedBody: "L'effet de mouvement reste dÃ©sactivÃ© tant que l'accÃ¨s au gyroscope n'est pas autorisÃ©.",
    close: "Fermer",
    displayedTide: "Hauteur de l'eau",
    visualScaleMetric: "Ã‰chelle visuelle sur 16 m",
    visualScaleImperial: "Ã‰chelle visuelle sur 52 ft",
    source: "Source",
    sourceApi: "Directe",
    sourceCache: "Cache",
    sourceNone: "Indispo",
    sourceExample: "Exemple",
    humidity: "HumiditÃ©",
    wind: "Vent",
    visibility: "VisibilitÃ©",
    dayWeather: "MÃ©tÃ©o du jour",
    temperatureRange: "Min / max",
    feelsLike: "Ressenti",
    cloudCover: "Nuages",
    rainChance: "Risque pluie",
    pressure: "Pression",
    rainfall: "Pluie",
    sunrise: "Lever",
    sunset: "Coucher",
    weatherTides: "MÃ©tÃ©o & marÃ©es",
    bayRhythm: "Le rythme de la baie",
    tideCurve: "Courbe du jour",
    tideClock: "Horloge de marÃ©e",
    tideLoading: "Chargement des hauteurs...",
    highlights: "Hautes et basses mers",
    highTideFull: "Pleine mer",
    lowTideFull: "Basse mer",
    highTideShort: "PM",
    lowTideShort: "BM",
    rising: "MarÃ©e montante",
    falling: "MarÃ©e descendante",
    nextTide: "Prochaine marÃ©e",
    currentHeight: "Hauteur actuelle",
    chartSelection: "Point sÃ©lectionnÃ©",
    chartNow: "Moment T",
    chooseDate: "Date",
    availableWindow: "Jours disponibles",
    previousMonth: "Mois prÃ©cÃ©dent",
    nextMonth: "Mois suivant",
    tapChart: "Touchez la courbe pour voir l'heure et la hauteur.",
    appVersionLabel: "Version",
    dataAttribution: "Source de donnÃ©es : api-maree.fr & open-meteo.com",
    madeBy: "RÃ©alisÃ© par thomaspelfrene.com",
    usefulInfo: "Infos utiles",
    freeParkingEyebrow: "Stationnement",
    freeParkingTitle: "Zones de stationnement gratuit",
    freeParkingBody: "Carte indicative des zones gratuites autour de l'appartement et du centre de Dinard.",
    freeParkingLegend: "Zone gratuite",
    freeParkingEmpty: "Aucune zone de stationnement gratuit n'est disponible pour le moment.",
    freeParkingLoadError: "Impossible de charger la carte du stationnement gratuit :",
    freeParkingRecenter: "Recentrer sur le nid",
    freeParkingDisclaimer:
      "Vérifiez quand même la signalisation sur place avant de vous garer : la ville peut modifier la gratuité de certaines rues. Merci de nous en informer.",
    openLink: "Ouvrir",
    usefulLinksEmptyTitle: "Aucun lien pour le moment",
    usefulLinksEmptyBody: "Ajoutez des entrÃ©es traduites dans src/data/useful-links.json pour afficher d'autres liens utiles.",
    cachedWeather: "Affichage de la derniÃ¨re mÃ©tÃ©o mÃ©morisÃ©e.",
    weatherFetchError: "Impossible de rÃ©cupÃ©rer la mÃ©tÃ©o :",
    tideApiKeyMissing: "Ajoutez une clÃ© api-maree.fr dans src/data/destination.json pour activer les marÃ©es rÃ©elles.",
    noTideData: "Aucune marÃ©e rÃ©elle disponible.",
    cachedTides: "Affichage des marÃ©es mÃ©morisÃ©es.",
    tideFetchError: "Impossible de rÃ©cupÃ©rer les marÃ©es :",
    cachedSeaTemperature: "Affichage de la derniÃ¨re tempÃ©rature de l'eau mÃ©morisÃ©e.",
    seaTemperatureError: "Impossible de rÃ©cupÃ©rer la tempÃ©rature de l'eau :",
    seaTemperature: "TempÃ©rature de l'eau",
    changingSky: "Ciel changeant",
    variable: "Variable",
    gentleBreeze: "Brise douce",
    weatherUnavailable: "MÃ©tÃ©o indisponible",
    hourlyDetails: "DÃ©tail de la journÃ©e",
    nowShort: "Maint.",
    languageUnit: "Lang.",
    temperatureUnit: "Temp.",
    distanceUnit: "Dist.",
    celsius: "C",
    fahrenheit: "F",
    metric: "m",
    imperial: "ft",
  },
  en: {
    today: "Right now",
    todayShort: "Today",
    motionBlocked: "Motion blocked",
    motionPromptTitle: "Enable gyroscope?",
    motionPromptBody: "On iPhone, the water animation can react to device movement if you allow gyroscope access.",
    motionPromptAllow: "Allow",
    motionPromptLater: "Later",
    motionPromptLoading: "Requesting access...",
    motionPromptDeniedTitle: "Gyroscope denied",
    motionPromptDeniedBody: "Motion effects stay disabled until gyroscope access is allowed.",
    close: "Close",
    displayedTide: "Water level",
    visualScaleMetric: "Visual scale over 16 m",
    visualScaleImperial: "Visual scale over 52 ft",
    source: "Source",
    sourceApi: "Live",
    sourceCache: "Cache",
    sourceNone: "Unavailable",
    sourceExample: "Example",
    humidity: "Humidity",
    wind: "Wind",
    visibility: "Visibility",
    dayWeather: "Day weather",
    temperatureRange: "Min / max",
    feelsLike: "Feels like",
    cloudCover: "Cloud cover",
    rainChance: "Rain chance",
    pressure: "Pressure",
    rainfall: "Rainfall",
    sunrise: "Sunrise",
    sunset: "Sunset",
    weatherTides: "Weather & tides",
    bayRhythm: "Rhythm of the bay",
    tideCurve: "Day curve",
    tideClock: "Tide clock",
    tideLoading: "Loading water levels...",
    highlights: "High and low tides",
    highTideFull: "High tide",
    lowTideFull: "Low tide",
    highTideShort: "HW",
    lowTideShort: "LW",
    rising: "Rising tide",
    falling: "Falling tide",
    nextTide: "Next tide",
    currentHeight: "Current height",
    chartSelection: "Selected point",
    chartNow: "Now",
    chooseDate: "Date",
    availableWindow: "Available days",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    tapChart: "Tap the curve to view time and height.",
    appVersionLabel: "Version",
    dataAttribution: "Data source: api-maree.fr & open-meteo.com",
    madeBy: "Made by thomaspelfrene.com",
    usefulInfo: "Useful info",
    freeParkingEyebrow: "Parking",
    freeParkingTitle: "Free parking zones",
    freeParkingBody: "Indicative map of free parking areas around the apartment and central Dinard.",
    freeParkingLegend: "Free area",
    freeParkingEmpty: "No free parking area is available at the moment.",
    freeParkingLoadError: "Unable to load the free parking map:",
    freeParkingRecenter: "Center on the nest",
    freeParkingDisclaimer:
      "Please still check on-site signage before parking, as the city may change which streets are free to park on. Please let us know if that happens.",
    openLink: "Open",
    usefulLinksEmptyTitle: "No links yet",
    usefulLinksEmptyBody: "Add translated entries in src/data/useful-links.json to display more useful links.",
    cachedWeather: "Showing the last cached weather snapshot.",
    weatherFetchError: "Unable to fetch weather:",
    tideApiKeyMissing: "Add an api-maree.fr key in src/data/destination.json to enable live tides.",
    noTideData: "No live tide data available.",
    cachedTides: "Showing cached tide data.",
    tideFetchError: "Unable to fetch tides:",
    cachedSeaTemperature: "Showing the last cached sea temperature snapshot.",
    seaTemperatureError: "Unable to fetch sea temperature:",
    seaTemperature: "Sea temperature",
    changingSky: "Changing sky",
    variable: "Variable",
    gentleBreeze: "Gentle breeze",
    weatherUnavailable: "Weather unavailable",
    hourlyDetails: "Day detail",
    nowShort: "Now",
    languageUnit: "Lang.",
    temperatureUnit: "Temp.",
    distanceUnit: "Dist.",
    celsius: "C",
    fahrenheit: "F",
    metric: "m",
    imperial: "ft",
  },
};

function localize(value, localeCode) {
  if (typeof value === "string") {
    return value;
  }

  return value?.[localeCode] ?? value?.fr ?? "";
}

function getDynamicMessages(localeCode) {
  return {
    appName: localize(destinationConfig.app.name, localeCode),
    cityName: localize(destinationConfig.destination.city, localeCode),
    region: localize(destinationConfig.destination.region, localeCode),
    storyEyebrow: localize(destinationConfig.app.storyEyebrow, localeCode),
    storyTitle: localize(destinationConfig.app.storyTitle, localeCode),
    storyBody: localize(destinationConfig.app.storyBody, localeCode),
    desktopOnlyTitle: localize(destinationConfig.app.desktopOnlyTitle, localeCode),
    desktopOnlyBody: localize(destinationConfig.app.desktopOnlyBody, localeCode),
    metaDescription: localize(destinationConfig.app.metaDescription, localeCode),
  };
}

function applyDocumentMetadata(localeCode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = localeCode;
  document.title = localize(destinationConfig.app.name, localeCode);

  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute("content", localize(destinationConfig.app.metaDescription, localeCode));
  }

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", destinationConfig.app.themeColor);
  }
}

const initialLocale = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "fr";
const locale = ref(initialLocale);

watch(
  locale,
  (value) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value);
    }

    applyDocumentMetadata(value);
  },
  { immediate: true },
);

export function useLocale() {
  const t = (key) => {
    const localeMessages = messages[locale.value] ?? messages.fr;
    const dynamicMessages = getDynamicMessages(locale.value);

    return localeMessages[key] ?? dynamicMessages[key] ?? messages.fr[key] ?? getDynamicMessages("fr")[key] ?? key;
  };

  return {
    locale,
    t,
    localeOptions: computed(() => [
      { value: "fr", label: "FR" },
      { value: "en", label: "ENG" },
    ]),
  };
}

