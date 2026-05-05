<template>
  <div class="proofreader-demo">
    <LiquidGlass width="100%" height="100%">
      <div class="proofreader-demo__tool">
        <Proofreader placeholder="Paste text to correct grammar, spelling, and punctuation with Chrome's local model..." />
      </div>
    </LiquidGlass>
  </div>
</template>

<style scoped>
.proofreader-demo {
  width: min(1920px, calc(100vw - 2rem));
  height: 100%;
  min-height: 0;
  pointer-events: all;
}

.proofreader-demo__tool {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0.5rem;
  box-sizing: border-box;
}

@media (max-width: 760px) {
  .proofreader-demo {
    width: min(100%, calc(100vw - 1rem));
  }

  .proofreader-demo__tool {
    padding: 0.35rem;
  }
}
</style>
