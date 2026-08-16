<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import WaterScene from "./components/WaterScene.vue";
import WeatherTab from "./components/WeatherTab.vue";
import TidesTab from "./components/TidesTab.vue";
import InfoTab from "./components/InfoTab.vue";
import DataDisclaimer from "./components/DataDisclaimer.vue";
import { useStay } from "./composables/useStay";
import { useDestinationData } from "./composables/useDestinationData";
import { useLocale } from "./composables/useLocale";
import { useMotionGlass } from "./composables/useMotionGlass";

const { locale, localeOptions, t } = useLocale();
const APP_VERSION = __APP_VERSION__;
const AdminLogin = defineAsyncComponent(() => import("./components/AdminLogin.vue"));
const AdminToolbar = defineAsyncComponent(() => import("./components/AdminToolbar.vue"));
const AdminSettings = defineAsyncComponent(() => import("./components/AdminSettings.vue"));
const ParkingEditor = defineAsyncComponent(() => import("./components/ParkingEditor.vue"));
const { stay, isAdminRoute, isDisclaimerRoute, isAuthenticated } = useStay();
const showAdminSettings = ref(false);
const showParkingEditor = ref(false);
const adminNotice = ref("");
function finishSettings(slug) {
  adminNotice.value = "Paramètres enregistrés.";
  if (slug !== staySlugFromPath()) window.location.assign(`/${slug}/admin`);
  else window.location.reload();
}
function staySlugFromPath() {
  return window.location.pathname.split("/").filter(Boolean).at(-2);
}

const TEMPERATURE_UNIT_KEY = "coastal-companion-temperature-unit";
const DISTANCE_UNIT_KEY = "coastal-companion-distance-unit";
const ACTIVE_TAB_KEY = "coastal-companion-active-tab";

const temperatureUnit = ref(typeof window !== "undefined" && window.localStorage.getItem(TEMPERATURE_UNIT_KEY) === "f" ? "f" : "c");
const distanceUnit = ref(typeof window !== "undefined" && window.localStorage.getItem(DISTANCE_UNIT_KEY) === "imperial" ? "imperial" : "metric");
const storedTab = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_TAB_KEY) : null;
const activeTab = ref(["weather", "tides", "info"].includes(storedTab) ? storedTab : "weather");
const lowerTabs = computed(() => [
  { key: "weather", label: t("weatherTab") },
  { key: "tides", label: t("tidesTab") },
  { key: "info", label: t("infoTab") },
]);

const {
  currentSeaTemperature,
  currentTideClock,
  currentTideCoefficient,
  currentTideCurrent,
  currentWaterRatio,
  currentWeather,
  selectedDateInput,
  selectedDateOptions,
  selectedLabel,
  selectedWeather,
  selectedWeatherTimeline,
  seaTemperatureError,
  tideDayGroups,
  tideListLoadingPast,
  tideListLoadingFuture,
  canLoadPastTideDays,
  canLoadFutureTideDays,
  loadMoreTideDays,
  tideError,
  tideGraph,
  tideLoading,
  tideNowMarker,
  tideSeries,
  usefulLinks,
  weatherError,
  weatherLoading,
  helpers,
} = useDestinationData(locale, t);

const { tiltX, tiltY, energy, permissionState, requestMotionAccess } = useMotionGlass();

const tideChartRef = ref(null);
const hourlyScrollRef = ref(null);
const tideListRef = ref(null);
const tideListCentered = ref(false);
const tideListPrepending = ref(false);
const tideListAppending = ref(false);
const selectedTideIndex = ref(null);
const isDraggingTideChart = ref(false);
const showMotionPrompt = ref(false);
const motionPromptDismissed = ref(false);
const motionPromptPending = ref(false);
const freeParkingGeoJson = ref(null);
const freeParkingError = ref("");
const freeParkingMapRef = ref(null);
const freeParkingMapInstance = ref(null);
const freeParkingBaseLayer = ref(null);
const freeParkingZonesLayer = ref(null);
const freeParkingDestinationLayer = ref(null);
const freeParkingRenderer = L.svg({ padding: 0.5 });
const showMotionButton = computed(() => permissionState.value === "prompt" && motionPromptDismissed.value);
const localeActiveIndex = computed(() =>
  Math.max(
    0,
    localeOptions.value.findIndex((option) => option.value === locale.value),
  ),
);
const temperatureUnitActiveIndex = computed(() => (temperatureUnit.value === "f" ? 1 : 0));
const distanceUnitActiveIndex = computed(() => (distanceUnit.value === "imperial" ? 1 : 0));
const freeParkingFocusCoordinates = { lat: stay.latitude, lon: stay.longitude };
const freeParkingFocusZoom = 17;
const freeParkingMarkerIcon = L.icon({
  iconUrl: stay.floating_image_url,
  iconSize: [58, 42],
  iconAnchor: [29, 34],
  tooltipAnchor: [0, -23],
});

watch(
  permissionState,
  (value) => {
    if (value === "prompt" && !motionPromptDismissed.value) {
      showMotionPrompt.value = true;
      return;
    }

    if (value === "denied") {
      showMotionPrompt.value = true;
      return;
    }

    if (value === "granted" || value === "unsupported") {
      showMotionPrompt.value = false;
    }
  },
  { immediate: true },
);

watch(temperatureUnit, (value) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TEMPERATURE_UNIT_KEY, value);
  }
});

watch(distanceUnit, (value) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DISTANCE_UNIT_KEY, value);
  }
});

