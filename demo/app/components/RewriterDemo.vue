<template>
  <div class="rewriter-demo">
    <LiquidGlass width="100%" height="100%">
      <div class="rewriter-demo__tool">
        <Rewriter placeholder="Paste text that should become clearer, shorter, longer, more formal, or more casual..." />
      </div>
    </LiquidGlass>
  </div>
</template>

<style scoped>
.rewriter-demo {
  width: min(1920px, calc(100vw - 2rem));
  height: 100%;
  min-height: 0;
  pointer-events: all;
}

.rewriter-demo__tool {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0.5rem;
  box-sizing: border-box;
}

@media (max-width: 760px) {
  .rewriter-demo {
    width: min(100%, calc(100vw - 1rem));
  }

  .rewriter-demo__tool {
    padding: 0.35rem;
  }
}
</style>
