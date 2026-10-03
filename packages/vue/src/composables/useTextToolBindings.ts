import { computed, type Ref } from 'vue';

interface TextToolProps {
  placeholder: string;
  emptyOutputMessage: string;
  disabled: boolean;
}

interface TextToolStatus {
  availability: Readonly<Ref<Availability | null>>;
  downloadProgress: Readonly<Ref<number>>;
  isProcessing: Readonly<Ref<boolean>>;
}

interface TextToolDisplay {
  settingsSummary: string;
  inputMeta: string;
  outputMeta: string;
  canRun: boolean;
  progressPercent: number;
  errorMessage: string;
}

export const useTextToolBindings = (props: TextToolProps, api: TextToolStatus, display: () => TextToolDisplay) =>
  computed(() => ({
    ...display(),
    placeholder: props.placeholder,
    emptyOutputMessage: props.emptyOutputMessage,
    disabled: props.disabled,
    availability: api.availability.value,
    downloadProgress: api.downloadProgress.value,
    busy: api.isProcessing.value
  }));
