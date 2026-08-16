<script setup>
defineProps({ stayName: String, backUrl: String })
</script>
<template>
  <main class="legal-page"><article class="legal-card">
    <a class="admin-back-link" :href="backUrl">← Retour à {{ stayName }}</a>
    <p class="eyebrow">Informations importantes</p><h1>Utilisation des données</h1>
    <p class="legal-lead">Les informations affichées par cette application sont fournies à titre indicatif et pratique. Elles ne constituent ni une information officielle, ni un conseil professionnel.</p>
    <section><h2>Météo, marées et mer</h2><p>Les prévisions, horaires, hauteurs d’eau, coefficients et températures peuvent être incomplets, décalés ou inexacts. Ils ne remplacent pas les bulletins et avertissements des autorités compétentes, notamment pour la navigation, la baignade ou toute activité présentant un risque.</p></section>
    <section><h2>Localisation et stationnement</h2><p>Les cartes, positions et zones de stationnement sont susceptibles d’évoluer. La signalisation sur place, les arrêtés locaux et le Code de la route prévalent toujours.</p></section>
    <section><h2>Responsabilité de l’utilisateur</h2><p>Vous restez seul responsable de vos décisions et de l’usage que vous faites de ces données. Avant toute activité sensible, vérifiez les informations auprès d’une source officielle et tenez compte des conditions réellement observées.</p></section>
    <section><h2>Services tiers</h2><p>L’application s’appuie sur des fournisseurs externes. Leur disponibilité et l’exactitude de leurs données ne peuvent être garanties par l’hébergeur ou le propriétaire du logement.</p></section>
  </article></main>
</template>