watch(activeTab, (value) => {
  if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_TAB_KEY, value);
  if (value === "tides") {
    selectedDateInput.value = selectedDateOptions.value[0]?.key ?? new Intl.DateTimeFormat("fr-CA").format(new Date());
  }
  if (value === "weather" && !selectedDateOptions.value.some((day) => day.key === selectedDateInput.value)) {
    selectedDateInput.value = selectedDateOptions.value[0]?.key ?? selectedDateInput.value;
  }
});

watch(selectedDateInput, () => {
  selectedTideIndex.value = null;
});

watch(locale, () => {
  freeParkingDestinationLayer.value?.setTooltipContent(t("appName"));
});

watch(
  [selectedDateInput, selectedWeatherTimeline],
  async () => {
    await nextTick();
    requestAnimationFrame(() => {
      scrollHourlyTimelineToCurrent();
    });
  },
  { immediate: true },
);

function celsiusToFahrenheit(value) {
  return Math.round((value * 9) / 5 + 32);
}

function metersToFeet(value) {
  return value * 3.28084;
}

function kilometersToMiles(value) {
  return value * 0.621371;
}

function millimetersToInches(value) {
  return value / 25.4;
}

function formatTemperature(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  return temperatureUnit.value === "f" ? celsiusToFahrenheit(Number(value)) : Math.round(Number(value));
}

function formatSeaTemperature(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  return `${formatTemperature(value)}`;
}

function formatTideHeight(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  if (distanceUnit.value === "imperial") {
    return `${metersToFeet(Number(value)).toFixed(1)} ft`;
  }

  return `${Number(value).toFixed(2)} m`;
}

function formatWind(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  if (distanceUnit.value === "imperial") {
    return `${Math.round(kilometersToMiles(Number(value)))} mph`;
  }

  return `${Math.round(Number(value))} km/h`;
}

function formatVisibility(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  if (distanceUnit.value === "imperial") {
    return `${kilometersToMiles(Number(value)).toFixed(1)} mi`;
  }

  return `${Number(value).toFixed(1)} km`;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  return `${Math.round(Number(value))}%`;
}

function formatPressure(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  return `${Math.round(Number(value))} hPa`;
}

function formatPrecipitation(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  if (distanceUnit.value === "imperial") {
    return `${millimetersToInches(Number(value)).toFixed(2)} in`;
  }

  return `${Number(value).toFixed(1)} mm`;
}

function getSwitchThumbStyle(activeIndex, count) {
  return {
    width: `calc((100% - 0.5rem) / ${count})`,
    transform: `translateX(${activeIndex * 100}%)`,
  };
}

function scrollHourlyTimelineToCurrent() {
  const container = hourlyScrollRef.value;
  if (!container || typeof window === "undefined") {
    return;
  }

  const currentCard = container.querySelector(".hourly-card-current");
  if (!currentCard) {
    container.scrollTo({ left: 0, behavior: "auto" });
    return;
  }

  const containerPadding = Number.parseFloat(window.getComputedStyle(container).paddingLeft || "0");
  const targetLeft = Math.max(0, currentCard.offsetLeft - containerPadding);
  container.scrollTo({
    left: targetLeft,
    behavior: "smooth",
  });
}

function formatTempRange(minValue, maxValue) {
  if (
    minValue === null ||
    minValue === undefined ||
    maxValue === null ||
    maxValue === undefined ||
    Number.isNaN(Number(minValue)) ||
    Number.isNaN(Number(maxValue))
  ) {
    return "--";
  }

  return `${formatTemperature(minValue)}° / ${formatTemperature(maxValue)}°`;
}

const selectedWeatherConditionLabel = computed(() =>
  weatherLoading.value ? t("gentleBreeze") : (selectedWeather.value?.condition ?? t("weatherUnavailable")),
);
const currentTideHighlights = computed(() => [currentTideClock.value?.previousEvent, currentTideClock.value?.nextEvent].filter(Boolean));
const hasFreeParkingZones = computed(() => Array.isArray(freeParkingGeoJson.value?.features) && freeParkingGeoJson.value.features.length > 0);

const selectedWeatherStats = computed(() => [
  {
    key: "temperatureRange",
    value: formatTempRange(selectedWeather.value?.minTemp, selectedWeather.value?.maxTemp),
  },
  {
    key: "feelsLike",
    value:
      selectedWeather.value?.feelsLike === null || selectedWeather.value?.feelsLike === undefined
        ? "--"
        : `${formatTemperature(selectedWeather.value.feelsLike)}°`,
  },
  {
    key: "wind",
    value: formatWind(selectedWeather.value?.windKmh),
  },
  {
    key: "cloudCover",
    value: formatPercent(selectedWeather.value?.cloudCover),
  },
  {
    key: "rainChance",
    value: formatPercent(selectedWeather.value?.rainProbability),
  },
]);

function getSkyPalette(iconCode, isSunVisible) {
  const icon = iconCode ?? "01d";
  const code = icon.slice(0, 2);
  const isNight = isSunVisible === false ? true : isSunVisible === true ? false : icon.endsWith("n");

  if (code === "11") {
    return { phone: isNight ? "#17263f" : "#5d7693", page: isNight ? "#0f172a" : "#dfe8f0" };
  }
  if (code === "09" || code === "10") {
    return { phone: isNight ? "#1d3146" : "#86a9c2", page: isNight ? "#111c2d" : "#e2ebf2" };
  }
  if (code === "13") {
    return { phone: isNight ? "#394f73" : "#d8e6f2", page: isNight ? "#161f31" : "#f0f5f8" };
  }
  if (code === "50") {
    return { phone: isNight ? "#293444" : "#bcc8d0", page: isNight ? "#161e29" : "#ebeff2" };
  }
  if (code === "02" || code === "03" || code === "04") {
    return { phone: isNight ? "#24385f" : "#a9c6e8", page: isNight ? "#10182b" : "#ebf1f8" };
  }

  return { phone: isNight ? "#1d3260" : "#8fcfff", page: isNight ? "#0d1526" : "#eef7ff" };
}

