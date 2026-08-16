<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { saveStay, stay } from '../composables/useStay'
const emit = defineEmits(['close', 'saved'])
const form = reactive({ slug: stay.slug, name: stay.name, city: stay.city, region: stay.region, latitude: stay.latitude, longitude: stay.longitude, timezone: stay.timezone, tide_site_id: stay.tide_site_id, tide_site_name: stay.tide_site_name, floating_image_url: stay.floating_image_url, floating_image_asleep_url: stay.floating_image_asleep_url })
const address = ref(''), pending = ref(false), locating = ref(false), portsLoading = ref(false), error = ref('')
const ports = ref([])
const portSearch = ref(stay.tide_site_name || '')
const editingImage = reactive({ awake: false, asleep: false })
const timezones = (() => { try { return Intl.supportedValuesOf('timeZone') } catch { return ['Europe/Paris', 'Europe/London', 'UTC'] } })()
const slugPreview = computed(() => slugify(form.slug || form.name))
const filteredPorts = computed(() => {
  const query = portSearch.value.trim().toLocaleLowerCase('fr')
  if (!query) return ports.value.slice(0, 30)
  return ports.value.filter((port) => port.name.toLocaleLowerCase('fr').includes(query)).slice(0, 30)
})
function slugify(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function normalizeSlug(event) { form.slug = slugify(event.target.value) }
function selectPort(port) { form.tide_site_id = port.site_id; form.tide_site_name = port.name; portSearch.value = port.name }
async function loadPorts() {
  portsLoading.value = true
  try {
    const response = await fetch('https://api-maree.fr/sites')
    if (!response.ok) throw new Error()
    const payload = await response.json()
    const rawPorts = Array.isArray(payload) ? payload : (payload.sites || payload.data || [])
    ports.value = rawPorts.map((port) => ({ site_id: String(port.site_id || port.id || port.slug || ''), name: port.name || port.label || port.site_name || '' })).filter((port) => port.site_id && port.name)
    if (!ports.value.some((item) => item.site_id === form.tide_site_id)) ports.value.unshift({ site_id: form.tide_site_id, name: form.tide_site_name })
  } catch { ports.value = [{ site_id: form.tide_site_id, name: form.tide_site_name }] }
  finally { portsLoading.value = false }
}
async function locateAddress() {
  if (!address.value.trim()) return
  locating.value = true; error.value = ''
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    Object.entries({ q: address.value.trim(), format: 'jsonv2', addressdetails: '1', limit: '1', 'accept-language': 'fr' }).forEach(([key, value]) => url.searchParams.set(key, value))
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('Service de localisation indisponible.')
    const [place] = await response.json()
    if (!place) throw new Error('Adresse introuvable. Précisez la rue, le code postal et la ville.')
    form.latitude = Number(place.lat).toFixed(6); form.longitude = Number(place.lon).toFixed(6)
    form.city = place.address.city || place.address.town || place.address.village || place.address.municipality || form.city
    form.region = place.address.state || place.address.region || place.address.county || form.region
  } catch (reason) { error.value = reason.message } finally { locating.value = false }
}
async function submit() {
  pending.value = true; error.value = ''
  try {
    form.slug = slugPreview.value
    await saveStay({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) })
    emit('saved', form.slug); emit('close')
  } catch (reason) { error.value = reason.code === '23505' ? 'Cette URL est déjà utilisée.' : reason.message } finally { pending.value = false }
}
onMounted(loadPorts)
</script>
<template>
  <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" @click.self="$emit('close')">
    <form class="admin-sheet" @submit.prevent="submit">
      <header><div><p class="eyebrow">Configuration</p><h2 id="settings-title">Paramètres du logement</h2></div><button type="button" class="admin-round-button" aria-label="Fermer" @click="$emit('close')">×</button></header>
      <p class="admin-help">L’URL, la localisation et l’identifiant technique du port sont générés automatiquement.</p>
      <div class="admin-form-grid">
        <label class="admin-field admin-field-wide"><span>Nom du logement</span><input v-model="form.name" required /></label>
        <label class="admin-field admin-field-wide"><span>URL</span><div class="admin-url-input"><span>/</span><input :value="slugPreview" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" @input="normalizeSlug" /></div></label>
        <div class="admin-field admin-field-wide"><span>Adresse du logement</span><div class="admin-address-row"><input v-model="address" placeholder="12 rue…, 35800 Dinard" @keydown.enter.prevent="locateAddress" /><button type="button" class="admin-secondary" :disabled="locating" @click="locateAddress">{{ locating ? 'Recherche…' : 'Localiser' }}</button></div><small>Recherche et coordonnées © OpenStreetMap contributors.</small></div>
        <label class="admin-field"><span>Ville</span><input v-model="form.city" required /></label>
        <label class="admin-field"><span>Région</span><input v-model="form.region" /></label>
        <label class="admin-field"><span>Latitude</span><input v-model="form.latitude" type="number" step="any" required /></label>
        <label class="admin-field"><span>Longitude</span><input v-model="form.longitude" type="number" step="any" required /></label>
        <label class="admin-field admin-field-wide"><span>Fuseau horaire</span><select v-model="form.timezone" class="admin-pretty-select" required><option v-for="timezone in timezones" :key="timezone" :value="timezone">{{ timezone }}</option></select></label>
        <div class="admin-field admin-field-wide admin-combobox"><span>Port de référence</span><input v-model="portSearch" type="search" autocomplete="off" :placeholder="portsLoading ? 'Chargement des ports…' : 'Rechercher un port…'" /><div v-if="!portsLoading && portSearch !== form.tide_site_name" class="admin-select-options"><button v-for="port in filteredPorts" :key="port.site_id" type="button" :class="{ active: port.site_id === form.tide_site_id }" @click="selectPort(port)"><span>{{ port.name }}</span><span v-if="port.site_id === form.tide_site_id">✓</span></button><p v-if="!filteredPorts.length">Aucun port trouvé</p></div></div>
        <div class="admin-field admin-field-wide"><span>Image flottante active</span><div class="admin-image-card"><img :src="form.floating_image_url" alt="Aperçu de l’image flottante active" /><button type="button" class="admin-secondary" @click="editingImage.awake = !editingImage.awake">Changer l’image</button></div><input v-if="editingImage.awake" v-model="form.floating_image_url" type="url" placeholder="https://…" required /></div>
        <div class="admin-field admin-field-wide"><span>Image flottante inactive</span><div class="admin-image-card"><img v-if="form.floating_image_asleep_url" :src="form.floating_image_asleep_url" alt="Aperçu de l’image flottante inactive" /><span v-else>Aucune image</span><button type="button" class="admin-secondary" @click="editingImage.asleep = !editingImage.asleep">Changer l’image</button></div><input v-if="editingImage.asleep" v-model="form.floating_image_asleep_url" type="url" placeholder="https://…" /></div>
      </div>
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <footer><button type="button" class="admin-secondary" @click="$emit('close')">Annuler</button><button class="admin-primary" :disabled="pending">{{ pending ? 'Enregistrement…' : 'Enregistrer' }}</button></footer>
    </form>
  </div>
</template>
