<template>
  <div class="tools">
    <LiquidGlass height="500px">
      <div class="tools-container">
        <!-- Header with dropdown and status -->
        <div class="tools-header">
          <ToolDropdown v-model="selected" :items="ToolItems" />
          <div class="tools-status">
            <span
              class="tools-status__badge"
              :class="{
                'tools-status__badge--unavailable': availability === 'unavailable',
                'tools-status__badge--downloadable': availability === 'downloadable',
                'tools-status__badge--downloading': availability === 'downloading',
                'tools-status__badge--available': availability === 'available',
              }"
            >
              <svg v-if="availability === 'available'" class="tools-status__icon" viewBox="0 0 16 16" width="14" height="14">
                <path d="M13.78 2.22A.75.75 0 1 0 12.22.66L6.5 6.38 3.78 3.66A.75.75 0 0 0 2.22 5.22l3.5 3.5a.75.75 0 0 0 1.06 0l7-7Z" fill="currentColor" />
              </svg>
              <svg v-else-if="availability === 'downloading'" class="tools-status__icon tools-status__icon--spinning" viewBox="0 0 16 16" width="14" height="14">
                <path d="M8 1a7 7 0 1 0 7 7h-1.5A5.5 5.5 0 1 1 8 2.5V1Z" fill="currentColor" />
              </svg>
              <svg v-else-if="availability === 'downloadable'" class="tools-status__icon" viewBox="0 0 16 16" width="14" height="14">
                <path d="M2.75 9.5a.75.75 0 0 1 .75.75v2.5h9.5v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-2.5a.75.75 0 0 1 .75-.75ZM8 1.75a.75.75 0 0 1 .75.75v7.69l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V2.5a.75.75 0 0 1 .75-.75Z" fill="currentColor" />
              </svg>
              <svg v-else-if="availability === 'unavailable'" class="tools-status__icon" viewBox="0 0 16 16" width="14" height="14">
                <path d="M3.72 3.72a.75.75 0 1 0-1.06 1.06L6.94 8l-4.28 4.28a.75.75 0 1 0 1.06 1.06L8 9.06l4.28 4.28a.75.75 0 1 0 1.06-1.06L9.06 8l4.28-4.28a.75.75 0 0 0-1.06-1.06L8 6.94 3.72 2.66Z" fill="currentColor" />
              </svg>
              <span class="tools-status__text">{{ availability }}</span>
            </span>
          </div>
        </div>

        <!-- Description -->
        <div class="tools-description">
          {{ selectedTool.description }}
        </div>

        <!-- Interactive tool content -->
        <div class="tool">
          <PromptApi
            v-if="selected === 'prompt-api'"
            @availability-change="handleAvailabilityChange"
          />
        </div>
      </div>
    </LiquidGlass>
  </div>
</template>

<script setup lang="ts">
const selected = ref<Tool>('prompt-api');
const selectedTool = computed(() => ToolItems.find(item => item.id === selected.value)!);

const availability = ref<Availability>('unavailable');

const handleAvailabilityChange = (value: Availability) => {
  availability.value = value;
};
</script>

<style scoped lang="scss">
.tools {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;
  min-width: 400px;

  &-container {
    height: 100%;
    width: 100%;
    padding: 0.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
  }

  &-header {
    flex-shrink: 0;
    pointer-events: all;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }

  &-status {
    &__badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.85rem;
      font-weight: 500;
      white-space: nowrap;
      transition: all 0.3s ease;

      &--available {
        background-color: rgba(34, 197, 94, 0.15);
        color: rgba(134, 239, 172, 1);
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      &--downloadable {
        background-color: rgba(59, 130, 246, 0.15);
        color: rgba(147, 197, 253, 1);
        border: 1px solid rgba(59, 130, 246, 0.3);
      }

      &--downloading {
        background-color: rgba(251, 146, 60, 0.15);
        color: rgba(254, 215, 170, 1);
        border: 1px solid rgba(251, 146, 60, 0.3);
      }

      &--unavailable {
        background-color: rgba(239, 68, 68, 0.15);
        color: rgba(252, 165, 165, 1);
        border: 1px solid rgba(239, 68, 68, 0.3);
      }
    }

    &__icon {
      flex-shrink: 0;
      opacity: 0.9;

      &--spinning {
        animation: spin 1s linear infinite;
      }
    }

    &__text {
      text-transform: capitalize;
    }
  }

  &-description {
    flex-shrink: 0;
    pointer-events: all;
    color: var(--color-secondary);
    font-size: 0.95rem;
    line-height: 1.5;
  }
}

.tool {
  flex: 1;
  min-height: 0;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 480px) {
  .tools {
    flex: 1;

    &-header {
      flex-direction: column;
      align-items: stretch;

      :deep(.dropdown) {
        max-width: 100%;
      }
    }
  }
}

@media (max-width: 412px) {
  .tools {
    min-width: unset;
  }
}
</style>
