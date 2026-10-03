import { computed, ref, watch } from 'vue';

export const useLanguageList = (getLanguages: () => string[] | undefined) => {
  const text = ref((getLanguages() ?? []).join(', '));
  const languages = computed(() =>
    text.value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
  watch(getLanguages, (value) => {
    text.value = (value ?? []).join(', ');
  });
  return { text, languages };
};
