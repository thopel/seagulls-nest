<script setup>
defineProps({ hidden: Boolean, label: { type: String, required: true } })
defineEmits(['toggle'])
</script>
<template>
  <button type="button" class="admin-section-toggle" :class="{ 'admin-section-toggle-restore': hidden }" :aria-label="hidden ? `Réafficher ${label}` : `Masquer ${label}`" @click.stop="$emit('toggle')">
    <span aria-hidden="true">{{ hidden ? '+' : '×' }}</span>
  </button>
</template>
