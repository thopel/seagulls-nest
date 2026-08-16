import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import destinationConfig from '../data/destination.json'
import usefulLinksData from '../data/useful-links.json'
import clearDaySvg from '@meteocons/svg/fill/clear-day.svg'
import clearNightSvg from '@meteocons/svg/fill/clear-night.svg'
import cloudySvg from '@meteocons/svg/fill/cloudy.svg'
import drizzleSvg from '@meteocons/svg/fill/drizzle.svg'
import fogDaySvg from '@meteocons/svg/fill/fog-day.svg'
import fogNightSvg from '@meteocons/svg/fill/fog-night.svg'
import fogSvg from '@meteocons/svg/fill/fog.svg'
import mostlyClearDaySvg from '@meteocons/svg/fill/mostly-clear-day.svg'
import mostlyClearNightSvg from '@meteocons/svg/fill/mostly-clear-night.svg'
import overcastDayRainSvg from '@meteocons/svg/fill/overcast-day-rain.svg'
import overcastNightRainSvg from '@meteocons/svg/fill/overcast-night-rain.svg'
import overcastRainSvg from '@meteocons/svg/fill/overcast-rain.svg'
import overcastSvg from '@meteocons/svg/fill/overcast.svg'
import partlyCloudyDaySvg from '@meteocons/svg/fill/partly-cloudy-day.svg'
import partlyCloudyNightSvg from '@meteocons/svg/fill/partly-cloudy-night.svg'
import sleetSvg from '@meteocons/svg/fill/sleet.svg'
import snowSvg from '@meteocons/svg/fill/snow.svg'
import thunderstormsRainSvg from '@meteocons/svg/fill/thunderstorms-rain.svg'
import thunderstormsSvg from '@meteocons/svg/fill/thunderstorms.svg'

const DESTINATION = destinationConfig.destination
const MAX_WATER_HEIGHT = DESTINATION.tide.maxVisualHeightMeters
const FALLBACK_TIDE_SITE = DESTINATION.tide.fallbackSite

const METEOCONS = {
  clearDay: clearDaySvg,
  clearNight: clearNightSvg,
  mostlyClearDay: mostlyClearDaySvg,
  mostlyClearNight: mostlyClearNightSvg,
  partlyCloudyDay: partlyCloudyDaySvg,
  partlyCloudyNight: partlyCloudyNightSvg,
  cloudy: cloudySvg,
  overcast: overcastSvg,
  fogDay: fogDaySvg,
  fogNight: fogNightSvg,
  fog: fogSvg,
  drizzle: drizzleSvg,
  rainDay: overcastDayRainSvg,
  rainNight: overcastNightRainSvg,
  rain: overcastRainSvg,
  sleet: sleetSvg,
  snow: snowSvg,
  thunderstorms: thunderstormsSvg,
  thunderstormsRain: thunderstormsRainSvg
}

function mapSeaTemperatureDays(hourly) {
  const times = hourly?.time ?? []
  const values = hourly?.sea_surface_temperature ?? []
  const byDay = new Map()

  for (let index = 0; index < times.length; index += 1) {
    const value = values[index]
    if (value === null || value === undefined) {
      continue
    }

    const date = new Date(times[index])
    const key = toDateKey(date)
    const bucket = byDay.get(key) ?? []
    bucket.push({ key, date, value: Number(value) })
    byDay.set(key, bucket)
  }

  return Array.from(byDay.entries()).map(([key, entries]) => {
    const nearestToNoon =
      entries.reduce((best, entry) => {
        const distance = Math.abs(getLocalHour(entry.date) - 12)
        if (!best || distance < best.distance) {
          return { distance, entry }
        }
        return best
      }, null)?.entry ?? entries[0]

    return {
      key,
      date: nearestToNoon.date,
      value: nearestToNoon.value
    }
  })
}

function toDateKey(value) {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: DESTINATION.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value)
}

function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function toHourMinute(value, locale) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    timeZone: DESTINATION.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale === 'en'
  }).format(value)
}

function getLocalHour(value) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: DESTINATION.timezone,
      hour: '2-digit',
      hour12: false
    }).format(value)
  )
}

