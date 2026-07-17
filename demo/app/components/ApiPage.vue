<template>
  <div class="api-page">
    <header class="api-page__header">
      <button type="button" class="api-page__back" @click="goBack">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m12.5 4-6 6 6 6" />
        </svg>
        Back
      </button>

      <div class="api-page__intro">
        <p>{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <span>{{ description }}</span>
      </div>

      <NuxtLink class="api-page__docs-link" to="/docs">
        Documentation
        <span aria-hidden="true">↗</span>
      </NuxtLink>
    </header>

    <main>
      <section class="api-page__playground" aria-labelledby="playground-title">
        <div class="api-page__section-heading">
          <div>
            <p>Runs in this browser</p>
            <h2 id="playground-title">Interactive playground</h2>
          </div>
          <span><i aria-hidden="true" /> No hosted fallback</span>
        </div>

        <div
          class="api-page__workspace"
          :class="`api-page__workspace--${workspace}`"
          :style="{
            '--api-workspace-mobile-height': `${mobileWorkspaceHeight ?? 0}px`,
          }"
        >
          <slot />
        </div>
      </section>

      <section class="api-page__usage" aria-labelledby="usage-title">
        <div class="api-page__usage-intro">
          <p>Use it in your product</p>
          <h2 id="usage-title">Start complete. Customize when you need to.</h2>
          <span>
            Components provide the fastest production path. Composables expose
            the same lifecycle for a UI that is entirely yours.
          </span>
        </div>

        <div class="api-page__examples">
          <article v-for="example in examples" :key="example.label">
            <div class="api-page__example-copy">
              <p>{{ example.label }}</p>
              <h3>{{ example.title }}</h3>
              <span>{{ example.description }}</span>
            </div>
            <CodeBlock :label="example.label" :code="example.code" />
          </article>
        </div>
      </section>
    </main>

    <footer class="api-page__footer">
      <span>Browser AI Kit · Vue and Nuxt available now</span>
      <NuxtLink to="/#apis">Explore every API <span>→</span></NuxtLink>
    </footer>
  </div>
</template>

<script setup lang="ts">
import type { ApiGuide } from "#shared/types";

const props = defineProps<ApiGuide>();
const router = useRouter();

useSeoMeta({
  title: () => `${props.title} playground · Browser AI Kit`,
  description: () => props.description,
});

const goBack = () => {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  void navigateTo("/#apis");
};
</script>

<style scoped>
.api-page {
  width: min(1320px, calc(100% - clamp(1rem, 4vw, 4rem)));
  margin-inline: auto;
  padding: 1rem 0 2rem;
}

.api-page__header {
  min-height: 210px;
  display: grid;
  grid-template-columns: 1fr minmax(0, 760px) 1fr;
  align-items: start;
  gap: 1.25rem;
  padding: clamp(1rem, 3vw, 2.2rem) 0 clamp(1.6rem, 4vw, 3rem);
}

.api-page__back,
.api-page__docs-link {
  width: fit-content;
  min-height: 2.55rem;
  display: inline-flex;
  align-items: center;
  gap: 0.48rem;
  padding: 0.55rem 0.72rem;
  color: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 0.72rem;
  background: rgba(8, 11, 23, 0.64);
  font-size: 0.76rem;
  font-weight: 720;
  cursor: pointer;
  transition:
    color 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.api-page__back:hover,
.api-page__back:focus-visible,
.api-page__docs-link:hover,
.api-page__docs-link:focus-visible {
  color: #fff;
  border-color: rgba(167, 139, 250, 0.3);
  background: rgba(16, 20, 38, 0.82);
}

.api-page__back svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
}

.api-page__docs-link {
  justify-self: end;
}

.api-page__intro {
  display: grid;
  justify-items: center;
  gap: 0.7rem;
  text-align: center;
}

