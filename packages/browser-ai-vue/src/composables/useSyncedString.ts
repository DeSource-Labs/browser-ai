import { ref, watch } from "vue";

export const useSyncedString = (
  getExternalValue: () => string,
  onInternalUpdate: (value: string) => void,
) => {
  const value = ref(getExternalValue());

  watch(value, onInternalUpdate);
  watch(getExternalValue, (externalValue) => {
    if (externalValue !== value.value) {
      value.value = externalValue;
    }
  });

  return value;
};