function getIsoAtLocalTime(date, hour, minute) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DESTINATION.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
    .formatToParts(date)
    .reduce((accumulator, part) => {
      accumulator[part.type] = part.value
      return accumulator
    }, {})

  return `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function findNearest(values, targetDate) {
  return values.reduce((closest, entry) => {
    if (!closest) {
      return entry
    }

    const currentDistance = Math.abs(new Date(entry.time).getTime() - targetDate.getTime())
    const closestDistance = Math.abs(new Date(closest.time).getTime() - targetDate.getTime())
    return currentDistance < closestDistance ? entry : closest
  }, null)
}

function interpolateHeightAt(series, targetDate) {
  if (!series.length) {
    return null
  }

  const target = targetDate.getTime()

  for (let index = 0; index < series.length - 1; index += 1) {
    const start = new Date(series[index].time).getTime()
    const end = new Date(series[index + 1].time).getTime()

    if (target >= start && target <= end) {
      const ratio = end === start ? 0 : (target - start) / (end - start)
      return series[index].height + (series[index + 1].height - series[index].height) * ratio
    }
  }

  return null
}

function getTurningPoints(series) {
  return series.flatMap((entry, index, values) => {
    if (index === 0 || index === values.length - 1) {
      return []
    }

    const previous = values[index - 1].height
    const current = entry.height
    const next = values[index + 1].height

    if (current >= previous && current >= next && (current > previous || current > next)) {
      return [{ ...entry, kind: 'high' }]
    }

    if (current <= previous && current <= next && (current < previous || current < next)) {
      return [{ ...entry, kind: 'low' }]
    }

    return []
  })
}

function dedupeTurningPoints(events) {
  const deduped = []

  for (const event of events) {
    const last = deduped[deduped.length - 1]
    if (!last || last.kind !== event.kind) {
      deduped.push(event)
      continue
    }

    const difference = (new Date(event.time) - new Date(last.time)) / 60000
    if (difference > 30) {
      deduped.push(event)
      continue
    }

    if (
      (event.kind === 'high' && event.height > last.height) ||
      (event.kind === 'low' && event.height < last.height)
    ) {
      deduped[deduped.length - 1] = event
    }
  }

  return deduped
}

function addDaysToKey(key, amount) {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + amount)
  return toDateKey(date)
}

function mapTideExtrema(payload, dateKey) {
  const extrema = (Array.isArray(payload?.data) ? payload.data : [])
    .flatMap((day) => (day.extrema ?? []).map((entry) => ({
      time: `${day.date ?? dateKey}T${entry.time}:00`,
      height: Number(entry.height),
      kind: entry.type === 'PM' ? 'high' : 'low',
      coef: entry.coef ?? null,
      coefficientIsAssociated: false
    })))
    .filter((entry) => Number.isFinite(entry.height))

  const highTides = extrema.filter((entry) => entry.kind === 'high' && entry.coef !== null)
  return extrema.map((entry) => {
    if (entry.kind === 'high' || !highTides.length) return entry
    const nextHigh = highTides.find((highTide) => new Date(highTide.time) > new Date(entry.time))
    return nextHigh ? { ...entry, coef: nextHigh.coef, coefficientIsAssociated: true } : entry
  })
}

function getTideClockState(series, events, referenceDate, isToday) {
  if (!series.length || !events.length) {
    return {
      angle: 0,
      currentHeight: null,
      direction: null,
      nextEvent: null,
      previousEvent: null
    }
  }

  const fallbackReference = new Date(series[0].time)
  const activeReference = isToday ? referenceDate : fallbackReference
  const activeTime = activeReference.getTime()

  let previousEvent = null
  let nextEvent = null

  for (const event of events) {
    const eventTime = new Date(event.time).getTime()
    if (eventTime <= activeTime) {
      previousEvent = event
    }

    if (eventTime > activeTime && !nextEvent) {
      nextEvent = event
    }
  }

  let direction = null
  if (previousEvent && nextEvent) {
    direction = nextEvent.kind === 'high' ? 'rising' : 'falling'
  } else if (previousEvent) {
    direction = previousEvent.kind === 'high' ? 'falling' : 'rising'
  } else if (nextEvent) {
    direction = nextEvent.kind === 'high' ? 'rising' : 'falling'
  }

  let angle = 0
  if (previousEvent && nextEvent) {
    const previousTime = new Date(previousEvent.time).getTime()
    const nextTime = new Date(nextEvent.time).getTime()
    const progress = Math.max(0, Math.min(1, (activeTime - previousTime) / (nextTime - previousTime)))

    if (previousEvent.kind === 'high') {
      angle = progress * 180
    } else {
      angle = 180 + progress * 180
    }
  } else if (previousEvent) {
    angle = previousEvent.kind === 'high' ? 30 : 210
  } else if (nextEvent) {
    angle = nextEvent.kind === 'high' ? 330 : 150
  }

  return {
    angle,
    currentHeight: isToday ? interpolateHeightAt(series, activeReference) : series[0].height,
    direction,
    nextEvent,
    previousEvent
  }
}

function getWeatherCodeMeta(code, isDay, locale, t) {
  const safeCode = Number.isFinite(Number(code)) ? Number(code) : -1
  const suffix = isDay === false ? 'n' : 'd'

  if (safeCode === 0) {
    return {
      icon: `01${suffix}`,
      animatedIcon: isDay === false ? METEOCONS.clearNight : METEOCONS.clearDay,
      condition: locale === 'en' ? 'Clear sky' : 'Ciel dégagé'
    }
  }
  if (safeCode === 1) {
    return {
      icon: `02${suffix}`,
      animatedIcon: isDay === false ? METEOCONS.mostlyClearNight : METEOCONS.mostlyClearDay,
      condition: locale === 'en' ? 'Mostly clear' : 'Plutôt dégagé'
    }
  }
  if (safeCode === 2) {
    return {
      icon: `03${suffix}`,
      animatedIcon: isDay === false ? METEOCONS.partlyCloudyNight : METEOCONS.partlyCloudyDay,
      condition: locale === 'en' ? 'Partly cloudy' : 'Partiellement nuageux'
    }
  }
  if (safeCode === 3) {
    return { icon: `04${suffix}`, animatedIcon: METEOCONS.overcast, condition: locale === 'en' ? 'Overcast' : 'Couvert' }
  }
  if (safeCode === 45 || safeCode === 48) {
    return {
      icon: `50${suffix}`,
      animatedIcon: isDay === false ? METEOCONS.fogNight : isDay === true ? METEOCONS.fogDay : METEOCONS.fog,
      condition: locale === 'en' ? 'Fog' : 'Brouillard'
    }
  }
  if ([51, 53, 55, 56, 57].includes(safeCode)) {
    return { icon: `09${suffix}`, animatedIcon: METEOCONS.drizzle, condition: locale === 'en' ? 'Drizzle' : 'Bruine' }
  }
  if ([61, 63, 65, 80, 81, 82].includes(safeCode)) {
    return {
      icon: `10${suffix}`,
      animatedIcon: isDay === false ? METEOCONS.rainNight : isDay === true ? METEOCONS.rainDay : METEOCONS.rain,
      condition: locale === 'en' ? 'Rain' : 'Pluie'
    }
  }
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(safeCode)) {
    return {
      icon: `13${suffix}`,
      animatedIcon: [66, 67].includes(safeCode) ? METEOCONS.sleet : METEOCONS.snow,
      condition: locale === 'en' ? ([66, 67].includes(safeCode) ? 'Sleet' : 'Snow') : ([66, 67].includes(safeCode) ? 'Neige fondue' : 'Neige')
    }
  }
  if ([95, 96, 99].includes(safeCode)) {
    return {
      icon: `11${suffix}`,
      animatedIcon: [96, 99].includes(safeCode) ? METEOCONS.thunderstormsRain : METEOCONS.thunderstorms,
      condition: locale === 'en' ? 'Thunderstorm' : 'Orage'
    }
  }

  return {
    icon: `02${suffix}`,
    animatedIcon: isDay === false ? METEOCONS.mostlyClearNight : METEOCONS.mostlyClearDay,
    condition: t('variable')
  }
}

function toTimestamp(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function mapForecastTimeline(hourly, locale, t) {
  const times = hourly?.time ?? []

  return times.map((time, index) => {
    const date = new Date(time)
    const meta = getWeatherCodeMeta(hourly?.weather_code?.[index], hourly?.is_day?.[index] === 1, locale, t)

    return {
      dayKey: toDateKey(date),
      time: date.getTime(),
      label: new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: DESTINATION.timezone,
        hour12: locale === 'en'
      }).format(date),
      temp: hourly?.temperature_2m?.[index] ?? null,
      feelsLike: hourly?.apparent_temperature?.[index] ?? null,
      humidity: hourly?.relative_humidity_2m?.[index] ?? null,
      windKmh: hourly?.wind_speed_10m?.[index] ?? null,
      visibilityKm:
        hourly?.visibility?.[index] === null || hourly?.visibility?.[index] === undefined
          ? null
          : Number((hourly.visibility[index] / 1000).toFixed(1)),
      pressure: hourly?.pressure_msl?.[index] ?? null,
      cloudCover: hourly?.cloud_cover?.[index] ?? null,
      rainProbability: hourly?.precipitation_probability?.[index] ?? null,
      precipitationMm: hourly?.precipitation?.[index] ?? null,
      icon: meta.icon,
      animatedIcon: meta.animatedIcon,
      condition: meta.condition
    }
  })
}

function mapForecastDays(daily, hourlyEntries, locale, t) {
  const times = daily?.time ?? []

  return times.map((day, index) => {
    const date = parseDateKey(day) ?? new Date(`${day}T12:00:00`)
    const dayKey = toDateKey(date)
    const slots = hourlyEntries.filter((entry) => entry.dayKey === dayKey)
    const midday =
      slots.find((entry) => {
        const hour = new Date(entry.time).getHours()
        return hour >= 12
      }) ?? slots[Math.floor(slots.length / 2)] ?? null
    const meta = getWeatherCodeMeta(daily?.weather_code?.[index], true, locale, t)

    return {
      key: dayKey,
      date,
      label: new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: DESTINATION.timezone
      }).format(date),
      shortLabel: new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
        weekday: 'short',
        day: 'numeric',
        timeZone: DESTINATION.timezone
      }).format(date),
      temp: midday?.temp ?? Math.round(((daily?.temperature_2m_min?.[index] ?? 0) + (daily?.temperature_2m_max?.[index] ?? 0)) / 2),
      minTemp: daily?.temperature_2m_min?.[index] ?? null,
      maxTemp: daily?.temperature_2m_max?.[index] ?? null,
      feelsLike: midday?.feelsLike ?? null,
      humidity:
        slots.length
          ? Math.round(slots.reduce((total, entry) => total + (entry.humidity ?? 0), 0) / slots.length)
          : null,
      windKmh: daily?.wind_speed_10m_max?.[index] ?? null,
      visibilityKm: midday?.visibilityKm ?? null,
      pressure: midday?.pressure ?? null,
      cloudCover:
        slots.length
          ? Math.round(slots.reduce((total, entry) => total + (entry.cloudCover ?? 0), 0) / slots.length)
          : null,
      rainProbability: daily?.precipitation_probability_max?.[index] ?? null,
      precipitationMm: daily?.precipitation_sum?.[index] ?? null,
      icon: meta.icon,
      animatedIcon: meta.animatedIcon,
      condition: meta.condition,
      sunrise: toTimestamp(daily?.sunrise?.[index]),
      sunset: toTimestamp(daily?.sunset?.[index])
    }
  })
}

function mapWeather(payload, locale, t) {
  const hourlyEntries = mapForecastTimeline(payload?.hourly, locale, t)
  const forecastDays = mapForecastDays(payload?.daily, hourlyEntries, locale, t)
  const current = payload?.current ?? {}
  const currentTime = toTimestamp(current.time) ?? Date.now()
  const currentDayKey = toDateKey(new Date(currentTime))
  const currentDay = forecastDays.find((entry) => entry.key === currentDayKey) ?? forecastDays[0] ?? null
  const nearestHourly =
    hourlyEntries.reduce((closest, entry) => {
      if (!closest) {
        return entry
      }

      return Math.abs(entry.time - currentTime) < Math.abs(closest.time - currentTime) ? entry : closest
    }, null)
  const meta = getWeatherCodeMeta(current.weather_code, current.is_day === 1, locale, t)

  return {
    city: localizeText(DESTINATION.city, locale),
    condition: meta.condition,
    temp: current.temperature_2m ?? null,
    minTemp: currentDay?.minTemp ?? null,
    maxTemp: currentDay?.maxTemp ?? null,
    feelsLike: current.apparent_temperature ?? null,
    humidity: current.relative_humidity_2m ?? null,
    windKmh: current.wind_speed_10m ?? null,
    visibilityKm: nearestHourly?.visibilityKm ?? null,
    pressure: current.pressure_msl ?? null,
    cloudCover: current.cloud_cover ?? null,
    rainProbability: nearestHourly?.rainProbability ?? currentDay?.rainProbability ?? null,
    precipitationMm: current.precipitation ?? null,
    currentTime,
    sunrise: currentDay?.sunrise ?? null,
    sunset: currentDay?.sunset ?? null,
    icon: meta.icon,
    animatedIcon: meta.animatedIcon,
    forecastDays,
    forecastTimeline: hourlyEntries
  }
}

function formatSelectedDate(date, locale) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: DESTINATION.timezone
  }).format(date)
}

function getCache(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setCache(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    return null
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

function localizeText(value, locale) {
  if (typeof value === 'string') {
    return value
  }

  return value?.[locale] ?? value?.fr ?? ''
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function localizeUsefulLink(entry, locale) {
  return {
    ...entry,
    title: localizeText(entry.title, locale),
    description: localizeText(entry.description, locale),
    tag: localizeText(entry.tag, locale),
    sourceLabel: getHostname(entry.url)
  }
}

export function useDestinationData(locale, t) {
  const weather = ref(null)
  const weatherError = ref('')
  const weatherLoading = ref(true)
  const seaTemperatureDays = ref([])
  const currentSeaTemperature = ref(null)
  const seaTemperatureError = ref('')

  const tideSeries = ref([])
  const currentTideSeries = ref([])
  const tideExtrema = ref([])
  const currentTideExtrema = ref([])
  const tideDayGroups = ref([])
  const tideListLoadingPast = ref(false)
  const tideListLoadingFuture = ref(false)
  const tideListStartKey = ref(null)
  const tideListEndKey = ref(null)
  const tideError = ref('')
  const tideLoading = ref(true)
  const tideSource = ref('none')
  const tideSite = ref(FALLBACK_TIDE_SITE)

  const today = new Date()
  const now = ref(new Date())
  let tideClockTimer = null
  const selectedDateInput = ref(toDateKey(today))

  const selectedDate = computed(() => {
    const parsed = parseDateKey(selectedDateInput.value)
    if (!parsed) {
      return new Date(today)
    }

    return parsed
  })

  const selectedDateKey = computed(() => toDateKey(selectedDate.value))
  const currentDateKey = toDateKey(today)
  const tideListMinKey = addDaysToKey(currentDateKey, -30)
  const tideListMaxKey = addDaysToKey(currentDateKey, 30)
  const canLoadPastTideDays = computed(() => !tideListStartKey.value || tideListStartKey.value > tideListMinKey)
  const canLoadFutureTideDays = computed(() => !tideListEndKey.value || tideListEndKey.value < tideListMaxKey)
  const selectedLabel = computed(() => formatSelectedDate(selectedDate.value, locale.value))
  const isSelectedToday = computed(() => selectedDateKey.value === toDateKey(today))
  const currentWeather = computed(() => weather.value)
  const selectedDateOptions = computed(() =>
    (weather.value?.forecastDays ?? []).map((entry) => ({
      key: entry.key,
      label: entry.key === currentDateKey ? t('todayShort') : entry.shortLabel,
      fullLabel: entry.label
    }))
  )

  const selectedWeather = computed(() => {
    if (!weather.value) {
      return null
    }

    if (selectedDateKey.value === toDateKey(today)) {
      return weather.value
    }

    const forecastDay = weather.value.forecastDays.find((entry) => entry.key === selectedDateKey.value)
    if (!forecastDay) {
      return null
    }

    return {
      ...weather.value,
      temp: forecastDay.temp,
      minTemp: forecastDay.minTemp,
      maxTemp: forecastDay.maxTemp,
      feelsLike: forecastDay.feelsLike,
      humidity: forecastDay.humidity,
      windKmh: forecastDay.windKmh,
      visibilityKm: forecastDay.visibilityKm,
      pressure: forecastDay.pressure,
      cloudCover: forecastDay.cloudCover,
      rainProbability: forecastDay.rainProbability,
      precipitationMm: forecastDay.precipitationMm,
      condition: forecastDay.condition,
      icon: forecastDay.icon,
      animatedIcon: forecastDay.animatedIcon,
      currentTime: null,
      sunrise: forecastDay.sunrise,
      sunset: forecastDay.sunset
    }
  })

  const nowEquivalent = computed(() => {
    const date = selectedDate.value
    const liveNow = now.value
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      liveNow.getHours(),
      liveNow.getMinutes(),
      0,
      0
    )
  })

  const currentNow = computed(() => now.value)

  const selectedTideCurrent = computed(() => {
    const height = interpolateHeightAt(tideSeries.value, nowEquivalent.value)
    if (height !== null) {
      return {
        time: nowEquivalent.value.toISOString(),
        height
      }
    }

    return findNearest(tideSeries.value, nowEquivalent.value)
  })
  const currentTideCurrent = computed(() => {
    const height = interpolateHeightAt(currentTideSeries.value, currentNow.value)
    if (height !== null) {
      return {
        time: currentNow.value.toISOString(),
        height
      }
    }

    return findNearest(currentTideSeries.value, currentNow.value)
  })
  const currentTideCoefficient = computed(() => {
    const highTides = currentTideExtrema.value.filter((entry) => entry.kind === 'high' && entry.coef !== null)
    if (!highTides.length) return null
    return highTides.reduce((nearest, highTide) =>
      Math.abs(new Date(highTide.time) - currentNow.value) < Math.abs(new Date(nearest.time) - currentNow.value)
        ? highTide
        : nearest
    ).coef
  })
  const tideEvents = computed(() =>
    tideExtrema.value.length
      ? tideExtrema.value.filter((entry) => entry.time.startsWith(selectedDateKey.value))
      : dedupeTurningPoints(getTurningPoints(tideSeries.value))
  )
  const currentTideEvents = computed(() =>
    currentTideExtrema.value.length
      ? currentTideExtrema.value
      : dedupeTurningPoints(getTurningPoints(currentTideSeries.value))
  )
  const currentUpcomingTides = computed(() =>
    currentTideEvents.value
      .filter((entry) => new Date(entry.time) >= currentNow.value)
      .slice(0, 2)
  )
  const tideTurns = computed(() => tideEvents.value)
  const tideClock = computed(() =>
    getTideClockState(tideSeries.value, tideEvents.value, nowEquivalent.value, isSelectedToday.value)
  )
  const currentTideClock = computed(() =>
    getTideClockState(currentTideSeries.value, currentTideEvents.value, currentNow.value, true)
  )
  const waterRatio = computed(() => {
    const height = tideClock.value.currentHeight ?? selectedTideCurrent.value?.height ?? 0
    return Math.min(1, Math.max(0, height / MAX_WATER_HEIGHT))
  })
  const currentWaterRatio = computed(() => {
    const height = currentTideClock.value.currentHeight ?? currentTideCurrent.value?.height ?? 0
    return Math.min(1, Math.max(0, height / MAX_WATER_HEIGHT))
  })

  const tideGraph = computed(() => {
    if (!tideSeries.value.length) {
      return ''
    }

    const min = Math.min(...tideSeries.value.map((item) => item.height))
    const max = Math.max(...tideSeries.value.map((item) => item.height))
    const spread = Math.max(max - min, 1)

    return tideSeries.value
      .map((entry, index) => {
        const x = (index / (tideSeries.value.length - 1)) * 100
        const y = 100 - ((entry.height - min) / spread) * 100
        return `${x},${y}`
      })
      .join(' ')
  })

  const tideNowMarker = computed(() => {
    if (!isSelectedToday.value || !tideSeries.value.length) {
      return null
    }

    const min = Math.min(...tideSeries.value.map((item) => item.height))
    const max = Math.max(...tideSeries.value.map((item) => item.height))
    const spread = Math.max(max - min, 1)
    const targetTime = nowEquivalent.value.getTime()

    for (let index = 0; index < tideSeries.value.length - 1; index += 1) {
      const startTime = new Date(tideSeries.value[index].time).getTime()
      const endTime = new Date(tideSeries.value[index + 1].time).getTime()

      if (targetTime >= startTime && targetTime <= endTime) {
        const progress = endTime === startTime ? 0 : (targetTime - startTime) / (endTime - startTime)
        const height =
          tideSeries.value[index].height +
          (tideSeries.value[index + 1].height - tideSeries.value[index].height) * progress

        const x = ((index + progress) / (tideSeries.value.length - 1)) * 100
        const y = 100 - ((height - min) / spread) * 100
        return { x, y, height, time: new Date(targetTime).toISOString() }
      }
    }

    return null
  })

  const usefulLinks = computed(() =>
    usefulLinksData.map((entry) => localizeUsefulLink(entry, locale.value))
  )

  const selectedWeatherTimeline = computed(() => {
    if (!weather.value) {
      return []
    }

    const slots = (weather.value.forecastTimeline ?? []).filter(
      (entry) => entry.dayKey === selectedDateKey.value
    )

    if (!isSelectedToday.value) {
      return slots
    }

    const currentSlot = {
      dayKey: selectedDateKey.value,
      time: weather.value.currentTime ?? Date.now(),
      label: t('nowShort'),
      temp: weather.value.temp,
      feelsLike: weather.value.feelsLike,
      humidity: weather.value.humidity,
      windKmh: weather.value.windKmh,
      visibilityKm: weather.value.visibilityKm,
      pressure: weather.value.pressure,
      cloudCover: weather.value.cloudCover,
      rainProbability: weather.value.rainProbability,
      precipitationMm: weather.value.precipitationMm,
      icon: weather.value.icon,
      animatedIcon: weather.value.animatedIcon,
      condition: weather.value.condition,
      isCurrent: true
    }

    if (!slots.length) {
      return [currentSlot]
    }

    const nearestSlotIndex = slots.reduce((closestIndex, entry, index) => {
      if (closestIndex === -1) {
        return index
      }

      return Math.abs(entry.time - currentSlot.time) < Math.abs(slots[closestIndex].time - currentSlot.time)
        ? index
        : closestIndex
    }, -1)

    const hasNearbyForecast = slots.some(
      (entry) => Math.abs(entry.time - currentSlot.time) <= 90 * 60 * 1000
    )

    if (!hasNearbyForecast) {
      return [currentSlot, ...slots.map((entry) => ({ ...entry, isCurrent: false }))]
    }

    return slots.map((entry, index) => ({
      ...entry,
      isCurrent: index === nearestSlotIndex
    }))
  })

  const getTideApiKey = () => import.meta.env.VITE_API_MAREE_KEY

  async function fetchTideDayGroups(fromKey, toKey) {
    const key = getTideApiKey()
    if (!key) return []
    const coefficientLookahead = toKey < tideListMaxKey ? addDaysToKey(toKey, 1) : toKey
    const payload = await fetchJson(
      `https://api-maree.fr/tide-extrema?site=${tideSite.value.site_id}&from=${fromKey}&to=${coefficientLookahead}&tz=${DESTINATION.timezone}&key=${encodeURIComponent(key)}`
    )
    const events = mapTideExtrema(payload, fromKey)
    const groups = new Map()
    for (const event of events) {
      const dayKey = event.time.slice(0, 10)
      if (dayKey < fromKey || dayKey > toKey) continue
      const dayEvents = groups.get(dayKey) ?? []
      dayEvents.push(event)
      groups.set(dayKey, dayEvents)
    }
    return Array.from(groups, ([key, events]) => ({
      key,
      label: formatSelectedDate(parseDateKey(key), locale.value),
      isToday: key === currentDateKey,
      events
    })).sort((a, b) => a.key.localeCompare(b.key))
  }

  function mergeTideDayGroups(groups) {
    const merged = new Map(tideDayGroups.value.map((group) => [group.key, group]))
    for (const group of groups) merged.set(group.key, group)
    tideDayGroups.value = Array.from(merged.values()).sort((a, b) => a.key.localeCompare(b.key))
  }

  async function initializeTideDayGroups() {
    if (tideDayGroups.value.length) return
    tideListLoadingPast.value = true
    tideListLoadingFuture.value = true
    try {
      const fromKey = addDaysToKey(currentDateKey, -2)
      const toKey = addDaysToKey(currentDateKey, 2)
      mergeTideDayGroups(await fetchTideDayGroups(fromKey, toKey))
      tideListStartKey.value = fromKey
      tideListEndKey.value = toKey
    } catch (error) {
      tideError.value = `${t('tideFetchError')} ${error.message}`
    } finally {
      tideListLoadingPast.value = false
      tideListLoadingFuture.value = false
    }
  }

  async function loadMoreTideDays(direction) {
    await initializeTideDayGroups()
    if (direction === 'past') {
      if (tideListLoadingPast.value || tideListStartKey.value <= tideListMinKey) return
      tideListLoadingPast.value = true
      try {
        const toKey = addDaysToKey(tideListStartKey.value, -1)
        const fromKey = [addDaysToKey(toKey, -4), tideListMinKey].sort().at(-1)
        mergeTideDayGroups(await fetchTideDayGroups(fromKey, toKey))
        tideListStartKey.value = fromKey
      } catch (error) {
        tideError.value = `${t('tideFetchError')} ${error.message}`
      } finally { tideListLoadingPast.value = false }
      return
    }
    if (tideListLoadingFuture.value || tideListEndKey.value >= tideListMaxKey) return
    tideListLoadingFuture.value = true
    try {
      const fromKey = addDaysToKey(tideListEndKey.value, 1)
      const toKey = [addDaysToKey(fromKey, 4), tideListMaxKey].sort().at(0)
      mergeTideDayGroups(await fetchTideDayGroups(fromKey, toKey))
      tideListEndKey.value = toKey
    } catch (error) {
      tideError.value = `${t('tideFetchError')} ${error.message}`
    } finally { tideListLoadingFuture.value = false }
  }

  async function fetchTideSeriesForDate(targetDate, targetKey) {
    const key = getTideApiKey()
    const cacheKey = `coastal-companion-tides-${targetKey}`

    if (!key) {
      return {
        series: [],
        source: 'none',
        error: t('tideApiKeyMissing')
      }
    }

    try {
      const from = getIsoAtLocalTime(targetDate, 0, 0)
      const to = getIsoAtLocalTime(targetDate, 23, 59)
      const previousDate = new Date(targetDate)
      previousDate.setDate(previousDate.getDate() - 1)
      const extremaFrom = toDateKey(previousDate)
      const nextDate = new Date(targetDate)
      nextDate.setDate(nextDate.getDate() + 1)
      const extremaTo = toDateKey(nextDate)
      const [payload, extremaPayload] = await Promise.all([
        fetchJson(`https://api-maree.fr/water-levels?site=${tideSite.value.site_id}&from=${from}&to=${to}&step=${DESTINATION.tide.stepMinutes}&tz=${DESTINATION.timezone}&key=${encodeURIComponent(key)}`),
        fetchJson(`https://api-maree.fr/tide-extrema?site=${tideSite.value.site_id}&from=${extremaFrom}&to=${extremaTo}&tz=${DESTINATION.timezone}&key=${encodeURIComponent(key)}`)
      ])

      const series = payload.data ?? []
      const extrema = mapTideExtrema(extremaPayload, targetKey)
      setCache(cacheKey, {
        site: tideSite.value,
        series,
        extrema
      })

      return {
        series,
        source: 'api',
        extrema,
        error: ''
      }
    } catch (error) {
      const cached = getCache(cacheKey)
      if (cached?.series?.length) {
        tideSite.value = cached.site ?? tideSite.value
        return {
          series: cached.series,
          source: 'cache',
          extrema: cached.extrema ?? [],
          error: t('cachedTides')
        }
      }

      return {
        series: [],
        source: 'none',
        extrema: [],
        error: `${t('tideFetchError')} ${error.message}`
      }
    }
  }

  async function loadSeaTemperature() {
    seaTemperatureError.value = ''
    const cacheKey = 'coastal-companion-sea-temperature'

    try {
      const payload = await fetchJson(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${DESTINATION.coordinates.lat}&longitude=${DESTINATION.coordinates.lon}&current=sea_surface_temperature&hourly=sea_surface_temperature&timezone=${encodeURIComponent(DESTINATION.timezone)}&forecast_days=${DESTINATION.weather.seaForecastDays}&cell_selection=sea`
      )

      currentSeaTemperature.value =
        payload.current?.sea_surface_temperature ?? payload.current_weather?.sea_surface_temperature ?? null
      seaTemperatureDays.value = mapSeaTemperatureDays(payload.hourly)

      setCache(cacheKey, {
        current: currentSeaTemperature.value,
        days: seaTemperatureDays.value
      })
    } catch (error) {
      const cached = getCache(cacheKey)
      if (cached) {
        currentSeaTemperature.value = cached.current ?? null
        seaTemperatureDays.value = cached.days ?? []
        seaTemperatureError.value = t('cachedSeaTemperature')
      } else {
        currentSeaTemperature.value = null
        seaTemperatureDays.value = []
        seaTemperatureError.value = `${t('seaTemperatureError')} ${error.message}`
      }
    }
  }

  async function loadWeather() {
    weatherLoading.value = true
    weatherError.value = ''

    const cacheKey = `coastal-companion-weather-${locale.value}`

    try {
      const payload = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${DESTINATION.coordinates.lat}&longitude=${DESTINATION.coordinates.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,pressure_msl,cloud_cover,wind_speed_10m&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,pressure_msl,cloud_cover,visibility,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=${encodeURIComponent(DESTINATION.timezone)}&forecast_days=${DESTINATION.weather.forecastDays}`
      )

      weather.value = mapWeather(payload, locale.value, t)
      setCache(cacheKey, weather.value)
    } catch (error) {
      const cached = getCache(cacheKey)
      if (cached) {
        weather.value = cached
        weatherError.value = ''
      } else {
        weatherError.value = `${t('weatherFetchError')} ${error.message}`
      }
    } finally {
      weatherLoading.value = false
    }
  }

  async function resolveTideSite() {
    try {
      const key = getTideApiKey()
      const payload = await fetchJson(`https://api-maree.fr/sites?key=${encodeURIComponent(key)}`)
      const nearest = payload.sites.reduce((best, site) => {
        const distance =
          Math.abs(site.latitude - DESTINATION.coordinates.lat) + Math.abs(site.longitude - DESTINATION.coordinates.lon)
        if (!best || distance < best.distance) {
          return {
            distance,
            site
          }
        }

        return best
      }, null)

      tideSite.value = nearest?.site ?? FALLBACK_TIDE_SITE
    } catch {
      tideSite.value = FALLBACK_TIDE_SITE
    }
  }

  async function loadTides() {
    tideLoading.value = true
    tideError.value = ''
    const result = await fetchTideSeriesForDate(selectedDate.value, selectedDateKey.value)
    tideSeries.value = result.series
    tideExtrema.value = result.extrema ?? []
    tideSource.value = result.source
    tideError.value = result.error

    if (isSelectedToday.value) {
      currentTideSeries.value = result.series
      currentTideExtrema.value = result.extrema ?? []
    } else if (!currentTideSeries.value.length) {
      await loadCurrentTides()
    }

    tideLoading.value = false
  }

  async function loadCurrentTides() {
    const result = await fetchTideSeriesForDate(today, currentDateKey)
    currentTideSeries.value = result.series
    currentTideExtrema.value = result.extrema ?? []
  }

  onMounted(async () => {
    tideClockTimer = window.setInterval(() => { now.value = new Date() }, 1_000)
    await resolveTideSite()
    await Promise.all([loadWeather(), loadSeaTemperature(), loadTides()])
    await initializeTideDayGroups()
    if (!currentTideSeries.value.length) {
      await loadCurrentTides()
    }
  })

  onBeforeUnmount(() => {
    if (tideClockTimer) window.clearInterval(tideClockTimer)
  })

  watch(selectedDateKey, () => {
    if (selectedDateInput.value !== selectedDateKey.value) {
      selectedDateInput.value = selectedDateKey.value
    }
    loadTides()
  })

  watch(locale, () => {
    loadWeather()
  })

  return {
    currentSeaTemperature,
    currentTideClock,
    currentTideCurrent,
    currentTideCoefficient,
    currentUpcomingTides,
    currentWaterRatio,
    currentWeather,
    selectedDate,
    selectedDateInput,
    selectedDateOptions,
    selectedLabel,
    selectedWeather,
    selectedWeatherTimeline,
    seaTemperatureError,
    tideClock,
    tideCurrent: selectedTideCurrent,
    tideEvents,
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
    tideSite,
    tideSource,
    tideTurns,
    usefulLinks,
    waterRatio,
    weather,
    weatherError,
    weatherLoading,
    helpers: {
      toHourMinute: (value) => toHourMinute(value, locale.value)
    }
  }
}
