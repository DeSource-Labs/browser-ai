<template>
  <div class="landing">
    <MarketingNav />

    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero__beam-field" aria-hidden="true"><i /><i /><i /></div>
        <div class="hero__glow hero__glow--one" aria-hidden="true" />
        <div class="hero__glow hero__glow--two" aria-hidden="true" />

        <div class="hero__copy">
          <p class="eyebrow">
            <span class="eyebrow__dot" />
            Private AI. Native to Chrome. Ready for Vue.
          </p>
          <h1 id="hero-title">
            Ship on-device AI<br />
            <span>without the browser plumbing.</span>
          </h1>
          <p class="hero__lede">
            Production-ready components and composables for Chrome's Prompt API,
            writing tools, translation, Proofreader, and WebMCP. No inference
            server. No API key. No deep-reactivity slowdown.
          </p>
          <div class="hero__actions">
            <NuxtLink class="button button--primary" to="/#apis">
              Try the live APIs
              <span aria-hidden="true">→</span>
            </NuxtLink>
            <NuxtLink class="button button--secondary" to="/docs">
              Read the docs
            </NuxtLink>
          </div>
          <ul class="hero__proof" aria-label="Project qualities">
            <li><span>✓</span> MIT licensed</li>
            <li><span>✓</span> TypeScript-first</li>
            <li><span>✓</span> SSR-safe</li>
            <li><span>✓</span> Zero telemetry</li>
          </ul>
        </div>

        <div class="hero__product" aria-label="Vue installation example">
          <div class="hero__product-top">
            <span class="window-dots" aria-hidden="true"><i /><i /><i /></span>
            <span>Local AI session</span>
            <span class="live-pill"><i /> Ready</span>
          </div>
          <div class="hero__chat">
            <div class="hero__message hero__message--user">
              Turn this release note into three customer benefits.
            </div>
            <div class="hero__message hero__message--assistant">
              <span class="spark" aria-hidden="true">✦</span>
              <div>
                <strong>Clearer decisions.</strong> Structured output keeps
                every response predictable. <br /><br />
                <strong>Faster workflows.</strong> Streaming local inference
                responds without a network round trip. <br /><br />
                <strong>Private by default.</strong> Content stays inside the
                browser's built-in model.
              </div>
            </div>
          </div>
          <div class="hero__composer">
            <span>Ask the local model…</span>
            <span class="send-button" aria-hidden="true">↑</span>
          </div>
          <div class="hero__local">
            <span class="hero__local-icon" aria-hidden="true">⌁</span>
            Running on-device with Gemini Nano
            <span>0 network requests</span>
          </div>
        </div>
      </section>

      <div class="trust-strip" aria-label="Supported capabilities">
        <span>Prompt API</span><i /> <span>Structured output</span><i />
        <span>Long-input handling</span><i /> <span>WebMCP</span><i />
        <span>Vue + Nuxt</span>
      </div>

      <section id="why" class="content-section why-section">
        <div class="section-heading">
          <p class="section-kicker">
            A production layer, not another model SDK
          </p>
          <h2>
            The native API is powerful.<br />The lifecycle is the hard part.
          </h2>
          <p>
            Chrome provides the model. Browser AI Kit handles the states and
            limits that turn a browser experiment into a feature people can
            depend on.
          </p>
        </div>

        <div class="benefit-grid">
          <article class="benefit-card benefit-card--wide">
            <span class="benefit-card__number">01</span>
            <div class="benefit-card__icon" aria-hidden="true">◫</div>
            <h3>Every browser state has a product state.</h3>
            <p>
              Feature detection, downloads, progress, cancellation, quotas,
              context overflow, failure, and cleanup are reactive and typed.
            </p>
            <div class="state-row" aria-hidden="true">
              <span>Available</span>
              <span>Needs download</span>
              <span>Processing</span>
            </div>
          </article>

          <article class="benefit-card">
            <span class="benefit-card__number">02</span>
            <div class="benefit-card__icon" aria-hidden="true">↯</div>
            <h3>Responsive while the model works.</h3>
            <p>
              Native sessions stay outside deep reactivity. Stream rendering is
              frame-coalesced so typing remains crisp during local inference.
            </p>
          </article>

          <article class="benefit-card">
            <span class="benefit-card__number">03</span>
            <div class="benefit-card__icon" aria-hidden="true">∞</div>
            <h3>Long input is a supported path.</h3>
            <p>
              Measure real browser quotas, split at safe boundaries, and merge
              with API-specific strategies instead of arbitrary character caps.
            </p>
          </article>

          <article class="benefit-card benefit-card--wide">
            <span class="benefit-card__number">04</span>
            <div class="benefit-card__icon" aria-hidden="true">◇</div>
            <h3>Choose the interface level that fits.</h3>
            <p>
              Start with accessible components, move to composables for a fully
              custom UI, and keep direct access to familiar native operations.
            </p>
            <div class="layer-row" aria-hidden="true">
              <span>Components</span>
              <b>→</b>
              <span>Composables</span>
              <b>→</b>
              <span>Chrome APIs</span>
            </div>
          </article>
        </div>
      </section>

      <section class="content-section install-section">
        <div class="install-section__copy">
          <p class="section-kicker">
            From install to local response in minutes
          </p>
          <h2>Small API. Serious defaults.</h2>
          <p>
            Drop in a complete chat interface or keep the UI entirely yours.
            Browser AI Kit stays close to Chrome's vocabulary, so the native
            documentation and your application code still line up.
          </p>
          <div class="package-switch" role="group" aria-label="Package example">
            <button
              v-for="item in availablePackages"
              :key="item.id"
              type="button"
              :data-package-tab="item.id"
              :class="{ active: selectedPackage === item.id }"
              @click="selectedPackage = item.id"
            >
              {{ item.name }}
            </button>
          </div>
          <CodeBlock
            :label="`${selectedPackage === 'vue' ? 'Vue' : 'Nuxt'} quick start`"
            :code="packageCode"
          />
        </div>

        <div class="comparison-card">
          <div class="comparison-card__head">
            <span>Production concern</span>
            <span>Native</span>
            <span>Kit</span>
          </div>
          <div
            v-for="row in comparisonRows"
            :key="row.label"
            class="comparison-card__row"
          >
            <span>{{ row.label }}</span>
            <span class="comparison-card__native">{{ row.native }}</span>
            <span class="comparison-card__kit">{{ row.kit }}</span>
          </div>
          <p>
            Calling the native API directly is a good fit for one-off tasks. The
            kit earns its place when lifecycle, persistence, SSR, or long
            content matters.
          </p>
        </div>
      </section>

      <section id="apis" class="content-section api-section">
        <div class="section-heading section-heading--split">
          <div>
            <p class="section-kicker">Live in your browser</p>
            <h2>Eight surfaces.<br />One consistent experience.</h2>
          </div>
          <p>
            Availability below is detected from this Chrome profile. Open an
            example to test the real local API—there is no mocked response or
            hosted fallback behind these demos.
          </p>
        </div>
        <Tools />
      </section>

      <section id="frameworks" class="content-section framework-section">
        <div class="section-heading section-heading--split">
          <div>
            <p class="section-kicker">Built for more than one ecosystem</p>
            <h2>Native to your framework.<br />Consistent underneath.</h2>
          </div>
          <p>
            Vue and Nuxt are ready today. React, Angular, Svelte, and a
            framework-neutral TypeScript core are on the public roadmap.
          </p>
        </div>

        <div class="framework-grid">
          <a
            v-for="item in LibItems"
            :key="item.id"
            class="framework-card"
            :class="`framework-card--${item.status}`"
            :href="DocLinks[item.id]"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div class="framework-card__head">
              <span class="framework-card__monogram">{{
                frameworkMarks[item.id]
              }}</span>
              <span class="framework-card__status">{{ item.status }}</span>
            </div>
            <h3>{{ item.name }}</h3>
            <p>{{ item.description }}</p>
            <span class="framework-card__link">
              {{
                item.status === "available" ? "Package guide" : "View roadmap"
              }}
              →
            </span>
          </a>
        </div>
      </section>

      <section class="content-section privacy-section">
        <div class="privacy-card">
          <div class="privacy-card__visual" aria-hidden="true">
            <span class="privacy-ring privacy-ring--one" />
            <span class="privacy-ring privacy-ring--two" />
            <span class="privacy-lock">⌾</span>
          </div>
          <div>
            <p class="section-kicker">
              A privacy boundary users can understand
            </p>
            <h2>No inference endpoint hiding in the fine print.</h2>
            <p>
              The library does not send prompts, outputs, or telemetry to
              DeSource Labs. Chrome owns model execution and storage. If your
              app adds a hosted fallback, that becomes a separate product and
              consent decision.
            </p>
            <NuxtLink class="text-link" to="/docs#privacy">
              Read the privacy and fallback guide →
            </NuxtLink>
          </div>
        </div>
      </section>

      <section class="content-section final-cta">
        <p class="section-kicker">Open source and ready to build on</p>
        <h2>Make the browser the AI runtime.</h2>
        <p>
          Start with the package guide, run every API against your local Chrome
          profile, or help shape the next framework integration.
        </p>
        <div class="hero__actions final-cta__actions">
          <NuxtLink class="button button--primary" to="/docs">
            Start building <span aria-hidden="true">→</span>
          </NuxtLink>
          <a
            class="button button--secondary"
            :href="Links.coreRepo"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
      </section>
    </main>

    <Footer />
  </div>
