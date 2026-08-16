import { computed, ref, watch } from "vue";
import destinationConfig from "../data/destination.json";

const STORAGE_KEY = "coastal-companion-locale";

const messages = {
  fr: {
    today: "En ce moment",
    inTheAir: "Dans l’air",
    inTheWater: "Dans l’eau",
    todayShort: "Auj.",
    motionBlocked: "Mouvement bloqué",
    motionPromptTitle: "Activer le gyroscope ?",
    motionPromptBody: "Sur iPhone, l'animation de l'eau peut suivre les mouvements de l'appareil si vous autorisez le gyroscope.",
    motionPromptAllow: "Autoriser",
    motionPromptLater: "Plus tard",
    motionPromptLoading: "Demande en cours...",
    motionPromptDeniedTitle: "Gyroscope refusé",
    motionPromptDeniedBody: "L'effet de mouvement reste désactivé tant que l'accÃ¨s au gyroscope n'est pas autorisé.",
    close: "Fermer",
    displayedTide: "Hauteur de l'eau",
    visualScaleMetric: "Ã‰chelle visuelle sur 16 m",
    visualScaleImperial: "Ã‰chelle visuelle sur 52 ft",
    source: "Source",
    sourceApi: "Directe",
    sourceCache: "Cache",
    sourceNone: "Indispo",
    sourceExample: "Exemple",
    humidity: "Humidité",
    wind: "Vent",
    visibility: "Visibilité",
    dayWeather: "Météo du jour",
    temperatureRange: "Min / max",
    feelsLike: "Ressenti",
    cloudCover: "Nuages",
    rainChance: "Risque pluie",
    pressure: "Pression",
    coefficientShort: "Coef.",
    weatherTab: "Météo",
    tidesTab: "Marées",
    infoTab: "Infos",
    contentTabs: "Sections d’information",
    previousDay: "Jour précédent",
    nextDay: "Jour suivant",
    loadingPreviousTides: "Chargement des jours précédents…",
    loadingNextTides: "Chargement des jours suivants…",
    backToToday: "Revenir à aujourd’hui",
    noMorePastTides: "Aucune donnée plus ancienne n’est disponible.",
    noMoreFutureTides: "Aucune donnée plus lointaine n’est disponible.",
    rainfall: "Pluie",
    sunrise: "Lever",
    sunset: "Coucher",
    weatherTides: "Météo & marées",
    bayRhythm: "Le rythme de la baie",
    tideCurve: "Courbe de la marée",
    tideClock: "Horloge de marée",
    tideLoading: "Chargement des hauteurs...",
    highlights: "Hautes et basses mers",
    highTideFull: "Pleine mer",
    lowTideFull: "Basse mer",
    highTideShort: "PM",
    lowTideShort: "BM",
    rising: "Marée montante",
    falling: "Marée descendante",
    nextTide: "Prochaine marée",
    currentHeight: "Hauteur actuelle",
    currentTide: "Marée actuelle",
    nextTide: "Marée suivante",
    chartSelection: "Point sélectionné",
    chartNow: "Moment T",
    chooseDate: "Date",
    availableWindow: "Jours disponibles",
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    tapChart: "Touchez la courbe pour voir l'heure et la hauteur.",
    appVersionLabel: "Version",
    dataAttribution: "Source de données : api-maree.fr & open-meteo.com",
    madeBy: "Réalisé par thomaspelfrene.com",
    usefulInfo: "Infos utiles",
    freeParkingEyebrow: "Zones de stationnement gratuit",
    freeParkingTitle: "Zones de stationnement gratuit",
    freeParkingBody: "Carte indicative des zones gratuites autour de l'appartement et du centre de Dinard.",
    freeParkingLegend: "Zone gratuite",
    freeParkingEmpty: "Aucune zone de stationnement gratuit n'est disponible pour le moment.",
    freeParkingLoadError: "Impossible de charger la carte du stationnement gratuit :",
    freeParkingRecenter: "Recentrer",
    freeParkingDisclaimer:
      "Vérifiez quand même la signalisation sur place avant de vous garer : la ville peut modifier la gratuité de certaines rues. Merci de nous en informer.",
    openLink: "Ouvrir",
    usefulLinksEmptyTitle: "Aucun lien pour le moment",
    usefulLinksEmptyBody: "Ajoutez des entrées traduites dans src/data/useful-links.json pour afficher d'autres liens utiles.",
    weatherFetchError: "Impossible de récupérer la météo :",
    tideApiKeyMissing: "Ajoutez une clé api-maree.fr dans src/data/destination.json pour activer les marées réelles.",
    noTideData: "Aucune marée réelle disponible.",
    cachedTides: "Affichage des marées mémorisées.",
    tideFetchError: "Impossible de récupérer les marées :",
    cachedSeaTemperature: "Affichage de la derniÃ¨re température de l'eau mémorisée.",
    seaTemperatureError: "Impossible de récupérer la température de l'eau :",
    seaTemperature: "Température de l'eau",
    changingSky: "Ciel changeant",
    variable: "Variable",
    gentleBreeze: "Brise douce",
    weatherUnavailable: "Météo indisponible",
    hourlyDetails: "Détail de la journée",
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
    inTheAir: "In the air",
    inTheWater: "In the water",
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
    coefficientShort: "Coeff.",
    weatherTab: "Weather",
    tidesTab: "Tides",
    infoTab: "Info",
    contentTabs: "Information sections",
    previousDay: "Previous day",
    nextDay: "Next day",
    loadingPreviousTides: "Loading previous days…",
    loadingNextTides: "Loading next days…",
    backToToday: "Back to today",
    noMorePastTides: "No earlier tide data is available.",
    noMoreFutureTides: "No later tide data is available.",
    rainfall: "Rainfall",
    sunrise: "Sunrise",
    sunset: "Sunset",
    weatherTides: "Weather & tides",
    bayRhythm: "Rhythm of the bay",
    tideCurve: "Tide curve",
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
    currentTide: "Current tide",
    nextTide: "Next tide",
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
    freeParkingEyebrow: "Free parking zones",
    freeParkingTitle: "Free parking zones",
    freeParkingBody: "Indicative map of free parking areas around the apartment and central Dinard.",
    freeParkingLegend: "Free area",
    freeParkingEmpty: "No free parking area is available at the moment.",
    freeParkingLoadError: "Unable to load the free parking map:",
    freeParkingRecenter: "Recenter",
    freeParkingDisclaimer:
      "Please still check on-site signage before parking, as the city may change which streets are free to park on. Please let us know if that happens.",
    openLink: "Open",
    usefulLinksEmptyTitle: "No links yet",
    usefulLinksEmptyBody: "Add translated entries in src/data/useful-links.json to display more useful links.",
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
