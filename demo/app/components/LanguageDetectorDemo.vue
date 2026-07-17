<template>
  <div class="language-detector-demo">
    <LiquidGlass width="100%" height="100%">
      <div class="language-detector-demo__tool">
        <LanguageDetector
          placeholder="Paste text to detect its language with Chrome's local model..."
        />
      </div>
    </LiquidGlass>
  </div>
</template>

<style scoped>
.language-detector-demo {
  width: min(1920px, calc(100vw - 2rem));
  height: 100%;
  min-height: 0;
  pointer-events: all;
}

.language-detector-demo__tool {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0.5rem;
  box-sizing: border-box;
}

@media (max-width: 760px) {
  .language-detector-demo {
    width: min(100%, calc(100vw - 1rem));
  }

  .language-detector-demo__tool {
    padding: 0.35rem;
  }
}
</style>