function extractIconCode(iconValue) {
  if (!iconValue) {
    return "01d";
  }

  if (/^\d{2}[dn]$/.test(iconValue)) {
    return iconValue;
  }

  const match = iconValue.match(/(\d{2}[dn])@2x/);
  return match?.[1] ?? "01d";
}

const isSunVisible = computed(() => {
  const weather = currentWeather.value;
  if (!weather) {
    return null;
  }

  if (weather.sunrise && weather.sunset && weather.currentTime) {
    return weather.currentTime >= weather.sunrise && weather.currentTime < weather.sunset;
  }

  return extractIconCode(weather.icon).endsWith("d");
});

const skyPalette = computed(() => getSkyPalette(extractIconCode(currentWeather.value?.icon), isSunVisible.value));
const pageStyle = computed(() => ({
  backgroundColor: skyPalette.value.page,
}));

const displayedTemperature = computed(() => formatTemperature(currentWeather.value?.temp));
const temperatureUnitLabel = computed(() => (temperatureUnit.value === "f" ? t("fahrenheit") : t("celsius")));
const weatherConditionLabel = computed(() => (weatherLoading.value ? t("gentleBreeze") : (currentWeather.value?.condition ?? t("gentleBreeze"))));

const tideClockDisplay = computed(() => {
  const angle = currentTideClock.value?.angle ?? 0;
  const radians = ((angle - 90) * Math.PI) / 180;
  const center = 110;
  const radius = 92;
  const handLength = 62;
  const handX = center + Math.cos(radians) * handLength;
  const handY = center + Math.sin(radians) * handLength;
  const handColor = currentTideClock.value?.direction === "rising" ? "#4baeb1" : currentTideClock.value?.direction === "falling" ? "#e58f64" : "#8fcfff";

  return { center, radius, handX, handY, handColor };
});

const selectedTidePoint = computed(() => {
  if (!tideSeries.value.length || selectedTideIndex.value === null) {
    return null;
  }

  const index = Math.max(0, Math.min(tideSeries.value.length - 1, selectedTideIndex.value));
  const series = tideSeries.value;
  const min = Math.min(...series.map((item) => item.height));
  const max = Math.max(...series.map((item) => item.height));
  const spread = Math.max(max - min, 1);
  const entry = series[index];

  return {
    x: (index / (series.length - 1)) * 100,
    y: 100 - ((entry.height - min) / spread) * 100,
    height: entry.height,
    time: entry.time,
  };
});

const activeTidePoint = computed(() => selectedTidePoint.value ?? tideNowMarker.value ?? null);
const isCurrentTideView = computed(() => selectedTideIndex.value === null);

function onTideChartClick(event) {
  updateTideChartSelection(event.clientX);
}

function updateTideChartSelection(clientX) {
  if (!tideChartRef.value || !tideSeries.value.length) {
    return;
  }

  const rect = tideChartRef.value.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  selectedTideIndex.value = Math.round(ratio * (tideSeries.value.length - 1));
}

function startTideChartDrag(event) {
  if (!tideSeries.value.length) {
    return;
  }

  isDraggingTideChart.value = true;
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  updateTideChartSelection(event.clientX);
}

function dragTideChart(event) {
  if (!isDraggingTideChart.value) {
    return;
  }

  updateTideChartSelection(event.clientX);
}

function stopTideChartDrag(event) {
  if (!isDraggingTideChart.value) {
    return;
  }

  isDraggingTideChart.value = false;
  event.currentTarget?.releasePointerCapture?.(event.pointerId);
}

function resetTideChartSelection() {
  selectedTideIndex.value = null;
}

function selectAvailableDay(key) {
  selectedDateInput.value = key;
}

function formatTideDayLabel(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale.value === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day, 12));
}

async function onTideListScroll(event) {
  const container = event.currentTarget;
  if (container.scrollTop < 120 && !tideListLoadingPast.value && !tideListPrepending.value) {
    const cards = Array.from(container.querySelectorAll(".tide-day-card"));
    const anchor = cards.find((card) => card.offsetTop + card.offsetHeight > container.scrollTop) ?? cards[0];
    const anchorKey = anchor?.getAttribute("data-tide-key");
    const anchorViewportOffset = anchor ? anchor.offsetTop - container.scrollTop : 0;
    tideListPrepending.value = true;
    try {
      await loadMoreTideDays("past");
      await nextTick();
      const restoredAnchor = anchorKey ? container.querySelector(`[data-tide-key="${anchorKey}"]`) : null;
      if (restoredAnchor) container.scrollTop = restoredAnchor.offsetTop - anchorViewportOffset;
    } finally {
      requestAnimationFrame(() => {
        tideListPrepending.value = false;
      });
    }
  }
  if (container.scrollHeight - container.scrollTop - container.clientHeight < 160 && !tideListLoadingFuture.value && !tideListAppending.value) {
    tideListAppending.value = true;
    try {
      await loadMoreTideDays("future");
    } finally {
      requestAnimationFrame(() => {
        tideListAppending.value = false;
      });
    }
  }
}

function scrollTideListToToday() {
  const container = tideListRef.value;
  const todayCard = container?.querySelector("[data-tide-today='true']");
  if (!container || !todayCard) return;
  container.scrollTo({
    top: Math.max(0, todayCard.offsetTop - container.offsetTop - 16),
    behavior: "smooth",
  });
}