</template>

<script setup lang="ts">
import type { Library } from "~~/shared/types";

useSeoMeta({
  title: "Browser AI Kit — Chrome built-in AI for Vue and Nuxt",
  description:
    "Ship private, on-device AI in Vue and Nuxt with production-ready components, composables, long-input handling, and WebMCP tools.",
});

useHead({
  script: [{ src: "/marketing.js", defer: true }],
});

const selectedPackage = ref<"vue" | "nuxt">("vue");
const availablePackages = LibItems.filter(
  (item): item is (typeof LibItems)[number] & { id: "vue" | "nuxt" } =>
    item.id === "vue" || item.id === "nuxt",
);

const packageCode = computed(() =>
  selectedPackage.value === "vue"
    ? `npm install @desource/browser-ai-vue

<script setup lang="ts">
import { PromptApi } from "@desource/browser-ai-vue";
import "@desource/browser-ai-vue/assets/lib.css";
<${"/"}script>

<template>
  <PromptApi context-strategy="summarize" />
</template>`
    : `npm install @desource/browser-ai-nuxt

// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@desource/browser-ai-nuxt"],
});

// PromptApi and usePromptApi are now auto-imported.`,
);

const comparisonRows = [
  { label: "Download and readiness UX", native: "Build it", kit: "Included" },
  { label: "Measured long input", native: "Build it", kit: "Included" },
  { label: "Prompt context recovery", native: "Build it", kit: "Included" },
  { label: "Nuxt SSR safety", native: "Manual", kit: "Included" },
  { label: "Accessible starter UI", native: "None", kit: "Included" },
];

