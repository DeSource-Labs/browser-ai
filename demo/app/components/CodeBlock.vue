<template>
  <div class="code-block">
    <div class="code-block__bar">
      <span>{{ label }}</span>
      <button
        type="button"
        class="code-block__copy"
        data-copy-code
        aria-label="Copy code"
      >
        Copy
      </button>
    </div>
    <pre><code>{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  code: string;
}>();
</script>