watch(
  [activeTab, () => tideDayGroups.value.length],
  async ([tab]) => {
    if (tab !== "tides" || tideListCentered.value) return;
    await nextTick();
    const todayCard = tideListRef.value?.querySelector("[data-tide-today='true']");
    if (todayCard) {
      tideListRef.value.scrollTop = Math.max(0, todayCard.offsetTop - tideListRef.value.offsetTop - 16);
      tideListCentered.value = true;
    }
  },
  { immediate: true },
);

async function enableMotionPrompt() {
  if (motionPromptPending.value) {
    return;
  }

  motionPromptPending.value = true;

  try {
    const granted = await requestMotionAccess();
    if (granted) {
      showMotionPrompt.value = false;
      motionPromptDismissed.value = false;
    }
  } finally {
    motionPromptPending.value = false;
  }
}

function dismissMotionPrompt() {
  motionPromptDismissed.value = true;
  showMotionPrompt.value = false;
}

function initializeFreeParkingMap() {
  if (!freeParkingMapRef.value || freeParkingMapInstance.value) {
    return;
  }

  const map = L.map(freeParkingMapRef.value, {
    zoomControl: true,
    preferCanvas: false,
    renderer: freeParkingRenderer,
    scrollWheelZoom: true,
  }).setView([freeParkingFocusCoordinates.lat, freeParkingFocusCoordinates.lon], freeParkingFocusZoom);

  freeParkingBaseLayer.value = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  freeParkingMapInstance.value = map;
}

function recenterFreeParkingMap() {
  freeParkingMapInstance.value?.setView([freeParkingFocusCoordinates.lat, freeParkingFocusCoordinates.lon], freeParkingFocusZoom, {
    animate: true,
  });
}

function updateFreeParkingMap() {
  if (!freeParkingMapInstance.value || !freeParkingGeoJson.value) {
    return;
  }

  freeParkingMapInstance.value.invalidateSize(false);
  freeParkingZonesLayer.value?.remove();
  freeParkingDestinationLayer.value?.remove();

  freeParkingZonesLayer.value = L.geoJSON(freeParkingGeoJson.value, {
    renderer: freeParkingRenderer,
    style: (feature) =>
      feature?.geometry?.type === "LineString" || feature?.geometry?.type === "MultiLineString"
        ? { color: "#d83b3b", opacity: 0.9, weight: 9, lineCap: "round", lineJoin: "round" }
        : { fillColor: "#e34b4b", fillOpacity: 0.72, stroke: false, weight: 0 },
  });

  freeParkingZonesLayer.value.addTo(freeParkingMapInstance.value);

  freeParkingMapInstance.value.setView([freeParkingFocusCoordinates.lat, freeParkingFocusCoordinates.lon], freeParkingFocusZoom, {
    animate: false,
  });

  freeParkingDestinationLayer.value = L.marker([freeParkingFocusCoordinates.lat, freeParkingFocusCoordinates.lon], {
    icon: freeParkingMarkerIcon,
  })
    .addTo(freeParkingMapInstance.value)
    .bindTooltip(t("appName"), {
      direction: "top",
      offset: [0, -11],
    });

  requestAnimationFrame(() => {
    freeParkingMapInstance.value?.invalidateSize(false);
  });
}