const frameworkMarks: Record<Library, string> = {
  vue: "V",
  nuxt: "N",
  react: "R",
  angular: "A",
  svelte: "S",
  typescript: "TS",
};
</script>

<style scoped>
.landing {
  min-height: 100svh;
}

.hero,
.content-section,
.trust-strip {
  width: min(1180px, calc(100% - 2rem));
  margin-inline: auto;
}

.hero {
  position: relative;
  min-height: clamp(640px, calc(100svh - 5rem), 810px);
  padding: clamp(3.25rem, 5vw, 4.75rem) 0 clamp(3.5rem, 6vw, 5.5rem);
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(390px, 0.8fr);
  align-items: center;
  gap: clamp(2.5rem, 7vw, 6.5rem);
  --pointer-x: 72%;
  --pointer-y: 28%;
  --tilt-x: 1deg;
  --tilt-y: -3deg;
}

.hero::before {
  position: absolute;
  inset: 2rem -8vw 0;
  content: "";
  pointer-events: none;
  opacity: 0.7;
  background:
    radial-gradient(
      circle 280px at var(--pointer-x) var(--pointer-y),
      rgba(130, 107, 255, 0.16),
      transparent 72%
    ),
    radial-gradient(circle, rgba(255, 255, 255, 0.16) 1px, transparent 1px);
  background-size:
    auto,
    32px 32px;
  mask-image: radial-gradient(ellipse at 70% 38%, #000 0%, transparent 67%);
}

.hero__beam-field {
  position: absolute;
  inset: -2rem -5vw 0 42%;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 18%,
    #000 70%,
    transparent
  );
}

