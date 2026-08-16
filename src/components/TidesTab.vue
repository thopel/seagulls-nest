<script setup>
defineProps({ title: { type: String, required: true } });
</script>
<template>
  <section class="tab-panel tab-panel-tides" aria-labelledby="tides-tab-title">
    <h2 id="tides-tab-title" class="sr-only">{{ title }}</h2>
    <slot />
  </section>
</template>
