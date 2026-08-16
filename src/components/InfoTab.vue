<script setup>
defineProps({ title: { type: String, required: true } });
</script>
<template>
  <section class="tab-panel tab-panel-info" aria-labelledby="info-tab-title">
    <h2 id="info-tab-title" class="sr-only">{{ title }}</h2>
    <slot />
  </section>
</template>