.hero__beam-field i {
  position: absolute;
  top: -30%;
  width: 1px;
  height: 130%;
  opacity: 0.34;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(163, 144, 255, 0.75),
    rgba(94, 234, 212, 0.2),
    transparent
  );
  box-shadow: 0 0 22px 2px rgba(130, 107, 255, 0.15);
  transform: rotate(24deg) translate3d(0, -12%, 0);
  animation: beam-scan 9s ease-in-out infinite alternate;
}

.hero__beam-field i:nth-child(1) {
  left: 24%;
}

.hero__beam-field i:nth-child(2) {
  left: 55%;
  animation-delay: -4s;
  animation-duration: 12s;
}

.hero__beam-field i:nth-child(3) {
  left: 82%;
  animation-delay: -7s;
  animation-duration: 14s;
}

.hero__copy,
.hero__product {
  position: relative;
  z-index: 2;
}

.hero__glow {
  position: absolute;
  z-index: 0;
  border-radius: 50%;
  filter: blur(2px);
  pointer-events: none;
}

.hero__glow--one {
  width: 520px;
  height: 520px;
  right: -17%;
  top: 5%;
  background: radial-gradient(
    circle,
    rgba(124, 91, 255, 0.23),
    transparent 68%
  );
  animation: glow-breathe 8s ease-in-out infinite alternate;
}

.hero__glow--two {
  width: 400px;
  height: 400px;
  left: -20%;
  bottom: -4%;
  background: radial-gradient(circle, rgba(52, 211, 183, 0.1), transparent 70%);
  animation: glow-breathe 11s ease-in-out -4s infinite alternate-reverse;
}

.eyebrow,
.section-kicker {
  color: #a99cff;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.eyebrow {
  width: fit-content;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.7rem;
  color: rgba(229, 226, 255, 0.86);
  border: 1px solid rgba(163, 144, 255, 0.22);
  border-radius: 999px;
  background: rgba(115, 91, 214, 0.09);
}

.eyebrow__dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: #72e6c8;
  box-shadow: 0 0 0 4px rgba(114, 230, 200, 0.1);
  animation: status-pulse 2.8s ease-in-out infinite;
}

.hero h1 {
  max-width: 770px;
  margin-top: 1.7rem;
  color: #fff;
  font-size: clamp(3.15rem, 5vw, 4.8rem);
  font-weight: 720;
  line-height: 0.98;
  letter-spacing: -0.067em;
}

.hero h1 span {
  color: rgba(255, 255, 255, 0.46);
}

.hero__lede {
  max-width: 650px;
  margin-top: 1.75rem;
  color: rgba(231, 235, 247, 0.66);
  font-size: clamp(1.04rem, 1.8vw, 1.22rem);
  line-height: 1.65;
}

