<template>
  <div class="tools">
    <LiquidGlass width="100%" height="clamp(500px, 58svh, 650px)">
      <div class="tools__table-wrap">
        <table class="tools__table" aria-label="Browser AI Kit API statuses">
          <thead>
            <tr>
              <th scope="col">API</th>
              <th scope="col">Browser</th>
              <th scope="col">Demo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in apiRows" :key="item.id">
              <td>
                <div class="tools__api">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.description }}</span>
                </div>
              </td>
              <td>
                <span class="tools__badge" :class="`tools__badge--${item.availability}`">
                  {{ getAvailabilityLabel(item.availability) }}
                </span>
              </td>
              <td>
                <NuxtLink v-if="item.openable" class="tools__action" :to="item.href">Open</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </LiquidGlass>
  </div>
</template>

<script setup lang="ts">
type DemoAvailability = Availability | 'checking';

type ApiRow = ToolItem & {
  availability: DemoAvailability;
};

const promptApiAvailability = ref<DemoAvailability>('checking');
const summarizerAvailability = ref<DemoAvailability>('checking');
const writerAvailability = ref<DemoAvailability>('checking');
const rewriterAvailability = ref<DemoAvailability>('checking');
const translatorAvailability = ref<DemoAvailability>('checking');
const languageDetectorAvailability = ref<DemoAvailability>('checking');
const proofreaderAvailability = ref<DemoAvailability>('checking');
const { checkAvailability: checkPromptApiAvailability } = usePromptApi();
const { checkAvailability: checkSummarizerAvailability } = useSummarizer();
const { checkAvailability: checkWriterAvailability } = useWriter();
const { checkAvailability: checkRewriterAvailability } = useRewriter();
const { checkAvailability: checkTranslatorAvailability } = useTranslator();
const { checkAvailability: checkLanguageDetectorAvailability } = useLanguageDetector();
const { checkAvailability: checkProofreaderAvailability } = useProofreader();

const AvailableStatuses: DemoAvailability[] = ['available', 'downloadable', 'downloading'];

const getAvailabilityLabel = (status: DemoAvailability) => {
  switch (status) {
    case 'checking':
    case 'downloading':
    case 'available':
      return status;
    case 'downloadable':
      return 'Needs download';
    default:
      return 'Not available';
  }
};

const canOpenDemo = (availability: DemoAvailability) => AvailableStatuses.includes(availability);

const apiRows = computed<ApiRow[]>(() => {
  return ToolItems.map((item) => {
    let availability: DemoAvailability = 'unavailable';
    let openable = false;
    switch (item.id) {
      case 'prompt-api':
        availability = promptApiAvailability.value;
        openable = canOpenDemo(promptApiAvailability.value);
        break;
      case 'summarizer':
        availability = summarizerAvailability.value;
        openable = canOpenDemo(summarizerAvailability.value);
        break;
      case 'writer':
        availability = writerAvailability.value;
        openable = canOpenDemo(writerAvailability.value);
        break;
      case 'rewriter':
        availability = rewriterAvailability.value;
        openable = canOpenDemo(rewriterAvailability.value);
        break;
      case 'translator':
        availability = translatorAvailability.value;
        openable = canOpenDemo(translatorAvailability.value);
        break;
      case 'language-detector':
        availability = languageDetectorAvailability.value;
        openable = canOpenDemo(languageDetectorAvailability.value);
        break;
      case 'proofreader':
        availability = proofreaderAvailability.value;
        openable = canOpenDemo(proofreaderAvailability.value);
        break;
    }
    return {
      ...item,
      availability,
      openable,
    };
  });
});

