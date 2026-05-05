<template>
  <div class="writer-demo">
    <LiquidGlass width="100%" height="100%">
      <div class="writer-demo__tool">
        <Writer placeholder="Describe the email, review, blog intro, support request, or draft you need..." />
      </div>
    </LiquidGlass>
  </div>
</template>

<style scoped>
.writer-demo {
  width: min(1920px, calc(100vw - 2rem));
  height: 100%;
  min-height: 0;
  pointer-events: all;
}

.writer-demo__tool {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0.5rem;
  box-sizing: border-box;
}

@media (max-width: 760px) {
  .writer-demo {
    width: min(100%, calc(100vw - 1rem));
  }

  .writer-demo__tool {
    padding: 0.35rem;
  }
}
</style>
