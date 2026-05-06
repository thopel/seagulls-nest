<script setup>
import { computed, ref, watch } from "vue";
import WaterScene from "./components/WaterScene.vue";
import { useDinardData } from "./composables/useDinardData";
import { useLocale } from "./composables/useLocale";
import { useMotionGlass } from "./composables/useMotionGlass";

const { locale, localeOptions, t } = useLocale();

const TEMPERATURE_UNIT_KEY = "le-nid-temperature-unit";
const DISTANCE_UNIT_KEY = "le-nid-distance-unit";

const temperatureUnit = ref(typeof window !== "undefined" && window.localStorage.getItem(TEMPERATURE_UNIT_KEY) === "f" ? "f" : "c");
const distanceUnit = ref(typeof window !== "undefined" && window.localStorage.getItem(DISTANCE_UNIT_KEY) === "imperial" ? "imperial" : "metric");

const {
  currentSeaTemperature,
  currentTideClock,
  currentTideCurrent,
  currentWaterRatio,
  currentWeather,
  eventsForDay,
  selectedDateInput,
  selectedDateOptions,
  selectedLabel,
  selectedWeather,
  selectedWeatherTimeline,
  seaTemperatureError,
  tideEvents,
  tideError,
  tideGraph,
  tideLoading,
  tideNowMarker,
  tideSeries,
  weatherError,
  weatherLoading,
  helpers,
} = useDinardData(locale, t);

const { tiltX, tiltY, energy } = useMotionGlass();

const tideChartRef = ref(null);
const selectedTideIndex = ref(null);

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

watch(selectedDateInput, () => {
  selectedTideIndex.value = null;
});

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

const stats = computed(() => [
  {
    key: "humidity",
    value: `${currentWeather.value?.humidity ?? "--"}%`,
  },
  {
    key: "wind",
    value: formatWind(currentWeather.value?.windKmh),
  },
  {
    key: "visibility",
    value: formatVisibility(currentWeather.value?.visibilityKm),
  },
]);

const selectedWeatherConditionLabel = computed(() =>
  weatherLoading.value ? t("gentleBreeze") : (selectedWeather.value?.condition ?? t("weatherUnavailable")),
);

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
    key: "humidity",
    value: formatPercent(selectedWeather.value?.humidity),
  },
  {
    key: "wind",
    value: formatWind(selectedWeather.value?.windKmh),
  },
  {
    key: "visibility",
    value: formatVisibility(selectedWeather.value?.visibilityKm),
  },
  {
    key: "cloudCover",
    value: formatPercent(selectedWeather.value?.cloudCover),
  },
  {
    key: "rainChance",
    value: formatPercent(selectedWeather.value?.rainProbability),
  },
  {
    key: "pressure",
    value: formatPressure(selectedWeather.value?.pressure),
  },
  {
    key: "rainfall",
    value: formatPrecipitation(selectedWeather.value?.precipitationMm),
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

const visualScaleLabel = computed(() => (distanceUnit.value === "imperial" ? t("visualScaleImperial") : t("visualScaleMetric")));
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
  if (!tideChartRef.value || !tideSeries.value.length) {
    return;
  }

  const rect = tideChartRef.value.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  selectedTideIndex.value = Math.round(ratio * (tideSeries.value.length - 1));
}

function resetTideChartSelection() {
  selectedTideIndex.value = null;
}

function selectAvailableDay(key) {
  selectedDateInput.value = key;
}
</script>

