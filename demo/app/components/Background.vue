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
    radial-gradient(circle at 82% 24%, rgba(198, 61, 213, 0.24), transparent 34%),
    radial-gradient(circle at 48% 92%, rgba(56, 114, 190, 0.2), transparent 42%),
    linear-gradient(145deg, #04060c 0%, #080b16 48%, #050710 100%);
}

.background::before,
.background::after {
  position: absolute;
  inset: -35%;
  content: '';
  transform: rotate(-11deg);
  opacity: 0.18;
  background: repeating-linear-gradient(
    112deg,
    transparent 0 42px,
    rgba(134, 154, 255, 0.24) 43px,
    transparent 45px 74px
  );
  mask-image: radial-gradient(ellipse at center, #000 0%, transparent 68%);
  will-change: transform;
  animation: thread-drift 22s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
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
  animation-name: thread-drift-reverse;
  animation-duration: 28s;
}

@keyframes thread-drift {
  from {
    transform: rotate(-11deg) translate3d(-2%, -1%, 0) scale(1);
  }

  to {
    transform: rotate(-7deg) translate3d(3%, 2%, 0) scale(1.04);
  }
}

@keyframes thread-drift-reverse {
  from {
    transform: rotate(17deg) translate3d(12%, 8%, 0) scale(1.03);
  }

  to {
    transform: rotate(13deg) translate3d(6%, 2%, 0) scale(0.98);
  }
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

@media (prefers-reduced-motion: reduce) {
  .background::before,
  .background::after {
    animation: none;
    will-change: auto;
  }
}
</style>