async function loadFreeParkingGeoJson() {
  freeParkingError.value = "";

  try {
    if (stay.parking_geojson) {
      freeParkingGeoJson.value = stay.parking_geojson;
      await nextTick();
      initializeFreeParkingMap();
      updateFreeParkingMap();
      return;
    }
    const response = await fetch(`${import.meta.env.BASE_URL}freepark.geojson`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    freeParkingGeoJson.value = await response.json();
    await nextTick();
    initializeFreeParkingMap();
    updateFreeParkingMap();
  } catch (error) {
    freeParkingGeoJson.value = null;
    freeParkingError.value = `${t("freeParkingLoadError")} ${error.message}`;
  }
}

onMounted(() => {
  loadFreeParkingGeoJson();
});

onBeforeUnmount(() => {
  freeParkingMapInstance.value?.remove();
  freeParkingMapInstance.value = null;
  freeParkingBaseLayer.value = null;
  freeParkingZonesLayer.value = null;
  freeParkingDestinationLayer.value = null;
});
</script>

<template>
  <DataDisclaimer v-if="isDisclaimerRoute" :stay-name="stay.name" :back-url="`/${stay.slug}`" />
  <AdminLogin v-else-if="isAdminRoute && !isAuthenticated" />
  <div v-else class="stable-screen-min-height bg-page text-stone-800" :class="{ 'admin-mode': isAdminRoute }" :style="pageStyle">
    <AdminToolbar v-if="isAdminRoute" @settings="showAdminSettings = true" @parking="showParkingEditor = true" />
    <AdminSettings v-if="showAdminSettings" @close="showAdminSettings = false" @saved="finishSettings" />
    <ParkingEditor
      v-if="showParkingEditor"
      @close="showParkingEditor = false"
      @saved="
        loadFreeParkingGeoJson();
        adminNotice = 'Rues enregistrées.';
      "
    />
    <p v-if="adminNotice" class="admin-toast" role="status">{{ adminNotice }}</p>
    <div
      v-if="showMotionPrompt"
      class="fixed inset-0 z-[80] flex items-end bg-[#102038]/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="'motion-permission-title'"
    >
      <div class="w-full rounded-[2rem] border border-white/70 bg-[rgba(255,252,243,0.96)] p-5 shadow-[0_24px_60px_rgba(39,48,63,0.22)]">
        <p class="eyebrow">{{ permissionState === "denied" ? t("motionBlocked") : t("appName") }}</p>
        <h2 id="motion-permission-title" class="mt-2 font-display text-3xl text-stone-800">
          {{ permissionState === "denied" ? t("motionPromptDeniedTitle") : t("motionPromptTitle") }}
        </h2>
        <p class="mt-3 text-sm leading-6 text-stone-600">
          {{ permissionState === "denied" ? t("motionPromptDeniedBody") : t("motionPromptBody") }}
        </p>

        <div class="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            v-if="permissionState !== 'denied'"
            type="button"
            class="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#4baeb1] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(75,174,177,0.28)] transition active:translate-y-px disabled:cursor-wait disabled:opacity-70"
            :disabled="motionPromptPending"
            @click="enableMotionPrompt"
          >
            {{ motionPromptPending ? t("motionPromptLoading") : t("motionPromptAllow") }}
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-[#d8cfae] bg-white/80 px-5 text-sm font-semibold text-stone-700 transition active:translate-y-px"
            @click="dismissMotionPrompt"
          >
            {{ permissionState === "denied" ? t("close") : t("motionPromptLater") }}
          </button>
        </div>
      </div>
    </div>

    <main class="app-shell mx-auto flex w-full flex-col gap-4">
      <section class="app-hero-shell phone-shell relative isolate shadow-shell">
        <WaterScene
          :floating-image-url="stay.floating_image_url"
          :floating-image-asleep-url="stay.floating_image_asleep_url"
          :sky-color="skyPalette.phone"
          :water-ratio="currentWaterRatio"
          :tilt-x="tiltX"
          :tilt-y="tiltY"
          :energy="energy"
        />

        <div class="stable-screen-min-height relative z-10 flex flex-col justify-between p-5 pb-14 sm:p-6">
          <div class="space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="label-chip label-chip-header label-chip-nowrap mb-3">{{ t("appName") }}</p>
                <button v-if="showMotionButton" type="button" class="sensor-button mb-3" @click="showMotionPrompt = true">
                  {{ t("motionPromptAllow") }}
                </button>
                <h1 class="font-display text-3xl text-white drop-shadow-title">{{ t("cityName") }}</h1>
                <p class="text-sm font-medium text-white/85">{{ t("region") }}</p>
              </div>

              <div class="flex w-[15.5rem] flex-col items-end gap-2">
                <div class="switch-stack">
                  <div class="mini-switch mini-switch-block mini-switch-block-wide">
                    <span class="mini-switch-thumb" :style="getSwitchThumbStyle(localeActiveIndex, localeOptions.length)" aria-hidden="true"></span>
                    <button
                      v-for="option in localeOptions"
                      :key="option.value"
                      type="button"
                      class="mini-switch-button"
                      :class="{ 'mini-switch-button-active': locale === option.value }"
                      @click="locale = option.value"
                    >
                      {{ option.label }}
                    </button>
                  </div>

                  <div class="mini-switch mini-switch-block">
                    <span class="mini-switch-thumb" :style="getSwitchThumbStyle(temperatureUnitActiveIndex, 2)" aria-hidden="true"></span>
                    <button
                      type="button"
                      class="mini-switch-button"
                      :class="{ 'mini-switch-button-active': temperatureUnit === 'c' }"
                      @click="temperatureUnit = 'c'"
                    >
                      {{ t("celsius") }}
                    </button>
                    <button
                      type="button"
                      class="mini-switch-button"
                      :class="{ 'mini-switch-button-active': temperatureUnit === 'f' }"
                      @click="temperatureUnit = 'f'"
                    >
                      {{ t("fahrenheit") }}
                    </button>
                  </div>

                  <div class="mini-switch mini-switch-block">
                    <span class="mini-switch-thumb" :style="getSwitchThumbStyle(distanceUnitActiveIndex, 2)" aria-hidden="true"></span>
                    <button
                      type="button"
                      class="mini-switch-button"
                      :class="{ 'mini-switch-button-active': distanceUnit === 'metric' }"
                      @click="distanceUnit = 'metric'"
                    >
                      {{ t("metric") }}
                    </button>
                    <button
                      type="button"
                      class="mini-switch-button"
                      :class="{ 'mini-switch-button-active': distanceUnit === 'imperial' }"
                      @click="distanceUnit = 'imperial'"
                    >
                      {{ t("imperial") }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm uppercase tracking-[0.32em] text-white/75">{{ t("today") }}</p>
                <p class="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/85">{{ t("inTheAir") }}</p>
                <div class="flex items-start gap-3">
                  <span class="font-display text-[6.5rem] leading-none text-white drop-shadow-title">
                    {{ displayedTemperature }}
                  </span>
                  <span class="mt-4 font-display text-4xl text-white drop-shadow-title">&deg;{{ temperatureUnitLabel }}</span>
                </div>
              </div>

              <div class="flex flex-col items-end gap-2 pt-2">
                <img v-if="currentWeather?.animatedIcon" :src="currentWeather.animatedIcon" alt="" class="weather-hero-icon" aria-hidden="true" />
              </div>
            </div>
          </div>

          <div class="phone-floating-stack space-y-2.5">
            <div class="mt-2 flex items-end gap-3 w-full justify-between">
              <svg viewBox="0 0 220 220" class="h-36 w-36 overflow-visible" aria-hidden="true">
                <circle
                  :cx="tideClockDisplay.center"
                  :cy="tideClockDisplay.center"
                  :r="tideClockDisplay.radius"
                  fill="#fff9ea"
                  stroke="#d8cfae"
                  stroke-width="3"
                />
                <path d="M110 32 A78 78 0 0 1 110 188" fill="none" stroke="#e7c1aa" stroke-width="8" stroke-linecap="round" />
                <path d="M110 188 A78 78 0 0 1 110 32" fill="none" stroke="#9ed9d6" stroke-width="8" stroke-linecap="round" />
                <text x="110" y="55" text-anchor="middle" class="tide-clock-label tide-clock-label-high">{{ t("highTideShort") }}</text>
                <text x="110" y="175" text-anchor="middle" class="tide-clock-label tide-clock-label-low">{{ t("lowTideShort") }}</text>
                <line
                  :x1="tideClockDisplay.center"
                  :y1="tideClockDisplay.center"
                  :x2="tideClockDisplay.handX"
                  :y2="tideClockDisplay.handY"
                  :stroke="tideClockDisplay.handColor"
                  stroke-width="5"
                  stroke-linecap="round"
                />
                <circle :cx="tideClockDisplay.handX" :cy="tideClockDisplay.handY" r="7" :fill="tideClockDisplay.handColor" />
                <circle
                  :cx="tideClockDisplay.center"
                  :cy="tideClockDisplay.center"
                  r="8"
                  fill="#fff9ea"
                  :stroke="tideClockDisplay.handColor"
                  stroke-width="4"
                />
              </svg>
              <div class="flex flex-col items-end">
                <p class="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/85 drop-shadow-title">{{ t("inTheWater") }}</p>
                <div class="flex">
                  <span class="font-display text-[6.5rem] leading-none text-white drop-shadow-title">
                    {{ formatSeaTemperature(currentSeaTemperature) }}
                  </span>
                  <span class="mt-4 font-display text-4xl text-white drop-shadow-title">&deg;{{ temperatureUnitLabel }}</span>
                </div>
                <div class="mt-2 flex items-center gap-2">
                  <p class="pl-1 font-display text-2xl text-white/92 drop-shadow-title">
                    {{ formatTideHeight(currentTideCurrent?.height) }}
                  </p>
                  <p v-if="currentTideCoefficient !== null" class="current-tide-coefficient">{{ t("coefficientShort") }} {{ currentTideCoefficient }}</p>
                </div>
              </div>
            </div>

            <div class="hero-stats-grid grid grid-cols-2 gap-2">
              <article v-for="event in currentTideHighlights" :key="event.time" class="tide-summary-card">
                <div class="tide-summary-heading">
                  <span>{{ event.kind === "high" ? t("highTideFull") : t("lowTideFull") }}</span>
                  <span v-if="event.coef !== null && event.coef !== undefined" class="tide-summary-coef">{{ t("coefficientShort") }} {{ event.coef }}</span>
                </div>
                <div class="tide-summary-values">
                  <p class="tide-summary-time">{{ helpers.toHourMinute(new Date(event.time)) }}</p>
                  <p class="tide-summary-height">{{ formatTideHeight(event.height) }}</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="app-panels panel-stack">
        <article class="paper-panel">
          <div class="panel-scroll" :class="{ 'panel-scroll-tides': activeTab === 'tides' }">
            <nav class="lower-tabs" :aria-label="t('contentTabs')">
              <button
                v-for="tab in lowerTabs"
                :key="tab.key"
                type="button"
                class="lower-tab"
                :class="{ 'lower-tab-active': activeTab === tab.key }"
                @click="activeTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </nav>

            <div v-if="activeTab !== 'info'" class="daily-data-block">
              <WeatherTab v-if="activeTab === 'weather'" :title="t('weatherTab')">
                <div class="date-selector-shell panel-block">
                  <div class="edge-scroll min-w-0 pb-1">
                    <div class="day-pill-track">
                      <button
                        v-for="day in selectedDateOptions"
                        :key="day.key"
                        type="button"
                        class="day-pill"
                        :class="{ 'day-pill-active': day.key === selectedDateInput }"
                        :title="day.fullLabel"
                        @click="selectAvailableDay(day.key)"
                      >
                        {{ day.label }}
                      </button>
                    </div>
                  </div>
                </div>

                <div class="panel-block daily-data-section">
                  <div class="soft-card">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="eyebrow">{{ t("dayWeather") }}</p>
                        <h3 class="mt-1 font-display text-2xl text-stone-800">{{ selectedLabel }}</h3>
                      </div>
                      <div class="flex flex-col items-end gap-1">
                        <img v-if="selectedWeather?.animatedIcon" :src="selectedWeather.animatedIcon" alt="" class="weather-panel-icon" aria-hidden="true" />
                        <p class="rounded-full bg-[#fbf5df] px-3 py-2 text-sm font-semibold text-stone-700">
                          {{ selectedWeatherConditionLabel }}
                        </p>
                      </div>
                    </div>

                    <div class="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div class="flex items-start gap-2">
                          <span class="font-display text-5xl leading-none text-stone-800">
                            {{ formatTemperature(selectedWeather?.temp) }}
                          </span>
                          <span class="mt-1 font-display text-2xl text-stone-700">&deg;{{ temperatureUnitLabel }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="mt-4 grid grid-cols-2 gap-2">
                      <article v-for="item in selectedWeatherStats" :key="item.key" class="glass-tile day-detail-tile">
                        <p class="text-lg font-display text-stone-800">{{ item.value }}</p>
                        <p class="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-stone-600">
                          {{ t(item.key) }}
                        </p>
                      </article>
                      <article class="glass-tile day-detail-tile">
                        <p class="text-lg font-display text-stone-800">{{ formatPrecipitation(selectedWeather?.precipitationMm) }}</p>
                        <p class="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-stone-600">
                          {{ t("rainfall") }}
                        </p>
                      </article>
                    </div>

                    <div v-if="selectedWeather?.sunrise || selectedWeather?.sunset" class="mt-4 grid grid-cols-2 gap-2 rounded-[1.4rem] bg-white/70 p-3">
                      <div>
                        <p class="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-stone-500">{{ t("sunrise") }}</p>
                        <p class="mt-1 font-display text-xl text-stone-800">
                          {{ selectedWeather?.sunrise ? helpers.toHourMinute(new Date(selectedWeather.sunrise)) : "--" }}
                        </p>
                      </div>
                      <div class="text-right">
                        <p class="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-stone-500">{{ t("sunset") }}</p>
                        <p class="mt-1 font-display text-xl text-stone-800">
                          {{ selectedWeather?.sunset ? helpers.toHourMinute(new Date(selectedWeather.sunset)) : "--" }}
                        </p>
                      </div>
                    </div>

                    <div v-if="selectedWeatherTimeline.length" class="mt-4">
                      <div class="flex items-baseline justify-start gap-3">
                        <p class="eyebrow">{{ t("hourlyDetails") }}</p>
                      </div>

                      <div ref="hourlyScrollRef" class="hourly-scroll-shell edge-scroll-card mt-3">
                        <div class="hourly-strip">
                          <article
                            v-for="slot in selectedWeatherTimeline"
                            :key="`${slot.time}-${slot.label}`"
                            class="hourly-card"
                            :class="{ 'hourly-card-current': slot.isCurrent }"
                          >
                            <p class="hourly-time">{{ slot.label }}</p>
                            <img v-if="slot.animatedIcon" :src="slot.animatedIcon" alt="" class="hourly-weather-icon" aria-hidden="true" />
                            <p class="hourly-temp">{{ formatTemperature(slot.temp) }}&deg;</p>
                            <p class="hourly-meta">{{ formatPercent(slot.rainProbability) }}</p>
                          </article>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="panel-block daily-data-section">
                  <div class="soft-card">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="eyebrow">{{ t("tideCurve") }}</p>
                      </div>
                      <button
                        type="button"
                        class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fbf5df] text-stone-600 transition disabled:cursor-default disabled:opacity-55"
                        :disabled="isCurrentTideView"
                        :aria-label="t('chartNow')"
                        :title="t('chartNow')"
                        @click="resetTideChartSelection"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          class="h-4.5 w-4.5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                          <path d="M21 3v6h-6" />
                        </svg>
                        <span class="sr-only">{{ t("chartNow") }}</span>
                      </button>
                    </div>

                    <div class="tide-chart-wrap mt-4 rounded-[1.7rem] bg-[#fff9ea] p-4 shadow-inner-soft">
                      <div
                        ref="tideChartRef"
                        class="tide-chart-canvas"
                        @click="onTideChartClick"
                        @pointerdown="startTideChartDrag"
                        @pointermove="dragTideChart"
                        @pointerup="stopTideChartDrag"
                        @pointercancel="stopTideChartDrag"
                      >
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="h-44 w-full overflow-visible" aria-hidden="true">
                          <defs>
                            <linearGradient id="tideStroke" x1="0%" x2="100%" y1="0%" y2="0%">
                              <stop offset="0%" stop-color="#62c3be" />
                              <stop offset="100%" stop-color="#3d84a8" />
                            </linearGradient>
                          </defs>
                          <polyline fill="none" stroke="url(#tideStroke)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" :points="tideGraph" />
                          <template v-if="activeTidePoint">
                            <line :x1="activeTidePoint.x" y1="0" :x2="activeTidePoint.x" y2="100" stroke="#e58f64" stroke-dasharray="2 3" stroke-width="1.3" />
                          </template>
                        </svg>

                        <div v-if="activeTidePoint" class="tide-chart-dot" :style="{ left: `${activeTidePoint.x}%`, top: `${activeTidePoint.y}%` }"></div>
                      </div>

                      <div class="mt-3 flex justify-between text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                        <span>00:00</span>
                        <span>12:00</span>
                        <span>23:59</span>
                      </div>

                      <div v-if="activeTidePoint" class="mt-3 rounded-full bg-[#eb9b73] px-4 py-2 text-sm font-semibold text-white">
                        {{ t("chartSelection") }}:
                        {{ helpers.toHourMinute(new Date(activeTidePoint.time)) }}
                        -
                        {{ formatTideHeight(activeTidePoint.height) }}
                      </div>
                      <p v-else class="mt-3 text-sm text-stone-500">{{ t("tapChart") }}</p>
                    </div>
                  </div>
                </div>
              </WeatherTab>

              <TidesTab v-else-if="activeTab === 'tides'" :title="t('tidesTab')">
                <div class="panel-block daily-data-section">
              <div ref="tideListRef" class="tide-infinite-list" @scroll.passive="onTideListScroll">
                    <button type="button" class="tide-today-button" :aria-label="t('backToToday')" :title="t('backToToday')" @click="scrollTideListToToday">
                      <span aria-hidden="true">{{ t("todayShort") }}</span>
                </button>
                <p v-if="!canLoadPastTideDays" class="tide-list-boundary">{{ t("noMorePastTides") }}</p>
                <p v-if="tideListLoadingPast" class="tide-list-loading">{{ t("loadingPreviousTides") }}</p>
                    <article
                      v-for="day in tideDayGroups"
                      :key="day.key"
                      class="tide-day-card"
                      :class="{ 'tide-day-card-today': day.isToday }"
                      :data-tide-today="day.isToday"
                      :data-tide-key="day.key"
                    >
                      <header class="tide-day-header">
                        <h3>{{ formatTideDayLabel(day.key) }}</h3>
                        <span v-if="day.isToday">{{ t("todayShort") }}</span>
                  </header>
                  <div class="tide-day-events">
                    <div
                      v-for="turn in day.events"
                      :key="turn.time"
                      class="tide-list-event"
                      :class="turn.kind === 'high' ? 'tide-list-event-high' : 'tide-list-event-low'"
                    >
                      <p class="tide-list-event-kind">{{ turn.kind === "high" ? t("highTideFull") : t("lowTideFull") }}</p>
                      <p class="tide-list-event-time">{{ helpers.toHourMinute(new Date(turn.time)) }}</p>
                      <p class="tide-list-event-height">{{ formatTideHeight(turn.height) }}</p>
                      <p v-if="turn.coef !== null && turn.coef !== undefined" class="tide-list-event-coef">{{ t("coefficientShort") }} {{ turn.coef }}</p>
                    </div>
                  </div>
                </article>
                <p v-if="tideListLoadingFuture" class="tide-list-loading">{{ t("loadingNextTides") }}</p>
                <p v-if="!canLoadFutureTideDays" class="tide-list-boundary">{{ t("noMoreFutureTides") }}</p>
                <p v-if="tideError" class="tide-list-error">{{ tideError }}</p>
                  </div>
                </div>
              </TidesTab>
            </div>

            <InfoTab v-if="activeTab === 'info'" :title="t('infoTab')" class="info-tab-content">
              <div class="panel-block mt-4 info-parking-card">
                <div class="soft-card admin-parking-card-shell">
                  <button v-if="isAdminRoute" type="button" class="admin-parking-edit" aria-label="Gérer les rues de stationnement" title="Gérer les rues" @click="showParkingEditor = true">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 17V7h3.2a3 3 0 0 1 0 6H9.5m0 0h3.2" /></svg>
                  </button>
                  <div>
                    <p class="eyebrow">{{ t("freeParkingEyebrow") }}</p>
                  </div>

                  <p class="mt-3 text-sm leading-6 text-stone-600">
                    {{ t("freeParkingBody") }}
                  </p>

                  <div class="parking-legend mt-3">
                    <span class="parking-legend-swatch" aria-hidden="true"></span>
                    <span>{{ t("freeParkingLegend") }}</span>
                  </div>

                  <div v-if="hasFreeParkingZones || isAdminRoute" class="parking-map-shell mt-4">
                    <button type="button" class="parking-map-recenter" :aria-label="t('freeParkingRecenter')" @click="recenterFreeParkingMap">
                      {{ t("freeParkingRecenter") }}
                    </button>
                    <div ref="freeParkingMapRef" class="parking-map-canvas" :aria-label="t('freeParkingTitle')"></div>
                  </div>

                  <p v-else-if="freeParkingError" class="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
                    {{ freeParkingError }}
                  </p>

                  <p v-else class="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
                    {{ t("freeParkingEmpty") }}
                  </p>

                  <p class="parking-disclaimer mt-4">
                    {{ t("freeParkingDisclaimer") }}
                  </p>
                </div>
              </div>

              <div class="panel-block mt-4 info-links-card">
                <div class="soft-card">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <p class="eyebrow">{{ t("usefulInfo") }}</p>
                    </div>
                  </div>

                  <div class="mt-5 grid gap-3 md:grid-cols-2">
                    <a v-for="link in usefulLinks" :key="link.id" :href="link.url" class="event-card block no-underline" target="_blank" rel="noreferrer">
                      <div v-if="link.tag" class="flex items-start justify-between gap-3">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="event-tag">{{ link.tag }}</span>
                        </div>
                      </div>
                      <h3 class="font-display text-2xl text-stone-800">{{ link.title }}</h3>
                      <p v-if="link.description" class="mt-3 text-sm leading-6 text-stone-600">{{ link.description }}</p>
                      <div class="mt-4 flex items-center justify-between gap-3">
                        <p class="text-xs uppercase tracking-[0.16em] text-stone-500">{{ link.sourceLabel }}</p>
                        <p class="rounded-full bg-[#eb9b73] px-3 py-2 text-sm font-semibold text-white">{{ t("openLink") }}</p>
                      </div>
                    </a>

                    <article v-if="!usefulLinks.length" class="event-card md:col-span-2">
                      <h3 class="font-display text-2xl text-stone-800">{{ t("usefulLinksEmptyTitle") }}</h3>
                      <p class="mt-3 text-sm leading-6 text-stone-600">{{ t("usefulLinksEmptyBody") }}</p>
                    </article>
                  </div>
                </div>
              </div>

              <div class="panel-block mt-4 info-story-card">
                <div class="soft-card story-card">
                  <p class="eyebrow">{{ t("storyEyebrow") }}</p>
                  <h2 class="panel-title">{{ t("storyTitle") }}</h2>
                  <p class="mt-3 text-sm leading-7 text-stone-600">
                    {{ t("storyBody") }}
                  </p>
                </div>
              </div>
              <footer class="panel-block mt-4 space-y-1 text-xs leading-5 text-stone-500 info-footer">
                <p>{{ t("dataAttribution") }}</p>
                <p><a class="legal-footer-link" :href="`/${stay.slug}/responsabilite-donnees`">Utilisation des données et responsabilité</a></p>
                <p>{{ t("appVersionLabel") }} {{ APP_VERSION }}</p>
                <p>{{ t("madeBy") }}</p>
              </footer>
            </InfoTab>

            <p v-if="weatherError" class="panel-block mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
              {{ weatherError }}
            </p>
            <p v-if="seaTemperatureError" class="panel-block mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
              {{ seaTemperatureError }}
            </p>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>
