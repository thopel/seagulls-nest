<script setup>
defineProps({ title: { type: String, required: true } });
</script>
<template>
  <section class="tab-panel tab-panel-weather" aria-labelledby="weather-tab-title">
    <h2 id="weather-tab-title" class="sr-only">{{ title }}</h2>
    <slot />
  </section>
</template>
