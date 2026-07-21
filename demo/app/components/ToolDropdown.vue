<template>
  <div class="dropdown">
    <button class="dropdown__trigger" @click="isOpen = !isOpen" @blur="handleBlur">
      <span class="dropdown__label">{{ selectedLabel }}</span>
      <svg
        class="dropdown__icon"
        :class="{ 'dropdown__icon--open': isOpen }"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path
          d="M4 6L8 10L12 6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <Transition name="dropdown-fade">
      <div v-if="isOpen" class="dropdown__menu">
        <button
          v-for="item in items"
          :key="item.id"
          class="dropdown__item"
          :class="{ 'dropdown__item--selected': modelValue === item.id }"
          @click="selectItem(item.id)"
        >
          {{ item.name }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string;
  items: typeof ToolItems;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Select...'
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const isOpen = ref(false);

const selectedLabel = computed(() => {
  const item = props.items.find((item) => item.id === props.modelValue);
  return item?.name || props.label;
});

const selectItem = (id: string) => {
  emit('update:modelValue', id);
  isOpen.value = false;
};

const handleBlur = () => {
  setTimeout(() => {
    isOpen.value = false;
  }, 100);
};
</script>

<style scoped lang="scss">
.dropdown {
  position: relative;
  width: 100%;
  max-width: 300px;
  pointer-events: all;

  &__trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background-color: rgba(68, 68, 68, 0.45);
    border: 1px solid rgba(68, 68, 68, 0.7);
    border-radius: 0.75rem;
    color: var(--color-primary);
    cursor: pointer;
    font-size: 0.95rem;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);

    &:hover {
      background-color: rgba(85, 85, 85, 0.6);
      border-color: rgba(100, 100, 100, 0.8);
    }

    &:focus {
      outline: none;
      background-color: rgba(100, 100, 100, 0.7);
    }
  }

  &__label {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__icon {
    flex-shrink: 0;
    transition: transform 0.3s ease;

    &--open {
      transform: rotate(180deg);
    }
  }

  &__menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    z-index: 10;
    background-color: rgba(40, 40, 40, 0.9);
    border: 1px solid rgba(68, 68, 68, 0.7);
    border-radius: 0.75rem;
    overflow: hidden;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  &__item {
    width: 100%;
    display: block;
    padding: 0.75rem 1rem;
    background-color: transparent;
    border: none;
    color: var(--color-primary);
    text-align: left;
    cursor: pointer;
    font-size: 0.95rem;
    transition: all 0.2s ease;

    &:not(:last-child) {
      border-bottom: 1px solid rgba(68, 68, 68, 0.5);
    }

    &:hover {
      background-color: rgba(85, 85, 85, 0.5);
    }

    &--selected {
      background-color: rgba(68, 68, 68, 0.8);
      font-weight: 500;
    }
  }
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
