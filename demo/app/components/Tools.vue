<template>
  <div class="tools">
    <LiquidGlass width="100%" height="clamp(460px, 58svh, 650px)">
      <div class="tools__content">
        <div class="tools__summary">
          <div>
            <h2>Browser AI APIs</h2>
            <p>
              Framework helpers for Chrome's built-in AI APIs. Prompt API, Summarizer, Writer,
              Rewriter, Translator, and Language Detector are implemented now; the remaining APIs are listed as roadmap targets.
            </p>
          </div>
          <span class="tools__count">{{ availableCount }} available</span>
        </div>

        <div class="tools__table-wrap">
          <table class="tools__table" aria-label="Browser AI Kit API statuses">
            <thead>
              <tr>
                <th scope="col">API</th>
                <th scope="col">Browser</th>
                <th scope="col">Kit</th>
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
                  <span class="tools__kit-status">{{ item.kitStatus }}</span>
                </td>
                <td>
                  <NuxtLink v-if="item.href" class="tools__action" :to="item.href">
                    Open
                  </NuxtLink>
                  <span v-else class="tools__muted">Soon</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </LiquidGlass>
  </div>
</template>

<script setup lang="ts">
type DemoAvailability = Availability | 'checking';

type ApiRow = ToolItem & {
  availability: DemoAvailability;
  href: string;
  kitStatus: string;
};

const promptApiAvailability = ref<DemoAvailability>('checking');
const summarizerAvailability = ref<DemoAvailability>('checking');
const writerAvailability = ref<DemoAvailability>('checking');
const rewriterAvailability = ref<DemoAvailability>('checking');
const translatorAvailability = ref<DemoAvailability>('checking');
const languageDetectorAvailability = ref<DemoAvailability>('checking');
const { checkAvailability: checkPromptApiAvailability } = usePromptApi();
const { checkAvailability: checkSummarizerAvailability } = useSummarizer();
const { checkAvailability: checkWriterAvailability } = useWriter();
const { checkAvailability: checkRewriterAvailability } = useRewriter();
const { checkAvailability: checkTranslatorAvailability } = useTranslator();
const { checkAvailability: checkLanguageDetectorAvailability } = useLanguageDetector();

const mockedAvailability: Record<Exclude<Tool, 'prompt-api' | 'summarizer' | 'writer' | 'rewriter' | 'translator' | 'language-detector'>, Availability> = {
  proofreader: 'unavailable'
};

const getAvailabilityLabel = (status: DemoAvailability) => {
  if (status === 'checking') return 'Checking';
  if (status === 'available') return 'Available';
  if (status === 'downloadable') return 'Downloadable';
  if (status === 'downloading') return 'Downloading';
  return 'Not available';
};

const canOpenDemo = (availability: DemoAvailability) => {
  return availability === 'available' || availability === 'downloadable';
};

const apiRows = computed<ApiRow[]>(() => {
  return ToolItems.map((item) => {
    if (item.id === 'prompt-api') {
      return {
        ...item,
        availability: promptApiAvailability.value,
        href: canOpenDemo(promptApiAvailability.value) ? '/promptapi' : '',
        kitStatus: 'Vue / Nuxt ready'
      };
    }

    if (item.id === 'summarizer') {
      return {
        ...item,
        availability: summarizerAvailability.value,
        href: canOpenDemo(summarizerAvailability.value) ? '/summarizer' : '',
        kitStatus: 'Vue / Nuxt ready'
      };
    }

    if (item.id === 'writer') {
      return {
        ...item,
        availability: writerAvailability.value,
        href: canOpenDemo(writerAvailability.value) ? '/writer' : '',
        kitStatus: 'Vue / Nuxt ready'
      };
    }

    if (item.id === 'rewriter') {
      return {
        ...item,
        availability: rewriterAvailability.value,
        href: canOpenDemo(rewriterAvailability.value) ? '/rewriter' : '',
        kitStatus: 'Vue / Nuxt ready'
      };
    }

    if (item.id === 'translator') {
      return {
        ...item,
        availability: translatorAvailability.value,
        href: canOpenDemo(translatorAvailability.value) ? '/translator' : '',
        kitStatus: 'Vue / Nuxt ready'
      };
    }

    if (item.id === 'language-detector') {
      return {
        ...item,
        availability: languageDetectorAvailability.value,
        href: canOpenDemo(languageDetectorAvailability.value) ? '/language-detector' : '',
        kitStatus: 'Vue / Nuxt ready'
      };
    }

    return {
      ...item,
      availability: mockedAvailability[item.id],
      href: '',
      kitStatus: 'Planned'
    };
  });
});

const availableCount = computed(() => {
  return apiRows.value.filter(item => item.availability === 'available').length;
});

onMounted(async () => {
  const [
    promptStatus,
    summarizerStatus,
    writerStatus,
    rewriterStatus,
    translatorStatus,
    languageDetectorStatus
  ] = await Promise.allSettled([
    checkPromptApiAvailability(),
    checkSummarizerAvailability(),
    checkWriterAvailability(),
    checkRewriterAvailability(),
    checkTranslatorAvailability(),
    checkLanguageDetectorAvailability()
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
});
</script>

<style scoped>
.tools {
  width: min(1280px, calc(100vw - 3rem));
  pointer-events: all;
}

.tools__content {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.tools__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
}

.tools__summary h2 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.25rem;
  line-height: 1.2;
}

.tools__summary p {
  max-width: 760px;
  margin: 0.35rem 0 0;
  color: var(--color-secondary);
  font-size: 0.94rem;
  line-height: 1.45;
}

.tools__count {
  flex-shrink: 0;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  padding: 0.36rem 0.62rem;
  border-radius: 0.55rem;
  color: rgba(134, 239, 172, 1);
  background: rgba(34, 197, 94, 0.13);
  border: 1px solid rgba(34, 197, 94, 0.26);
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
}

.tools__table-wrap {
  min-height: 0;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.8rem;
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

  .tools__content {
    padding: 0.75rem;
  }

  .tools__summary {
    flex-direction: column;
    gap: 0.7rem;
  }

  .tools__table {
    min-width: 760px;
  }
}
</style>