.hero__actions {
  margin-top: 2rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.button {
  position: relative;
  overflow: hidden;
  min-height: 3.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 0.72rem 1.1rem;
  border: 1px solid transparent;
  border-radius: 0.82rem;
  font-size: 0.88rem;
  font-weight: 800;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.button::after {
  position: absolute;
  inset: 0;
  content: "";
  pointer-events: none;
  background: linear-gradient(
    110deg,
    transparent 30%,
    rgba(255, 255, 255, 0.18),
    transparent 70%
  );
  transform: translate3d(-120%, 0, 0);
  transition: transform 520ms ease;
}

.button:hover::after,
.button:focus-visible::after {
  transform: translate3d(120%, 0, 0);
}

.button:hover,
.button:focus-visible {
  transform: translateY(-2px);
}

.button--primary {
  color: #fff;
  background: linear-gradient(135deg, #7557e9, #5576e7);
  box-shadow: 0 14px 34px rgba(91, 91, 223, 0.26);
}

.button--secondary {
  color: rgba(255, 255, 255, 0.86);
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.055);
}

.button--secondary:hover,
.button--secondary:focus-visible {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.09);
}

.hero__proof {
  margin-top: 2rem;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem 1.2rem;
  color: rgba(255, 255, 255, 0.64);
  list-style: none;
  font-size: 0.76rem;
}

.hero__proof span {
  margin-right: 0.25rem;
  color: #72e6c8;
}

.hero__product {
  width: 100%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 1.25rem;
  background: rgba(7, 10, 22, 0.84);
  box-shadow:
    0 45px 110px rgba(0, 0, 0, 0.48),
    0 0 0 1px rgba(112, 91, 230, 0.06),
    inset 0 1px rgba(255, 255, 255, 0.08);
  transform: perspective(1200px) rotateY(var(--tilt-y)) rotateX(var(--tilt-x));
  transition:
    transform 240ms ease-out,
    border-color 240ms ease,
    box-shadow 240ms ease;
}

.hero__product:hover {
  border-color: rgba(196, 181, 253, 0.26);
  box-shadow:
    0 52px 120px rgba(0, 0, 0, 0.52),
    0 0 56px rgba(112, 91, 230, 0.12),
    inset 0 1px rgba(255, 255, 255, 0.1);
}

.hero__product::after {
  position: absolute;
  inset: 0;
  content: "";
  pointer-events: none;
  background: linear-gradient(
    130deg,
    rgba(255, 255, 255, 0.045),
    transparent 30%
  );
}

.hero__product-top,
.hero__local {
  display: flex;
  align-items: center;
}

.hero__product-top {
  min-height: 3.5rem;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  color: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.72rem;
  font-weight: 700;
}

.window-dots {
  display: flex;
  gap: 0.3rem;
}

.window-dots i {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
}

.live-pill {
  padding: 0.3rem 0.5rem;
  color: #a7f3d0;
  border: 1px solid rgba(52, 211, 153, 0.18);
  border-radius: 999px;
  background: rgba(52, 211, 153, 0.08);
}

.live-pill i {
  width: 0.36rem;
  height: 0.36rem;
  margin-right: 0.28rem;
  display: inline-block;
  border-radius: 50%;
  background: #6ee7b7;
  animation: status-pulse 2.8s ease-in-out infinite;
}

.hero__chat {
  min-height: 310px;
  padding: 1.3rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1rem;
}

.hero__message {
  max-width: 90%;
  padding: 0.85rem 1rem;
  color: rgba(243, 246, 255, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 1rem;
  font-size: 0.79rem;
  line-height: 1.55;
}

.hero__message--user {
  align-self: flex-end;
  color: rgba(255, 255, 255, 0.86);
  border-bottom-right-radius: 0.3rem;
  background: rgba(111, 87, 216, 0.2);
}

.hero__message--assistant {
  align-self: flex-start;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.65rem;
  border-bottom-left-radius: 0.3rem;
  background: rgba(255, 255, 255, 0.035);
}

.hero__message strong {
  color: rgba(255, 255, 255, 0.94);
}

.spark {
  color: #a78bfa;
  font-size: 1rem;
}

.hero__composer {
  min-height: 3.6rem;
  margin: 0 1rem 1rem;
  padding: 0.55rem 0.55rem 0.55rem 0.9rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.035);
  font-size: 0.78rem;
}

.send-button {
  width: 2.35rem;
  height: 2.35rem;
  display: grid;
  place-items: center;
  color: #fff;
  border-radius: 0.65rem;
  background: linear-gradient(135deg, #7c5ce4, #5876e4);
  font-size: 1rem;
}

.hero__local {
  min-height: 2.8rem;
  padding: 0.65rem 1rem;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.62);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(2, 4, 12, 0.4);
  font-size: 0.66rem;
}

.hero__local-icon {
  color: #72e6c8;
  font-size: 1rem;
}

.hero__local span:last-child {
  margin-left: auto;
  color: #72e6c8;
}

.trust-strip {
  min-height: 5rem;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1rem 1.6rem;
  color: rgba(255, 255, 255, 0.62);
  border-block: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.74rem;
  font-weight: 700;
}

.trust-strip i {
  width: 0.25rem;
  height: 0.25rem;
  border-radius: 50%;
  background: rgba(160, 143, 255, 0.6);
}

.content-section {
  padding-block: clamp(4.5rem, 8vw, 7rem);
}

.content-section[id] {
  scroll-margin-top: 6.25rem;
}

.section-heading {
  max-width: 930px;
  margin-bottom: clamp(2.25rem, 4vw, 3.25rem);
}

.section-heading--split {
  max-width: none;
  display: grid;
  grid-template-columns: 1.2fr 0.7fr;
  align-items: end;
  gap: 3rem;
}

.section-heading h2,
.install-section h2,
.privacy-card h2,
.final-cta h2 {
  margin-top: 0.9rem;
  color: #fff;
  font-size: clamp(2.35rem, 5vw, 4.4rem);
  font-weight: 690;
  line-height: 1.05;
  letter-spacing: -0.052em;
}

.section-heading > p:last-child,
.section-heading--split > p,
.install-section__copy > p,
.privacy-card p,
.final-cta > p:not(.section-kicker) {
  margin-top: 1.2rem;
  color: rgba(231, 235, 247, 0.57);
  font-size: 1rem;
  line-height: 1.7;
}

.section-heading--split > p {
  margin: 0 0 0.25rem;
}

.benefit-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.benefit-card {
  position: relative;
  min-height: 285px;
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.15rem;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.045), transparent 70%),
    rgba(7, 10, 22, 0.62);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.04);
  transition:
    transform 220ms ease,
    border-color 220ms ease,
    background-color 220ms ease;
}

