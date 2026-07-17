<template>
  <footer class="footer">
    <a class="animated-link h3" :href="Links.org" rel="nofollow noopener"
      >DESOURCE LABS</a
    >
    <LiquidGlass>
      <div v-once class="footer__socials">
        <Social
          v-for="social in socials"
          :key="social.type"
          size="1.2rem"
          :aria-label="`Visit DeSource Labs ${social.type}`"
          :type="social.type"
          :href="social.href"
        />
      </div>
    </LiquidGlass>
    <a class="legal animated-link p4" :href="Links.org" rel="nofollow noopener"
      >2025, DESOURCE LABS LTD</a
    >
  </footer>
</template>

<script setup lang="ts">
const socials = socialMediaArray;
</script>
