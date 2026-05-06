import { computed, onMounted, ref, watch } from 'vue'
import events from '../data/events.json'

const DINARD = {
  name: 'Dinard',
  lat: 48.6329,
  lon: -2.0625,
  timezone: 'Europe/Paris'
}

const MAX_WATER_HEIGHT = 16
const PUBLIC_TIDE_EXAMPLE_KEY = '24df43ed9155cae245fa8fa8ca93bb7d'
const FALLBACK_TIDE_SITE = {
  site_id: 'saint-malo',
  name: 'Saint-Malo'
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
    timeZone: DINARD.timezone,
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
    timeZone: DINARD.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale === 'en'
  }).format(value)
}

function getLocalHour(value) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: DINARD.timezone,
      hour: '2-digit',
      hour12: false
    }).format(value)
  )
}

function getIsoAtLocalTime(date, hour, minute) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DINARD.timezone,
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

function mapWeather(current, forecast, locale, t) {
  const description = current.weather?.[0]?.description ?? t('changingSky')
  const condition = description.charAt(0).toUpperCase() + description.slice(1)
  const visibilityKm = current.visibility ? Number((current.visibility / 1000).toFixed(1)) : null
  const windKmh = current.wind?.speed ? Math.round(current.wind.speed * 3.6) : 0

  return {
    city: current.name ?? DINARD.name,
    condition,
    temp: Math.round(current.main?.temp ?? 0),
    minTemp: Math.round(current.main?.temp_min ?? current.main?.temp ?? 0),
    maxTemp: Math.round(current.main?.temp_max ?? current.main?.temp ?? 0),
    feelsLike: Math.round(current.main?.feels_like ?? 0),
    humidity: current.main?.humidity ?? 0,
    windKmh,
    visibilityKm,
    pressure: current.main?.pressure ?? null,
    cloudCover: current.clouds?.all ?? null,
    rainProbability: null,
    precipitationMm: Number(
      (current.rain?.['1h'] ?? current.rain?.['3h'] ?? current.snow?.['1h'] ?? current.snow?.['3h'] ?? 0)
    ),
    currentTime: current.dt ? current.dt * 1000 : Date.now(),
    sunrise: current.sys?.sunrise ? current.sys.sunrise * 1000 : null,
    sunset: current.sys?.sunset ? current.sys.sunset * 1000 : null,
    icon: current.weather?.[0]?.icon ?? null,
    forecastDays: mapForecastDays(forecast?.list ?? [], locale, t),
    forecastTimeline: mapForecastTimeline(forecast?.list ?? [], locale, t)
  }
}

function mapForecastDays(list, locale, t) {
  const buckets = new Map()

  for (const item of list) {
    const date = new Date(item.dt * 1000)
    const key = toDateKey(date)
    const existing = buckets.get(key) ?? []
    existing.push(item)
    buckets.set(key, existing)
  }

  return Array.from(buckets.entries())
    .slice(0, 6)
    .map(([key, items]) => {
      const midday =
        items.find((item) => getLocalHour(new Date(item.dt * 1000)) >= 12) ??
        items[Math.floor(items.length / 2)]
      const minTemp = Math.round(Math.min(...items.map((item) => item.main.temp_min)))
      const maxTemp = Math.round(Math.max(...items.map((item) => item.main.temp_max)))
      const humidity = Math.round(
        items.reduce((total, item) => total + (item.main?.humidity ?? 0), 0) / items.length
      )
      const windKmh = Math.round(
        Math.max(...items.map((item) => (item.wind?.speed ?? 0) * 3.6))
      )
      const cloudCover = Math.round(
        items.reduce((total, item) => total + (item.clouds?.all ?? 0), 0) / items.length
      )
      const rainProbability = Math.round(
        Math.max(...items.map((item) => (item.pop ?? 0) * 100))
      )
      const precipitationMm = Number(
        items
          .reduce((total, item) => total + (item.rain?.['3h'] ?? item.snow?.['3h'] ?? 0), 0)
          .toFixed(1)
      )
      const visibilityKm = midday.visibility
        ? Number((midday.visibility / 1000).toFixed(1))
        : null

      return {
        key,
        date: new Date(midday.dt * 1000),
        label: new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: DINARD.timezone
        }).format(new Date(midday.dt * 1000)),
        temp: Math.round(midday.main?.temp ?? 0),
        minTemp,
        maxTemp,
        feelsLike: Math.round(midday.main?.feels_like ?? midday.main?.temp ?? 0),
        humidity,
        windKmh,
        visibilityKm,
        pressure: midday.main?.pressure ?? null,
        cloudCover,
        rainProbability,
        precipitationMm,
        icon: midday.weather?.[0]?.icon ?? null,
        condition: midday.weather?.[0]?.description ?? t('variable')
      }
    })
}