.benefit-card:hover {
  transform: translateY(-3px);
  border-color: rgba(167, 139, 250, 0.22);
}

.benefit-card--wide {
  grid-column: span 2;
}

.benefit-card__number {
  align-self: flex-end;
  color: rgba(255, 255, 255, 0.56);
  font-family: ui-monospace, monospace;
  font-size: 0.7rem;
}

.benefit-card__icon {
  width: 2.6rem;
  height: 2.6rem;
  margin-top: 1rem;
  display: grid;
  place-items: center;
  color: #c4b5fd;
  border: 1px solid rgba(167, 139, 250, 0.18);
  border-radius: 0.75rem;
  background: rgba(124, 92, 228, 0.1);
  font-size: 1.1rem;
}

.benefit-card h3,
.framework-card h3 {
  margin-top: auto;
  color: rgba(255, 255, 255, 0.92);
  font-size: 1.15rem;
  line-height: 1.25;
  letter-spacing: -0.025em;
}

.benefit-card p,
.framework-card p {
  margin-top: 0.65rem;
  color: rgba(255, 255, 255, 0.64);
  font-size: 0.82rem;
  line-height: 1.6;
}

.state-row,
.layer-row {
  margin-top: 1.1rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.state-row span,
.layer-row span {
  padding: 0.38rem 0.55rem;
  color: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.035);
  font-family: ui-monospace, monospace;
  font-size: 0.62rem;
}

.state-row span:first-child {
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.15);
  background: rgba(34, 197, 94, 0.07);
}

.layer-row b {
  color: rgba(255, 255, 255, 0.54);
  font-weight: 400;
}

.install-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(390px, 0.78fr);
  align-items: center;
  gap: clamp(3rem, 8vw, 7rem);
}

.package-switch {
  width: fit-content;
  margin: 2rem 0 0.8rem;
  padding: 0.28rem;
  display: flex;
  gap: 0.2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.035);
}

