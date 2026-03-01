<template>
  <div class="tools">
    <LiquidGlass height="500px">
      <div class="tools-container">
        <div class="tools-selector">
          <button
            v-for="item in ToolItems"
            :key="item.id"
            class="tools-item"
            :class="{ selected: selected === item.id }"
            @click="onSelected(item.id)"
          >
            {{ item.name }}
          </button>
        </div>
        <div class="tool">
          <p class="tool__description">{{ selectedTool.description }}</p>
          <div class="tool__status">
            Status:
            <span
              :class="{
                unavailable: availability === 'unavailable',
                downloadable: availability === 'downloadable',
                downloading: availability === 'downloading',
                available: availability === 'available',
              }"
            >
              {{ availability }}
            </span>
          </div>
        </div>
        <div class="tools-links">
          <a :href="'#'" target="_blank" rel="noopener noreferrer" class="animated-link p4">
            Documentation
          </a>
          |
          <a :href="'#'" target="_blank" rel="noopener noreferrer" class="animated-link p4">
            View on NPM
          </a>
        </div>
      </div>
    </LiquidGlass>
  </div>
</template>

<script setup lang="ts">
const selected = ref<Tool>('prompt-api');
const selectedTool = computed(() => ToolItems.find(item => item.id === selected.value)!);
// const availability = ref<'unavailable' | 'downloadable' | 'downloading' | 'available'>('available');

const { availability, init, create, dispose, prompt, isReady, processing } = usePromptApi();

const onSelected = (tool: Tool) => {
  if (tool === selected.value) return;
  selected.value = tool;
}

onMounted(async () => {
  await init();
  await new Promise(resolve => setTimeout(resolve, 5_000));
  await create();
});

onBeforeUnmount(async () => {
  dispose();
});

watch(isReady, (newVal) => {
  console.log('Prompt API is ready:', newVal);
});
watch(processing, (newVal) => {
  console.log('Prompt API is processing:', newVal);
});
watch(availability, (newVal) => {
  console.log('Prompt API availability changed to:', newVal);
});
</script>

<style scoped lang="scss">
.tools {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;
  min-width: 400px;

  &-container {
    padding: 0.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1rem;
  }

  &-selector {
    pointer-events: all;
    display: flex;
    justify-content: space-between;
  }

  &-links {
    pointer-events: all;
    text-align: center;
    font-size: 0.9rem;
    color: var(--color-secondary);
  }
}

.tools-item {
  flex: 1;
  text-align: center;
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--color-primary);
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #5555555e;
  }

  &.selected {
    background-color: #444444b8;
  }

  &:not(:last-child) {
    border-right: 1px solid #444444b8;
  }

  &:first-child {
    border-top-left-radius: 1rem;
    border-bottom-left-radius: 1rem;
  }

  &:last-child {
    border-top-right-radius: 1rem;
    border-bottom-right-radius: 1rem;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.tool {}

@media (max-width: 480px) {
  .tools {
    flex: 1;
  }
}
@media (max-width: 412px) {
  .tools {
    min-width: unset;
  }
}
</style>