onMounted(async () => {
  const [
    promptStatus,
    summarizerStatus,
    writerStatus,
    rewriterStatus,
    translatorStatus,
    languageDetectorStatus,
    proofreaderStatus
  ] = await Promise.allSettled([
    checkPromptApiAvailability(),
    checkSummarizerAvailability(),
    checkWriterAvailability(),
    checkRewriterAvailability(),
    checkTranslatorAvailability(),
    checkLanguageDetectorAvailability(),
    checkProofreaderAvailability()
  ]);

  promptApiAvailability.value = promptStatus.status === 'fulfilled'
    ? promptStatus.value
    : 'unavailable';

  summarizerAvailability.value = summarizerStatus.status === 'fulfilled'
    ? summarizerStatus.value
    : 'unavailable';

  writerAvailability.value = writerStatus.status === 'fulfilled'
    ? writerStatus.value
    : 'unavailable';

  rewriterAvailability.value = rewriterStatus.status === 'fulfilled'
    ? rewriterStatus.value
    : 'unavailable';

  translatorAvailability.value = translatorStatus.status === 'fulfilled'
    ? translatorStatus.value
    : 'unavailable';

  languageDetectorAvailability.value = languageDetectorStatus.status === 'fulfilled'
    ? languageDetectorStatus.value
    : 'unavailable';

  proofreaderAvailability.value = proofreaderStatus.status === 'fulfilled'
    ? proofreaderStatus.value
    : 'unavailable';
});
</script>

<style scoped>
.tools {
  width: min(1280px, calc(100vw - 3rem));
  pointer-events: all;
}

.tools__table-wrap {
  height: 100%;
  min-height: 0;
  overflow: auto;
  border-radius: 20px;
  background: rgba(7, 10, 18, 0.5);
}

.tools__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.tools__table th,
.tools__table td {
  padding: 0.78rem 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  vertical-align: middle;
  text-align: left;
}

.tools__table tr:last-child td {
  border-bottom: none;
}

.tools__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: rgba(255, 255, 255, 0.66);
  background: rgba(10, 13, 24, 0.92);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.tools__table th:nth-child(1),
.tools__table td:nth-child(1) {
  width: 52%;
}

.tools__table th:nth-child(2),
.tools__table td:nth-child(2) {
  width: 18%;
}

.tools__table th:nth-child(3),
.tools__table td:nth-child(3) {
  width: 17%;
}

.tools__table th:nth-child(4),
.tools__table td:nth-child(4) {
  width: 13%;
}

.tools__api {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
}

.tools__api strong {
  color: var(--color-primary);
  font-size: 0.95rem;
  line-height: 1.25;
}

.tools__api span {
  color: var(--color-secondary);
  font-size: 0.8rem;
  line-height: 1.35;
}

.tools__badge,
.tools__action {
  min-height: 1.9rem;
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.34rem 0.58rem;
  border-radius: 0.52rem;
  font-size: 0.78rem;
  font-weight: 750;
  white-space: nowrap;
}

.tools__badge {
  border: 1px solid rgba(120, 120, 120, 0.3);
  text-transform: capitalize;
}

.tools__badge--available {
  background: rgba(34, 197, 94, 0.15);
  color: rgba(134, 239, 172, 1);
  border-color: rgba(34, 197, 94, 0.3);
}

.tools__badge--downloadable,
.tools__badge--checking {
  background: rgba(59, 130, 246, 0.15);
  color: rgba(147, 197, 253, 1);
  border-color: rgba(59, 130, 246, 0.3);
}

.tools__badge--downloading {
  background: rgba(251, 146, 60, 0.15);
  color: rgba(254, 215, 170, 1);
  border-color: rgba(251, 146, 60, 0.3);
}

.tools__badge--unavailable {
  background: rgba(239, 68, 68, 0.15);
  color: rgba(252, 165, 165, 1);
  border-color: rgba(239, 68, 68, 0.3);
}

.tools__kit-status,
.tools__muted {
  color: var(--color-secondary);
  font-size: 0.84rem;
}

.tools__action {
  justify-content: center;
  color: var(--color-primary);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
}

@media (max-width: 760px) {
  .tools {
    width: min(100%, calc(100vw - 2rem));
  }

  .tools__table {
    min-width: 760px;
  }
}
</style>