.package-switch button {
  min-width: 5rem;
  padding: 0.45rem 0.7rem;
  color: rgba(255, 255, 255, 0.64);
  border-radius: 0.48rem;
  font-size: 0.75rem;
  font-weight: 750;
}

.package-switch button.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
}

.comparison-card {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 1.2rem;
  background: rgba(7, 10, 22, 0.72);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.25);
}

.comparison-card__head,
.comparison-card__row {
  display: grid;
  grid-template-columns: 1fr 0.35fr 0.35fr;
  gap: 0.7rem;
  align-items: center;
}

.comparison-card__head {
  padding: 0.85rem 1rem;
  color: rgba(255, 255, 255, 0.64);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.comparison-card__row {
  min-height: 3.6rem;
  padding: 0.75rem 1rem;
  color: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 0.76rem;
}

.comparison-card__native {
  color: rgba(255, 255, 255, 0.64);
}

.comparison-card__kit {
  color: #86efac;
}

.comparison-card > p {
  padding: 1rem;
  color: rgba(255, 255, 255, 0.64);
  background: rgba(255, 255, 255, 0.02);
  font-size: 0.72rem;
  line-height: 1.55;
}

.api-section :deep(.tools) {
  width: 100%;
}

.framework-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.framework-card {
  min-height: 235px;
  padding: 1.3rem;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 1rem;
  background: rgba(7, 10, 22, 0.56);
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
}

.framework-card:hover,
.framework-card:focus-visible {
  transform: translateY(-3px);
  border-color: rgba(167, 139, 250, 0.25);
  background: rgba(12, 16, 32, 0.74);
}

.framework-card--planned {
  background: rgba(7, 10, 22, 0.36);
}

.framework-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.framework-card__monogram {
  width: 2.8rem;
  height: 2.8rem;
  display: grid;
  place-items: center;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 0.8rem;
  background: linear-gradient(
    145deg,
    rgba(122, 92, 230, 0.34),
    rgba(67, 127, 206, 0.14)
  );
  font-size: 0.8rem;
  font-weight: 850;
}

.framework-card__status {
  padding: 0.3rem 0.5rem;
  color: rgba(255, 255, 255, 0.64);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.framework-card--available .framework-card__status {
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.14);
  background: rgba(34, 197, 94, 0.06);
}

.framework-card__link {
  margin-top: 1rem;
  color: rgba(188, 174, 255, 0.8);
  font-size: 0.7rem;
  font-weight: 750;
}

.privacy-card {
  min-height: 390px;
  padding: clamp(2rem, 5vw, 4rem);
  display: grid;
  grid-template-columns: 0.65fr 1fr;
  align-items: center;
  gap: 4rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.4rem;
  background:
    radial-gradient(
      circle at 18% 50%,
      rgba(92, 75, 196, 0.18),
      transparent 35%
    ),
    rgba(7, 10, 22, 0.68);
}

.privacy-card__visual {
  position: relative;
  min-height: 230px;
  display: grid;
  place-items: center;
}

.privacy-ring {
  position: absolute;
  width: 230px;
  height: 230px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 50%;
  animation: ring-breathe 7s ease-in-out infinite alternate;
}

.privacy-ring--two {
  width: 160px;
  height: 160px;
  border-color: rgba(94, 234, 212, 0.16);
  animation-delay: -3.5s;
}

.privacy-lock {
  width: 5.2rem;
  height: 5.2rem;
  display: grid;
  place-items: center;
  color: #d8d0ff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 1.4rem;
  background: rgba(100, 78, 203, 0.18);
  box-shadow: 0 0 60px rgba(124, 92, 228, 0.22);
  font-size: 2.2rem;
}

.text-link {
  margin-top: 1.5rem;
  display: inline-flex;
  color: #c4b5fd;
  font-size: 0.82rem;
  font-weight: 750;
}

.final-cta {
  padding-bottom: clamp(5rem, 9vw, 8rem);
  text-align: center;
}

.final-cta > p:not(.section-kicker) {
  max-width: 620px;
  margin-inline: auto;
}

.final-cta__actions {
  justify-content: center;
}

@keyframes beam-scan {
  from {
    transform: rotate(24deg) translate3d(-18px, -12%, 0);
    opacity: 0.16;
  }

  to {
    transform: rotate(24deg) translate3d(24px, 12%, 0);
    opacity: 0.42;
  }
}

@keyframes glow-breathe {
  from {
    transform: translate3d(-2%, 1%, 0) scale(0.96);
    opacity: 0.62;
  }

  to {
    transform: translate3d(3%, -2%, 0) scale(1.06);
    opacity: 1;
  }
}

@keyframes status-pulse {
  0%,
  100% {
    opacity: 0.7;
    transform: scale(0.92);
  }

  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes ring-breathe {
  from {
    transform: rotate(-7deg) scale(0.94);
    opacity: 0.55;
  }

  to {
    transform: rotate(7deg) scale(1.04);
    opacity: 1;
  }
}

@keyframes card-reveal {
  from {
    translate: 0 24px;
    scale: 0.985;
  }

  to {
    translate: 0 0;
    scale: 1;
  }
}

@supports (animation-timeline: view()) {
  .comparison-card,
  .privacy-card,
  .benefit-card,
  .framework-card {
    animation: card-reveal linear both;
    animation-timeline: view();
    animation-range: entry 5% cover 24%;
  }
}

@media (max-width: 980px) {
  .hero {
    grid-template-columns: 1fr;
    padding-top: 5.5rem;
  }

  .hero__copy {
    max-width: 780px;
  }

  .hero__product {
    width: min(620px, 100%);
    margin-inline: auto;
    transform: none;
  }

  .benefit-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .install-section {
    grid-template-columns: 1fr;
  }

  .comparison-card {
    max-width: 650px;
  }
}

@media (max-width: 760px) {
  .hero,
  .content-section,
  .trust-strip {
    width: min(100% - 1.25rem, 1180px);
  }

  .hero {
    min-height: auto;
    padding-top: 4.25rem;
  }

  .hero::before {
    inset-inline: -2rem;
    mask-image: radial-gradient(ellipse at 50% 30%, #000 0%, transparent 72%);
  }

  .hero__beam-field {
    inset: 12% -3rem 28% 20%;
    opacity: 0.55;
  }

  .hero h1 {
    font-size: clamp(2.75rem, 11vw, 4rem);
  }

  .hero__product {
    border-radius: 1rem;
  }

  .hero__chat {
    min-height: 300px;
    padding: 1rem;
  }

  .trust-strip {
    gap: 0.8rem 1rem;
  }

  .trust-strip i {
    display: none;
  }

  .section-heading--split,
  .privacy-card {
    grid-template-columns: 1fr;
  }

  .section-heading--split {
    gap: 1rem;
  }

  .benefit-grid,
  .framework-grid {
    grid-template-columns: 1fr;
  }

  .benefit-card--wide {
    grid-column: auto;
  }

  .benefit-card {
    min-height: 285px;
  }

  .framework-card {
    min-height: 230px;
  }

  .privacy-card {
    gap: 1rem;
  }

  .privacy-card__visual {
    min-height: 220px;
  }
}

@media (max-width: 460px) {
  .eyebrow {
    font-size: 0.62rem;
    letter-spacing: 0.08em;
  }

  .hero__actions,
  .hero__actions .button {
    width: 100%;
  }

  .hero__product-top > span:nth-child(2) {
    display: none;
  }

  .hero__message {
    max-width: 96%;
  }

  .comparison-card__head,
  .comparison-card__row {
    grid-template-columns: 1fr 0.45fr 0.5fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero__beam-field i,
  .hero__glow,
  .eyebrow__dot,
  .live-pill i,
  .privacy-ring,
  .comparison-card,
  .privacy-card,
  .benefit-card,
  .framework-card {
    animation: none;
  }

  .hero__product,
  .button,
  .benefit-card,
  .framework-card {
    transform: none;
  }
}
</style>
