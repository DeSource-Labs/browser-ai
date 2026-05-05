<template>
  <div class="summarizer-demo">
    <LiquidGlass width="100%" height="100%">
      <div class="summarizer-demo__tool">
        <Summarizer
          placeholder="Paste a long article, transcript, document, or chat conversation to summarize..."
        />
      </div>
    </LiquidGlass>
  </div>
</template>

<style scoped>
.summarizer-demo {
  width: min(1920px, calc(100vw - 2rem));
  height: 100%;
  min-height: 0;
  pointer-events: all;
}

.summarizer-demo__tool {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0.5rem;
  box-sizing: border-box;
}

@media (max-width: 760px) {
  .summarizer-demo {
    width: min(100%, calc(100vw - 1rem));
  }

  .summarizer-demo__tool {
    padding: 0.35rem;
  }
}
</style>