.api-page__intro p,
.api-page__section-heading p,
.api-page__usage-intro p,
.api-page__example-copy p {
  margin: 0;
  color: #9e8cff;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.api-page__intro h1,
.api-page__section-heading h2,
.api-page__usage-intro h2,
.api-page__example-copy h3 {
  margin: 0;
  color: #fff;
  letter-spacing: -0.045em;
}

.api-page__intro h1 {
  font-size: clamp(2.25rem, 5vw, 4.4rem);
  line-height: 0.98;
}

.api-page__intro > span {
  max-width: 690px;
  color: rgba(255, 255, 255, 0.58);
  font-size: clamp(0.9rem, 1.5vw, 1.05rem);
  line-height: 1.55;
}

.api-page__playground {
  padding: 1.2rem 0 clamp(3.5rem, 7vw, 6rem);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.api-page__section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
}

.api-page__section-heading > div {
  display: grid;
  gap: 0.28rem;
}

.api-page__section-heading h2 {
  font-size: clamp(1.25rem, 2vw, 1.65rem);
}

.api-page__section-heading > span {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.72rem;
}

.api-page__section-heading > span i {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: #63e6a5;
  box-shadow: 0 0 0.65rem rgba(52, 211, 153, 0.7);
}

.api-page__workspace {
  width: 100%;
  min-width: 0;
}

.api-page__workspace--chat {
  height: clamp(660px, calc(100svh - 120px), 820px);
}

.api-page__workspace--tool {
  min-height: 620px;
  height: min(720px, 76svh);
}

.api-page__workspace--webmcp {
  padding: 1rem 0;
}

.api-page__usage {
  display: grid;
  grid-template-columns: minmax(240px, 0.34fr) minmax(0, 1fr);
  gap: clamp(2rem, 5vw, 5rem);
  padding: clamp(1rem, 3vw, 2rem) 0 clamp(4rem, 8vw, 7rem);
}

.api-page__usage-intro {
  align-self: start;
  position: sticky;
  top: 2rem;
  display: grid;
  gap: 0.7rem;
}

.api-page__usage-intro h2 {
  max-width: 410px;
  font-size: clamp(1.9rem, 3.5vw, 3.1rem);
  line-height: 1.04;
}

.api-page__usage-intro > span,
.api-page__example-copy > span {
  color: rgba(255, 255, 255, 0.56);
  line-height: 1.58;
}

.api-page__usage-intro > span {
  max-width: 390px;
  font-size: 0.88rem;
}

.api-page__examples {
  display: grid;
  gap: 1rem;
}

.api-page__examples article {
  min-width: 0;
  padding: clamp(1rem, 2vw, 1.35rem);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 1.1rem;
  background: rgba(7, 10, 20, 0.58);
}

.api-page__example-copy {
  display: grid;
  gap: 0.45rem;
  padding: 0.2rem 0.15rem 1rem;
}

.api-page__example-copy h3 {
  font-size: 1.1rem;
}

.api-page__example-copy > span {
  max-width: 680px;
  font-size: 0.8rem;
}

.api-page__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem 0 0.4rem;
  color: rgba(255, 255, 255, 0.58);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.75rem;
}

.api-page__footer a {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 720;
}

@media (max-width: 900px) {
  .api-page__header {
    min-height: 0;
    grid-template-columns: 1fr 1fr;
  }

  .api-page__intro {
    grid-column: 1 / -1;
    grid-row: 2;
    padding-top: 1.25rem;
  }

  .api-page__usage {
    grid-template-columns: 1fr;
  }

  .api-page__usage-intro {
    position: static;
  }

  .api-page__workspace--chat {
    height: 760px;
  }

  .api-page__workspace--tool {
    height: auto;
    min-height: 0;
  }
}

@media (max-width: 560px) {
  .api-page {
    width: calc(100% - 1rem);
    padding-top: 0.5rem;
  }

  .api-page__back,
  .api-page__docs-link {
    min-height: 2.35rem;
    padding: 0.45rem 0.58rem;
  }

  .api-page__intro {
    justify-items: start;
    text-align: left;
  }

  .api-page__section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .api-page__workspace--chat {
    height: 780px;
  }

  .api-page__workspace--tool,
  .api-page__workspace--webmcp {
    min-height: var(--api-workspace-mobile-height);
  }

  .api-page__examples article {
    padding: 0.7rem;
  }

  .api-page__footer {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .api-page__back,
  .api-page__docs-link {
    transition: none;
  }
}
</style>