function mapForecastTimeline(list, locale, t) {
  return list.map((item) => {
    const date = new Date(item.dt * 1000)

    return {
      dayKey: toDateKey(date),
      time: item.dt * 1000,
      label: new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: DINARD.timezone,
        hour12: locale === 'en'
      }).format(date),
      temp: Math.round(item.main?.temp ?? 0),
      feelsLike: Math.round(item.main?.feels_like ?? item.main?.temp ?? 0),
      humidity: item.main?.humidity ?? null,
      windKmh: Math.round((item.wind?.speed ?? 0) * 3.6),
      visibilityKm: item.visibility ? Number((item.visibility / 1000).toFixed(1)) : null,
      pressure: item.main?.pressure ?? null,
      cloudCover: item.clouds?.all ?? null,
      rainProbability: Math.round((item.pop ?? 0) * 100),
      precipitationMm: Number((item.rain?.['3h'] ?? item.snow?.['3h'] ?? 0).toFixed(1)),
      icon: item.weather?.[0]?.icon ?? null,
      condition: item.weather?.[0]?.description ?? t('variable')
    }
  })
}

function formatSelectedDate(date, locale) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: DINARD.timezone
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

function localizeEvent(entry, locale) {
  return {
    ...entry,
    title: entry.title?.[locale] ?? entry.title?.fr ?? '',
    description: entry.description?.[locale] ?? entry.description?.fr ?? '',
    location: entry.location?.[locale] ?? entry.location?.fr ?? ''
  }
}

