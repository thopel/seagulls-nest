<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import { saveStay, stay } from '../composables/useStay'

const emit = defineEmits(['close', 'saved'])
const mapElement = ref(null)
const pending = ref(false)
const loadingStreets = ref(false)
const error = ref('')
const hint = ref('Zoomez pour afficher les rues sélectionnables.')
const selectionCount = ref(0)
const savedNotice = ref(false)
let map, streetLayers, savedStreetLayers, requestController, reloadTimer
const selected = new Map()
const overpassEndpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
]

function featureKey(feature) { return String(feature.properties?.osm_id || feature.properties?.id || feature.properties?.name + JSON.stringify(feature.geometry.coordinates)) }
function selectedStyle(active) { return active ? { color: '#d83b3b', weight: 14, opacity: .9, lineCap: 'round', lineJoin: 'round' } : { color: '#31999d', weight: 14, opacity: .42, lineCap: 'round', lineJoin: 'round' } }
function updateCount() { selectionCount.value = selected.size }
function renderSavedSelection() {
  if (!savedStreetLayers) return
  savedStreetLayers.clearLayers()
  L.geoJSON({ type: 'FeatureCollection', features: [...selected.values()] }, { style: selectedStyle(true), interactive: false })
    .eachLayer((layer) => savedStreetLayers.addLayer(layer))
}
function toggleStreet(layer, feature) {
  savedNotice.value = false
  const key = featureKey(feature)
  if (selected.has(key)) { selected.delete(key); layer.setStyle(selectedStyle(false)) }
  else { selected.set(key, feature); layer.setStyle(selectedStyle(true)) }
  updateCount(); renderSavedSelection()
}
function streetSections(elements) {
  const ways = elements.filter((element) => Array.isArray(element.geometry) && element.geometry.length > 1)
  const nodeUses = new Map()
  for (const way of ways) for (const nodeId of way.nodes || []) nodeUses.set(nodeId, (nodeUses.get(nodeId) || 0) + 1)
  const features = []
  for (const way of ways) {
    let start = 0
    const last = way.geometry.length - 1
    for (let index = 1; index <= last; index += 1) {
      const nodeId = way.nodes?.[index]
      const isIntersection = index === last || (nodeId && nodeUses.get(nodeId) > 1)
      if (!isIntersection) continue
      const geometry = way.geometry.slice(start, index + 1)
      if (geometry.length > 1) features.push({
        type: 'Feature',
        properties: { osm_id: String(way.id) + ':' + start + '-' + index, osm_way_id: way.id, name: way.tags?.name || 'Rue sans nom', highway: way.tags?.highway },
        geometry: { type: 'LineString', coordinates: geometry.map((point) => [point.lon, point.lat]) }
      })
      start = index
    }
  }
  return features
}
async function loadVisibleStreets() {
  if (!map || map.getZoom() < 13) { streetLayers?.clearLayers(); hint.value = 'Zoomez encore pour afficher les rues sélectionnables.'; return }
  requestController?.abort(); requestController = new AbortController(); loadingStreets.value = true; error.value = ''
  const bounds = map.getBounds()
  const bbox = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()].join(',')
  const query = '[out:json][timeout:20];way["highway"]["name"](' + bbox + ');out geom;'
  try {
    let payload
    for (const endpoint of overpassEndpoints) {
      try {
        const response = await fetch(endpoint + '?data=' + encodeURIComponent(query), { signal: requestController.signal })
        if (!response.ok) continue
        payload = await response.json()
        break
      } catch (reason) {
        if (reason.name === 'AbortError') throw reason
      }
    }
    if (!payload) throw new Error('Les rues ne peuvent pas être chargées pour le moment. Réessayez dans quelques instants.')
    const features = streetSections(payload.elements)
    streetLayers.clearLayers()
    L.geoJSON({ type: 'FeatureCollection', features }, { style: (feature) => selectedStyle(selected.has(featureKey(feature))), onEachFeature(feature, layer) { layer.bindTooltip(feature.properties.name, { sticky: true }); layer.on('click', (event) => { L.DomEvent.stopPropagation(event); toggleStreet(layer, feature) }) } }).eachLayer((layer) => streetLayers.addLayer(layer))
    hint.value = features.length ? 'Cliquez sur une portion entre deux intersections. Vous pouvez en sélectionner plusieurs.' : 'Aucune rue nommée trouvée dans cette zone.'
  } catch (reason) { if (reason.name !== 'AbortError') error.value = reason.message }
  finally { loadingStreets.value = false }
}
function scheduleStreetLoad() { clearTimeout(reloadTimer); reloadTimer = setTimeout(loadVisibleStreets, 350) }
function clearSelection() {
  savedNotice.value = false
  selected.clear()
  updateCount()
  renderSavedSelection()
  streetLayers?.eachLayer((layer) => layer.setStyle?.(selectedStyle(false)))
  hint.value = 'Toutes les portions ont été désélectionnées.'
}
async function save() {
  error.value = ''; pending.value = true; savedNotice.value = false
  try {
    await saveStay({ parking_geojson: { type: 'FeatureCollection', features: [...selected.values()] } })
    savedNotice.value = true
    hint.value = 'Les rues ont été enregistrées. Vous pouvez continuer à modifier la sélection.'
    emit('saved')
  }
  catch (reason) { error.value = reason.message } finally { pending.value = false }
}
onMounted(async () => {
  await nextTick()
  map = L.map(mapElement.value, { zoomControl: true, scrollWheelZoom: true, touchZoom: true, doubleClickZoom: true }).setView([stay.latitude, stay.longitude], 17)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '© OpenStreetMap contributors' }).addTo(map)
  streetLayers = L.featureGroup().addTo(map)
  savedStreetLayers = L.featureGroup().addTo(map)
  for (const feature of stay.parking_geojson?.features || []) if (feature.geometry?.type === 'LineString') selected.set(featureKey(feature), feature)
  updateCount(); renderSavedSelection()
  if (selected.size) { const saved = L.geoJSON({ type: 'FeatureCollection', features: [...selected.values()] }); if (saved.getBounds().isValid()) map.fitBounds(saved.getBounds(), { padding: [40, 40], maxZoom: 18 }) }
  map.on('moveend', scheduleStreetLoad)
  setTimeout(() => { map.invalidateSize(); loadVisibleStreets() }, 80)
})
onBeforeUnmount(() => { clearTimeout(reloadTimer); requestController?.abort(); map?.remove() })
</script>
<template>
  <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="parking-editor-title"><section class="admin-sheet admin-map-sheet">
    <header><div><p class="eyebrow">Stationnement gratuit</p><h2 id="parking-editor-title">Sélectionner les rues</h2></div><button type="button" class="admin-round-button" aria-label="Fermer" @click="$emit('close')">×</button></header>
    <div class="admin-map-help"><strong>La sélection suit le tracé réel de la rue.</strong> Utilisez +/−, la molette ou deux doigts pour zoomer, puis cliquez sur une portion entre deux intersections. Sélectionnez plusieurs portions pour couvrir davantage de rue.</div>
    <div class="parking-editor-status"><span>{{ loadingStreets ? 'Chargement des rues…' : hint }}</span><button type="button" class="parking-editor-retry" :disabled="loadingStreets" @click="loadVisibleStreets">Actualiser</button><strong>{{ selectionCount }} {{ selectionCount > 1 ? 'rues sélectionnées' : 'rue sélectionnée' }}</strong></div>
    <div ref="mapElement" class="admin-parking-map"></div>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <footer><button type="button" class="admin-secondary" :disabled="!selectionCount" @click="clearSelection">Tout désélectionner</button><button class="admin-primary" :disabled="pending" @click="save">{{ pending ? 'Enregistrement…' : savedNotice ? 'Rues enregistrées ✓' : 'Enregistrer les rues' }}</button></footer>
  </section></div>
</template>
