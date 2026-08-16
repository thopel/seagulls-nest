import { computed, reactive, ref } from 'vue'
import defaultConfig from '../data/destination.json'
import defaultLinks from '../data/useful-links.json'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const pathParts = window.location.pathname.split('/').filter(Boolean)
function normalizePathSlug(value) {
  let decoded = value || ''
  try { decoded = decodeURIComponent(decoded) } catch { /* Conserver la valeur si l'encodage est invalide. */ }
  return decoded.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
export const isAdminRoute = ref(pathParts.at(-1) === 'admin')
export const isDisclaimerRoute = ref(pathParts.at(-1) === 'responsabilite-donnees')
const rawStaySlug = (isAdminRoute.value || isDisclaimerRoute.value) ? pathParts.at(-2) : pathParts.at(-1)
export const staySlug = ref(normalizePathSlug(rawStaySlug) || 'le-nid-des-mouettes')
export const stayLoading = ref(true)
export const stayError = ref('')
export const session = ref(null)

export const stay = reactive({
  id: null,
  slug: staySlug.value,
  name: defaultConfig.app.name.fr,
  city: defaultConfig.destination.city.fr,
  region: defaultConfig.destination.region.fr,
  latitude: defaultConfig.destination.coordinates.lat,
  longitude: defaultConfig.destination.coordinates.lon,
  timezone: defaultConfig.destination.timezone,
  tide_site_id: defaultConfig.destination.tide.fallbackSite.site_id,
  tide_site_name: defaultConfig.destination.tide.fallbackSite.name,
  floating_image_url: '/assets/seegulls-nest-awake.png',
  floating_image_asleep_url: '/assets/seegulls-nest-asleep.png',
  hidden_sections: [],
  parking_geojson: null,
  useful_links: defaultLinks
})

export const isAuthenticated = computed(() => Boolean(session.value))
export const sectionVisible = (key) => !stay.hidden_sections?.includes(key)

function applyStay(row) {
  if (!row) return
  Object.assign(stay, row)
  defaultConfig.app.name.fr = row.name || defaultConfig.app.name.fr
  defaultConfig.app.name.en = row.name || defaultConfig.app.name.en
  defaultConfig.destination.city.fr = row.city || defaultConfig.destination.city.fr
  defaultConfig.destination.city.en = row.city || defaultConfig.destination.city.en
  defaultConfig.destination.region.fr = row.region || defaultConfig.destination.region.fr
  defaultConfig.destination.region.en = row.region || defaultConfig.destination.region.en
  defaultConfig.destination.coordinates.lat = Number(row.latitude ?? defaultConfig.destination.coordinates.lat)
  defaultConfig.destination.coordinates.lon = Number(row.longitude ?? defaultConfig.destination.coordinates.lon)
  defaultConfig.destination.timezone = row.timezone || defaultConfig.destination.timezone
  defaultConfig.destination.tide.fallbackSite = {
    site_id: row.tide_site_id || defaultConfig.destination.tide.fallbackSite.site_id,
    name: row.tide_site_name || defaultConfig.destination.tide.fallbackSite.name
  }
}

export async function loadStay() {
  stayLoading.value = true
  stayError.value = ''
  if (!isSupabaseConfigured) {
    stayLoading.value = false
    return
  }

  const { data, error } = await supabase.from('stays').select('*').eq('slug', staySlug.value).maybeSingle()
  if (error) stayError.value = 'Impossible de charger ce logement.'
  else if (!data) stayError.value = 'Ce logement est introuvable.'
  else applyStay(data)
  const { data: authData } = await supabase.auth.getSession()
  session.value = authData.session
  supabase.auth.onAuthStateChange((_event, nextSession) => { session.value = nextSession })
  stayLoading.value = false
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase n’est pas encore configuré.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
}

export async function saveStay(changes) {
  if (!supabase) throw new Error('Supabase n’est pas encore configuré.')
  let stayId = stay.id
  if (!stayId) {
    const { data: existingStay, error: lookupError } = await supabase
      .from('stays')
      .select('*')
      .eq('slug', staySlug.value)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!existingStay) throw new Error(`Aucun logement ne correspond à l’URL « ${staySlug.value} ».`)
    applyStay(existingStay)
    stayId = existingStay.id
  }
  const { data, error } = await supabase.from('stays').update(changes).eq('id', stayId).select().single()
  if (error) throw error
  applyStay(data)
  return data
}

export function useStay() {
  return { stay, staySlug, stayLoading, stayError, session, isAdminRoute, isDisclaimerRoute, isAuthenticated, sectionVisible, signIn, signOut, saveStay }
}
