<template>
  <footer class="footer">
    <div class="footer__inner">
      <div class="footer__brand">
        <NuxtLink to="/">Browser AI Kit</NuxtLink>
        <p>Chrome's on-device AI, shaped into framework APIs you can ship.</p>
      </div>

      <nav class="footer__links" aria-label="Footer navigation">
        <div>
          <span>Product</span>
          <NuxtLink to="/#apis">Live examples</NuxtLink>
          <NuxtLink to="/docs">Documentation</NuxtLink>
          <NuxtLink to="/#frameworks">Frameworks</NuxtLink>
        </div>
        <div>
          <span>Project</span>
          <a :href="Links.coreRepo" target="_blank" rel="noopener noreferrer">
            <span>GitHub</span>
          </a>
          <a :href="Links.contributing" target="_blank" rel="noopener noreferrer">
            <span>Contributing</span>
          </a>
          <a
            href="https://github.com/DeSource-Labs/browser-ai/blob/main/SECURITY.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Security</span>
          </a>
        </div>
      </nav>
    </div>

    <div class="footer__bottom">
      <span>© {{ year }} DeSource Labs. MIT licensed.</span>
      <div v-once class="footer__socials">
        <Social
          v-for="social in socials"
          :key="social.type"
          size="1.1rem"
          :aria-label="`Visit DeSource Labs ${social.type}`"
          :type="social.type"
          :href="social.href"
        />
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const socials = socialMediaArray;
const year = new Date().getFullYear();
</script>
