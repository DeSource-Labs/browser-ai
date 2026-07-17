<template>
  <div class="background" aria-hidden="true" />
</template>

<style scoped>
.background {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  contain: strict;
  background:
    radial-gradient(circle at 12% 14%, rgba(56, 88, 210, 0.3), transparent 38%),
    radial-gradient(
      circle at 82% 24%,
      rgba(198, 61, 213, 0.24),
      transparent 34%
    ),
    radial-gradient(
      circle at 48% 92%,
      rgba(56, 114, 190, 0.2),
      transparent 42%
    ),
    linear-gradient(145deg, #04060c 0%, #080b16 48%, #050710 100%);
}

.background::before,
.background::after {
  position: absolute;
  inset: -35%;
  content: "";
  transform: rotate(-11deg);
  opacity: 0.18;
  background: repeating-linear-gradient(
    112deg,
    transparent 0 42px,
    rgba(134, 154, 255, 0.24) 43px,
    transparent 45px 74px
  );
  mask-image: radial-gradient(ellipse at center, #000 0%, transparent 68%);
}

.background::after {
  transform: rotate(17deg) translate3d(12%, 8%, 0);
  opacity: 0.1;
  background: repeating-linear-gradient(
    72deg,
    transparent 0 60px,
    rgba(237, 102, 238, 0.28) 61px,
    transparent 63px 102px
  );
}

@media (forced-colors: active) {
  .background {
    background: Canvas;
  }

  .background::before,
  .background::after {
    display: none;
  }
}
</style>
