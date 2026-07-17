<template>
  <div class="code-block">
    <div class="code-block__bar">
      <span>{{ label }}</span>
      <button
        type="button"
        class="code-block__copy"
        data-copy-code
        aria-label="Copy code"
        @click="copyCode"
      >
        {{ copyLabel }}
      </button>
    </div>
    <pre><code>{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string;
  code: string;
}>();

const copyLabel = ref("Copy");
let resetTimer: ReturnType<typeof setTimeout> | undefined;

const copyCode = async () => {
  if (!navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(props.code);
    copyLabel.value = "Copied";
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copyLabel.value = "Copy";
    }, 1800);
  } catch {
    copyLabel.value = "Select to copy";
  }
};

onBeforeUnmount(() => {
  if (resetTimer) clearTimeout(resetTimer);
});
</script>