<template>
  <div class="min-h-[100dvh] bg-page text-stone-800" :style="pageStyle">
    <main class="mx-auto flex max-w-6xl flex-col gap-4 lg:grid lg:grid-cols-[minmax(320px,390px)_1fr]">
      <section class="phone-shell relative isolate shadow-shell">
        <WaterScene :sky-color="skyPalette.phone" :water-ratio="currentWaterRatio" :tilt-x="tiltX" :tilt-y="tiltY" :energy="energy" />

        <div class="relative z-10 flex min-h-[100dvh] flex-col justify-between p-5 pb-14 sm:p-6">
          <div class="space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="label-chip label-chip-header label-chip-nowrap mb-3">{{ t("appName") }}</p>
                <h1 class="font-display text-3xl text-white drop-shadow-title">Dinard</h1>
                <p class="text-sm font-medium text-white/85">{{ t("region") }}</p>
              </div>

              <div class="flex w-[15.5rem] flex-col items-end gap-2">
                <div class="switch-stack">
                  <div class="mini-switch mini-switch-block mini-switch-block-wide">
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
                <div class="mt-3 flex items-start gap-3">
                  <span class="font-display text-[6.5rem] leading-none text-white drop-shadow-title">
                    {{ displayedTemperature }}
                  </span>
                  <span class="mt-4 font-display text-4xl text-white drop-shadow-title">&deg;{{ temperatureUnitLabel }}</span>
                </div>
              </div>

              <div class="flex flex-col items-end gap-2 pt-2">
                <img v-if="currentWeather?.animatedIcon" :src="currentWeather.animatedIcon" alt="" class="weather-hero-icon" aria-hidden="true" />
                <p class="condition-pill">
                  {{ weatherConditionLabel }}
                </p>
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
                <div class="flex">
                  <span class="font-display text-[6.5rem] leading-none text-white drop-shadow-title">
                    {{ formatSeaTemperature(currentSeaTemperature) }}
                  </span>
                  <span class="mt-4 font-display text-4xl text-white drop-shadow-title">&deg;{{ temperatureUnitLabel }}</span>
                </div>
                <p class="mt-2 pl-1 font-display text-2xl text-white/92 drop-shadow-title">
                  {{ formatTideHeight(currentTideCurrent?.height) }}
                </p>
              </div>
            </div>

            <div class="hero-stats-grid grid grid-cols-3 gap-2">
              <article v-for="item in stats" :key="item.key" class="glass-tile hero-stat-tile">
                <p class="hero-stat-value font-display text-stone-800">{{ item.value }}</p>
                <p class="hero-stat-label mt-1 font-semibold uppercase tracking-[0.18em] text-stone-600">
                  {{ t(item.key) }}
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="panel-stack">
        <article class="paper-panel">
          <div class="date-selector-shell">
            <div class="min-w-0">
              <p class="mt-2 font-display text-2xl text-stone-800">{{ selectedLabel }}</p>
              <p class="mt-1 text-sm text-stone-500">{{ t("availableWindow") }}</p>
            </div>

            <div class="overflow-x-auto pb-1">
              <div class="inline-flex min-w-max gap-2">
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

          <div class="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div class="soft-card">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="eyebrow">{{ t("tideCurve") }}</p>
                  <p class="text-sm text-stone-600">
                    {{ tideLoading ? t("tideLoading") : t("tideResolution") }}
                  </p>
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
                <div ref="tideChartRef" class="tide-chart-canvas" @click="onTideChartClick">
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

                <div v-if="activeTidePoint" class="mt-3 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-stone-700">
                  {{ t("chartSelection") }}:
                  {{ helpers.toHourMinute(new Date(activeTidePoint.time)) }}
                  -
                  {{ formatTideHeight(activeTidePoint.height) }}
                </div>
                <p v-else class="mt-3 text-sm text-stone-500">{{ t("tapChart") }}</p>
              </div>
            </div>

            <div class="soft-card">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="eyebrow">{{ t("dayWeather") }}</p>
                  <h3 class="mt-1 font-display text-2xl text-stone-800">{{ selectedLabel }}</h3>
                </div>
                <img v-if="selectedWeather?.animatedIcon" :src="selectedWeather.animatedIcon" alt="" class="weather-panel-icon" aria-hidden="true" />
              </div>

              <div class="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div class="flex items-start gap-2">
                    <span class="font-display text-5xl leading-none text-stone-800">
                      {{ formatTemperature(selectedWeather?.temp) }}
                    </span>
                    <span class="mt-1 font-display text-2xl text-stone-700">&deg;{{ temperatureUnitLabel }}</span>
                  </div>
                  <p class="mt-2 rounded-full bg-[#fbf5df] px-3 py-2 text-sm font-semibold text-stone-700">
                    {{ selectedWeatherConditionLabel }}
                  </p>
                </div>

                <div class="rounded-[1.3rem] bg-white/75 px-4 py-3 text-right shadow-inner-soft">
                  <p class="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-stone-500">{{ t("rainfall") }}</p>
                  <p class="mt-1 font-display text-2xl text-stone-800">{{ formatPrecipitation(selectedWeather?.precipitationMm) }}</p>
                </div>
              </div>

              <div class="mt-4 grid grid-cols-2 gap-2">
                <article v-for="item in selectedWeatherStats" :key="item.key" class="glass-tile">
                  <p class="text-lg font-display text-stone-800">{{ item.value }}</p>
                  <p class="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-stone-600">
                    {{ t(item.key) }}
                  </p>
                </article>
              </div>

              <div
                v-if="selectedWeather?.sunrise || selectedWeather?.sunset"
                class="mt-4 grid grid-cols-2 gap-2 rounded-[1.4rem] bg-white/70 p-3 shadow-inner-soft"
              >
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
                <div class="flex items-baseline justify-between gap-3">
                  <p class="eyebrow">{{ t("hourlyDetails") }}</p>
                  <p class="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                    {{ t("forecastEvery3Hours") }}
                  </p>
                </div>

                <div class="hourly-scroll-shell mt-3">
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

          <div class="mt-4 soft-card">
            <p class="eyebrow">{{ t("highlights") }}</p>
            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <article v-for="turn in tideEvents" :key="turn.time" class="turn-card">
                <div>
                  <p class="font-display text-xl text-stone-800">{{ formatTideHeight(turn.height) }}</p>
                  <p class="text-xs uppercase tracking-[0.18em] text-stone-500">
                    {{ turn.kind === "high" ? t("highTideFull") : t("lowTideFull") }}
                  </p>
                </div>
                <p class="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-stone-700">
                  {{ helpers.toHourMinute(new Date(turn.time)) }}
                </p>
              </article>
            </div>

            <p v-if="!tideEvents.length && !tideLoading && !tideError" class="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
              {{ t("noTideData") }}
            </p>
            <p v-if="tideError" class="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
              {{ tideError }}
            </p>
          </div>

          <div class="mt-4 soft-card">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="eyebrow">{{ t("localOutings") }}</p>
                <h2 class="panel-title">{{ t("cityAgenda") }}</h2>
                <p class="mt-2 text-sm text-stone-500">{{ t("agendaForDate") }}</p>
              </div>
              <p class="note-chip">
                {{ eventsForDay.length }}
                {{ eventsForDay.length > 1 ? t("eventCountPlural") : t("eventCount") }}
              </p>
            </div>

            <div class="mt-5 grid gap-3 md:grid-cols-2">
              <article v-for="event in eventsForDay" :key="`${event.title}-${event.start}`" class="event-card">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="event-badge">{{ t("cityBadge") }}</span>
                    <span v-if="event.tag" class="event-tag">{{ event.tag }}</span>
                  </div>
                  <p class="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                    {{ helpers.toHourMinute(new Date(event.start)) }} - {{ helpers.toHourMinute(new Date(event.end)) }}
                  </p>
                </div>
                <h3 class="mt-3 font-display text-2xl text-stone-800">{{ event.title }}</h3>
                <p class="mt-3 text-sm leading-6 text-stone-600">{{ event.description }}</p>
                <div class="mt-4 flex items-center justify-between gap-3">
                  <p class="rounded-full bg-[#fbf5df] px-3 py-2 text-sm font-semibold text-stone-700">{{ event.location }}</p>
                  <p class="text-xs uppercase tracking-[0.16em] text-stone-500">{{ selectedLabel }}</p>
                </div>
              </article>

              <article v-if="!eventsForDay.length" class="event-card md:col-span-2">
                <h3 class="font-display text-2xl text-stone-800">{{ t("quietDay") }}</h3>
                <p class="mt-3 text-sm leading-6 text-stone-600">{{ t("quietDayBody") }}</p>
              </article>
            </div>
          </div>

          <div class="mt-4 soft-card story-card">
            <p class="eyebrow">{{ t("storyEyebrow") }}</p>
            <h2 class="panel-title">{{ t("storyTitle") }}</h2>
            <p class="mt-3 text-sm leading-7 text-stone-600">
              {{ t("storyBody") }}
            </p>
          </div>

          <p v-if="weatherError" class="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
            {{ weatherError }}
          </p>
          <p v-if="seaTemperatureError" class="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
            {{ seaTemperatureError }}
          </p>

          <div class="mt-4 space-y-1 text-xs leading-5 text-stone-500">
            <p>{{ t("dataAttribution") }}</p>
            <p>{{ t("madeBy") }}</p>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>