export function useDinardData(locale, t) {
  const weather = ref(null)
  const weatherError = ref('')
  const weatherLoading = ref(true)
  const seaTemperatureDays = ref([])
  const currentSeaTemperature = ref(null)
  const seaTemperatureError = ref('')

  const tideSeries = ref([])
  const currentTideSeries = ref([])
  const tideError = ref('')
  const tideLoading = ref(true)
  const tideSource = ref('none')
  const tideSite = ref(FALLBACK_TIDE_SITE)

  const today = new Date()
  const minSelectableDate = new Date(today)
  minSelectableDate.setHours(12, 0, 0, 0)
  const maxSelectableDate = new Date(today)
  maxSelectableDate.setDate(maxSelectableDate.getDate() + 5)
  maxSelectableDate.setHours(12, 0, 0, 0)
  const selectedDateInput = ref(toDateKey(today))

  const selectedDate = computed(() => {
    const parsed = parseDateKey(selectedDateInput.value)
    if (!parsed) {
      return new Date(today)
    }

    if (parsed < minSelectableDate) {
      return new Date(minSelectableDate)
    }

    if (parsed > maxSelectableDate) {
      return new Date(maxSelectableDate)
    }

    return parsed
  })

  const selectedDateKey = computed(() => toDateKey(selectedDate.value))
  const currentDateKey = toDateKey(today)
  const currentLabel = computed(() => formatSelectedDate(today, locale.value))
  const selectedLabel = computed(() => formatSelectedDate(selectedDate.value, locale.value))
  const isSelectedToday = computed(() => selectedDateKey.value === toDateKey(today))
  const currentWeather = computed(() => weather.value)

  const selectedWeather = computed(() => {
    if (!weather.value) {
      return null
    }

    if (selectedDateKey.value === toDateKey(today)) {
      return weather.value
    }

    const forecastDay = weather.value.forecastDays.find((entry) => entry.key === selectedDateKey.value)
    if (!forecastDay) {
      return weather.value
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
      currentTime: null,
      sunrise: null,
      sunset: null
    }
  })

  const selectedSeaTemperature = computed(() => {
    if (isSelectedToday.value && currentSeaTemperature.value !== null) {
      return currentSeaTemperature.value
    }

    return (
      seaTemperatureDays.value.find((entry) => entry.key === selectedDateKey.value)?.value ?? null
    )
  })

  const nowEquivalent = computed(() => {
    const date = selectedDate.value
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      today.getHours(),
      today.getMinutes(),
      0,
      0
    )
  })

  const currentNow = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    today.getHours(),
    today.getMinutes(),
    0,
    0
  )

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
    const height = interpolateHeightAt(currentTideSeries.value, currentNow)
    if (height !== null) {
      return {
        time: currentNow.toISOString(),
        height
      }
    }

    return findNearest(currentTideSeries.value, currentNow)
  })
  const tideEvents = computed(() => dedupeTurningPoints(getTurningPoints(tideSeries.value)))
  const currentTideEvents = computed(() => dedupeTurningPoints(getTurningPoints(currentTideSeries.value)))
  const tideTurns = computed(() => tideEvents.value)
  const tideClock = computed(() =>
    getTideClockState(tideSeries.value, tideEvents.value, nowEquivalent.value, isSelectedToday.value)
  )
  const currentTideClock = computed(() =>
    getTideClockState(currentTideSeries.value, currentTideEvents.value, currentNow, true)
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

  const eventsForDay = computed(() =>
    events
      .filter((entry) => {
        const startKey = toDateKey(new Date(entry.start))
        const endKey = toDateKey(new Date(entry.end))
        return startKey <= selectedDateKey.value && endKey >= selectedDateKey.value
      })
      .map((entry) => localizeEvent(entry, locale.value))
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
      condition: weather.value.condition,
      isCurrent: true
    }

    const hasNearbyForecast = slots.some(
      (entry) => Math.abs(entry.time - currentSlot.time) <= 90 * 60 * 1000
    )

    return hasNearbyForecast ? slots : [currentSlot, ...slots]
  })

  const dateMin = computed(() => toDateKey(minSelectableDate))
  const dateMax = computed(() => toDateKey(maxSelectableDate))

  const getTideApiKey = () => import.meta.env.VITE_API_MAREE_KEY || PUBLIC_TIDE_EXAMPLE_KEY

  async function fetchTideSeriesForDate(targetDate, targetKey) {
    const envKey = import.meta.env.VITE_API_MAREE_KEY
    const key = getTideApiKey()
    const cacheKey = `le-nid-tides-${targetKey}`

    if (!key) {
      return {
        series: [],
        source: 'none',
        error: t('addTideKey')
      }
    }

    try {
      const from = getIsoAtLocalTime(targetDate, 0, 0)
      const to = getIsoAtLocalTime(targetDate, 23, 59)
      const payload = await fetchJson(
        `https://api-maree.fr/water-levels?site=${tideSite.value.site_id}&from=${from}&to=${to}&step=10&tz=${DINARD.timezone}&key=${encodeURIComponent(key)}`
      )

      const series = payload.data ?? []
      setCache(cacheKey, {
        site: tideSite.value,
        series
      })

      return {
        series,
        source: envKey ? 'api' : 'example',
        error: ''
      }
    } catch (error) {
      const cached = getCache(cacheKey)
      if (cached?.series?.length) {
        tideSite.value = cached.site ?? tideSite.value
        return {
          series: cached.series,
          source: 'cache',
          error: t('cachedTides')
        }
      }

      return {
        series: [],
        source: 'none',
        error: `${t('tideFetchError')} ${error.message}`
      }
    }
  }

  async function loadSeaTemperature() {
    seaTemperatureError.value = ''
    const cacheKey = 'le-nid-sea-temperature'

    try {
      const payload = await fetchJson(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${DINARD.lat}&longitude=${DINARD.lon}&current=sea_surface_temperature&hourly=sea_surface_temperature&timezone=${encodeURIComponent(DINARD.timezone)}&forecast_days=6&cell_selection=sea`
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

    const apiKey = import.meta.env.VITE_API_OPENWEATHER_KEY
    if (!apiKey) {
      weatherError.value = t('addWeatherKey')
      weatherLoading.value = false
      return
    }

    const cacheKey = `le-nid-weather-${locale.value}`

    try {
      const [current, forecast] = await Promise.all([
        fetchJson(
          `https://api.openweathermap.org/data/2.5/weather?lat=${DINARD.lat}&lon=${DINARD.lon}&appid=${apiKey}&units=metric&lang=${locale.value}`
        ),
        fetchJson(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${DINARD.lat}&lon=${DINARD.lon}&appid=${apiKey}&units=metric&lang=${locale.value}`
        )
      ])

      weather.value = mapWeather(current, forecast, locale.value, t)
      setCache(cacheKey, weather.value)
    } catch (error) {
      const cached = getCache(cacheKey)
      if (cached) {
        weather.value = cached
        weatherError.value = t('cachedWeather')
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
          Math.abs(site.latitude - DINARD.lat) + Math.abs(site.longitude - DINARD.lon)
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
    tideSource.value = result.source
    tideError.value = result.error

    if (isSelectedToday.value) {
      currentTideSeries.value = result.series
    } else if (!currentTideSeries.value.length) {
      await loadCurrentTides()
    }

    tideLoading.value = false
  }

  async function loadCurrentTides() {
    const result = await fetchTideSeriesForDate(today, currentDateKey)
    currentTideSeries.value = result.series
  }

  onMounted(async () => {
    await resolveTideSite()
    await Promise.all([loadWeather(), loadSeaTemperature(), loadTides()])
    if (!currentTideSeries.value.length) {
      await loadCurrentTides()
    }
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
    dateMax,
    dateMin,
    currentLabel,
    currentSeaTemperature,
    currentTideClock,
    currentTideCurrent,
    currentWaterRatio,
    currentWeather,
    eventsForDay,
    selectedDate,
    selectedDateInput,
    selectedLabel,
    selectedSeaTemperature,
    selectedWeather,
    selectedWeatherTimeline,
    seaTemperatureError,
    tideClock,
    tideCurrent: selectedTideCurrent,
    tideEvents,
    tideError,
    tideGraph,
    tideLoading,
    tideNowMarker,
    tideSeries,
    tideSite,
    tideSource,
    tideTurns,
    waterRatio,
    weather,
    weatherError,
    weatherLoading,
    helpers: {
      toHourMinute: (value) => toHourMinute(value, locale.value)
    }
  }
}
