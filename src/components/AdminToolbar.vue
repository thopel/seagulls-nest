<script setup>
import { signOut, stay } from '../composables/useStay'
defineEmits(['settings', 'parking'])
async function disconnect() { await signOut(); window.location.assign('/' + stay.slug + '/admin') }
</script>
<template>
  <nav class="admin-toolbar" aria-label="Administration">
    <div><strong>Mode administration</strong><span>Les visiteurs ne voient pas ces boutons</span></div>
    <div class="admin-toolbar-actions">
      <a :href="'/' + stay.slug" title="Retour au logement" aria-label="Retour au logement"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6-6 6 6 6M4 12h16" /></svg><span>Retour au logement</span></a>
      <button type="button" title="Gérer le stationnement" aria-label="Gérer le stationnement" @click="$emit('parking')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 17V7h3.2a3 3 0 0 1 0 6H9.5m0 0h3.2" /></svg><span>Gérer le stationnement</span></button>
      <button type="button" class="admin-settings-button" title="Paramètres" aria-label="Ouvrir les paramètres" @click="$emit('settings')"><span class="admin-gear-glyph" aria-hidden="true">&#9881;</span></button>
      <button type="button" title="Se déconnecter" aria-label="Se déconnecter" @click="disconnect"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8V5H5v14h9v-3m-3-4h10m-3-3 3 3-3 3" /></svg><span>Se déconnecter</span></button>
    </div>
  </nav>
</template>
