<script setup>
import { ref } from 'vue'
import { signIn, stay } from '../composables/useStay'

const email = ref('')
const password = ref('')
const pending = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  pending.value = true
  try { await signIn(email.value.trim(), password.value) }
  catch (reason) { error.value = reason.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : reason.message }
  finally { pending.value = false }
}
</script>

<template>
  <main class="admin-login-page">
    <form class="admin-login-card" @submit.prevent="submit">
      <a :href="`/${stay.slug}`" class="admin-back-link">← Retour au logement</a>
      <p class="eyebrow">Espace responsable</p>
      <h1 class="admin-title">{{ stay.name }}</h1>
      <p class="admin-help">Connectez-vous pour mettre à jour la page. Aucun changement ne sera publié sans confirmation.</p>
      <label class="admin-field"><span>Email</span><input v-model="email" type="email" autocomplete="email" inputmode="email" required /></label>
      <label class="admin-field"><span>Mot de passe</span><input v-model="password" type="password" autocomplete="current-password" required /></label>
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <button class="admin-primary" type="submit" :disabled="pending">{{ pending ? 'Connexion…' : 'Se connecter' }}</button>
    </form>
  </main>
</template>
