import { onBeforeUnmount, onMounted, type Ref, watch } from 'vue';

interface ToolLifecycleOptions<CreateOptions> {
  availability: Ref<Availability | null>;
  createOptions: Ref<CreateOptions>;
  autoInit: () => boolean;
  requestAvailability: (options: CreateOptions) => Promise<Availability>;
  dispose: () => void;
  onAvailability: (availability: Availability) => void;
}

export const useToolLifecycle = <CreateOptions>({
  availability,
  createOptions,
  autoInit,
  requestAvailability,
  dispose,
  onAvailability
}: ToolLifecycleOptions<CreateOptions>) => {
  const refreshAvailability = async () => {
    if (!autoInit()) return null;
    return requestAvailability(createOptions.value);
  };

  watch(
    availability,
    (value) => {
      if (value) onAvailability(value);
    },
    { immediate: true }
  );

  watch(createOptions, refreshAvailability, { deep: true });
  onMounted(refreshAvailability);
  onBeforeUnmount(dispose);

  return { refreshAvailability };
};
