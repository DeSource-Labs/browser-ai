(() => {
  const packageExamples = {
    vue: {
      label: "Vue quick start",
      code: `npm install @desource/browser-ai-vue

<script setup lang="ts">
import { PromptApi } from "@desource/browser-ai-vue";
import "@desource/browser-ai-vue/assets/lib.css";
</script>

<template>
  <PromptApi context-strategy="summarize" />
</template>`,
    },
    nuxt: {
      label: "Nuxt quick start",
      code: `npm install @desource/browser-ai-nuxt

// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@desource/browser-ai-nuxt"],
});

// PromptApi and usePromptApi are now auto-imported.`,
    },
  };

  const availabilityLabel = (status) => {
    if (status === "available") return "Ready now";
    if (status === "downloadable") return "Download first";
    if (status === "downloading") return "Downloading";
    return "Not enabled";
  };

  const setAvailability = (id, status) => {
    const badge = document.querySelector(`[data-api="${id}"] .tools__badge`);
    if (!badge) return;
    badge.className = `tools__badge tools__badge--${status}`;
    const dot = document.createElement("i");
    dot.setAttribute("aria-hidden", "true");
    badge.replaceChildren(
      dot,
      document.createTextNode(` ${availabilityLabel(status)}`),
    );
    badge.dataset.nativeChecked = "true";
  };

  const checkAvailability = async (id, constructorName, options) => {
    const constructor = globalThis[constructorName];
    if (typeof constructor?.availability !== "function") {
      setAvailability(id, "unavailable");
      return;
    }

    try {
      setAvailability(id, await constructor.availability(options));
    } catch {
      setAvailability(id, "unavailable");
    }
  };

  const checkNativeApis = () => {
    const tools = document.querySelector(".tools");
    if (!tools || tools.dataset.nativeChecked === "true") return;
    tools.dataset.nativeChecked = "true";

    setAvailability(
      "webmcp",
      document.modelContext ? "available" : "unavailable",
    );
    void checkAvailability("prompt-api", "LanguageModel");
    void checkAvailability("summarizer", "Summarizer");
    void checkAvailability("writer", "Writer");
    void checkAvailability("rewriter", "Rewriter");
    void checkAvailability("language-detector", "LanguageDetector");
    void checkAvailability("proofreader", "Proofreader");
    void checkAvailability("translator", "Translator", {
      sourceLanguage: "en",
      targetLanguage: "fr",
    });
  };

  const setupHeroMotion = () => {
    const hero = document.querySelector(".hero");
    if (!(hero instanceof HTMLElement) || hero.dataset.motionReady === "true")
      return;
    hero.dataset.motionReady = "true";

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;

    let frame = 0;
    let nextX = 0;
    let nextY = 0;

    const render = () => {
      const bounds = hero.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (nextX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (nextY - bounds.top) / bounds.height));
      hero.style.setProperty("--pointer-x", `${(x * 100).toFixed(1)}%`);
      hero.style.setProperty("--pointer-y", `${(y * 100).toFixed(1)}%`);
      hero.style.setProperty("--tilt-x", `${((0.5 - y) * 2.4).toFixed(2)}deg`);
      hero.style.setProperty("--tilt-y", `${((x - 0.5) * 4.2).toFixed(2)}deg`);
      frame = 0;
    };

    hero.addEventListener(
      "pointermove",
      (event) => {
        nextX = event.clientX;
        nextY = event.clientY;
        if (!frame) frame = window.requestAnimationFrame(render);
      },
      { passive: true },
    );

    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--pointer-x", "72%");
      hero.style.setProperty("--pointer-y", "28%");
      hero.style.setProperty("--tilt-x", "1deg");
      hero.style.setProperty("--tilt-y", "-3deg");
    });
  };

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const copyButton = target.closest("[data-copy-code]");
    if (copyButton instanceof HTMLButtonElement) {
      const code = copyButton.closest(".code-block")?.querySelector("code");
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.textContent || "");
        copyButton.textContent = "Copied";
        copyButton.setAttribute("aria-label", "Copied code");
        window.setTimeout(() => {
          copyButton.textContent = "Copy";
          copyButton.setAttribute("aria-label", "Copy code");
        }, 1800);
      } catch {
        copyButton.textContent = "Select to copy";
      }
      return;
    }

    const packageButton = target.closest("[data-package-tab]");
    if (!(packageButton instanceof HTMLButtonElement)) return;
    const key = packageButton.dataset.packageTab;
    const example = key ? packageExamples[key] : undefined;
    const container = packageButton.closest(".install-section__copy");
    if (!example || !container) return;

    container
      .querySelectorAll("[data-package-tab]")
      .forEach((button) =>
        button.classList.toggle("active", button === packageButton),
      );
    const label = container.querySelector(".code-block__bar > span");
    const code = container.querySelector(".code-block code");
    if (label) label.textContent = example.label;
    if (code) code.textContent = example.code;
  });

  const start = () => {
    checkNativeApis();
    setupHeroMotion();
    new MutationObserver(() => {
      checkNativeApis();
      setupHeroMotion();
    }).observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
