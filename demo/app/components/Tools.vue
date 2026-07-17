<template>
  <div class="tools" aria-label="Live Browser AI availability">
    <NuxtLink
      v-for="(item, index) in apiRows"
      :key="item.id"
      class="tools__card"
      :to="item.href"
      :data-api="item.id"
    >
      <div class="tools__card-top">
        <span class="tools__index" aria-hidden="true">{{
          String(index + 1).padStart(2, "0")
        }}</span>
        <span
          class="tools__badge"
          :class="`tools__badge--${item.availability}`"
        >
          <i aria-hidden="true" />
          {{ getAvailabilityLabel(item.availability) }}
        </span>
      </div>

      <div class="tools__copy">
        <h3>{{ item.name }}</h3>
        <p>{{ item.description }}</p>
      </div>

      <div class="tools__footer">
        <span>{{ getRuntimeLabel(item.id) }}</span>
        <span class="tools__open">
          Try it
          <i aria-hidden="true">↗</i>
        </span>
      </div>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
type DemoAvailability = Availability | "checking";

type ApiRow = ToolItem & {
  availability: DemoAvailability;
};

type AvailabilityConstructor = {
  availability: (options?: Record<string, unknown>) => Promise<Availability>;
};

const statuses = reactive<Record<Tool, DemoAvailability>>(
  Object.fromEntries(ToolItems.map((item) => [item.id, "checking"])) as Record<
    Tool,
    DemoAvailability
  >,
);

const availabilityOptions: Partial<Record<Tool, Record<string, unknown>>> = {
  translator: {
    sourceLanguage: "en",
    targetLanguage: "fr",
  },
};

const constructorNames: Partial<Record<Tool, string>> = {
  "prompt-api": "LanguageModel",
  summarizer: "Summarizer",
  writer: "Writer",
  rewriter: "Rewriter",
  translator: "Translator",
  "language-detector": "LanguageDetector",
  proofreader: "Proofreader",
};

const apiRows = computed<ApiRow[]>(() =>
  ToolItems.map((item) => ({
    ...item,
    availability: statuses[item.id],
  })),
);

const checkNativeAvailability = async (tool: Tool): Promise<Availability> => {
  if (tool === "webmcp") {
    return document.modelContext ? "available" : "unavailable";
  }

  const constructorName = constructorNames[tool];
  const constructor = constructorName
    ? ((globalThis as typeof globalThis & Record<string, unknown>)[
        constructorName
      ] as AvailabilityConstructor | undefined)
    : undefined;

  if (typeof constructor?.availability !== "function") return "unavailable";

  try {
    return await constructor.availability(availabilityOptions[tool]);
  } catch {
    return "unavailable";
  }
};

const getAvailabilityLabel = (status: DemoAvailability) => {
  switch (status) {
    case "checking":
      return "Checking";
    case "downloading":
      return "Downloading";
    case "available":
      return "Ready now";
    case "downloadable":
      return "Download first";
    default:
      return "Not enabled";
  }
};

const getRuntimeLabel = (tool: Tool) => {
  if (tool === "webmcp") return "Browser agent tools";
  if (tool === "translator") return "Local language pack";
  return "On-device model";
};

onMounted(async () => {
  await Promise.all(
    ToolItems.map(async (item) => {
      statuses[item.id] = await checkNativeAvailability(item.id);
    }),
  );
});
</script>

<style scoped>
.tools {
  width: min(1180px, 100%);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.8rem;
  pointer-events: auto;
}

.tools__card {
  position: relative;
  isolation: isolate;
  min-height: 252px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.2rem;
  color: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 1.15rem;
  background:
    radial-gradient(
      circle at 85% 0%,
      rgba(124, 92, 228, 0.16),
      transparent 42%
    ),
    rgba(7, 10, 20, 0.7);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.055);
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
}

.tools__card::after {
  position: absolute;
  z-index: -1;
  right: -3rem;
  bottom: -4rem;
  width: 9rem;
  height: 9rem;
  content: "";
  border: 1px solid rgba(94, 234, 212, 0.13);
  border-radius: 50%;
  box-shadow:
    0 0 0 1.5rem rgba(94, 234, 212, 0.025),
    0 0 0 3rem rgba(124, 92, 228, 0.025);
  transition: transform 320ms ease;
}

.tools__card:hover,
.tools__card:focus-visible {
  transform: translateY(-4px);
  border-color: rgba(167, 139, 250, 0.34);
  background-color: rgba(13, 17, 32, 0.82);
}

.tools__card:hover::after,
.tools__card:focus-visible::after {
  transform: translate(-0.45rem, -0.45rem) scale(1.08);
}

.tools__card-top,
.tools__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.tools__index {
  color: rgba(255, 255, 255, 0.3);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.tools__badge {
  min-height: 1.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0.26rem 0.52rem;
  color: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.045);
  font-size: 0.68rem;
  font-weight: 760;
  white-space: nowrap;
}

.tools__badge i {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0.65rem currentColor;
}

.tools__badge--available {
  color: #7ee7b0;
  border-color: rgba(52, 211, 153, 0.2);
  background: rgba(16, 185, 129, 0.09);
}

.tools__badge--downloadable,
.tools__badge--checking {
  color: #9dc5ff;
  border-color: rgba(96, 165, 250, 0.22);
  background: rgba(59, 130, 246, 0.09);
}

.tools__badge--downloading {
  color: #fed7aa;
  border-color: rgba(251, 146, 60, 0.22);
  background: rgba(251, 146, 60, 0.09);
}

.tools__badge--unavailable {
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.2);
  background: rgba(239, 68, 68, 0.08);
}

.tools__copy {
  display: grid;
  gap: 0.55rem;
}

.tools__copy h3,
.tools__copy p {
  margin: 0;
}

.tools__copy h3 {
  font-size: clamp(1.05rem, 1.6vw, 1.25rem);
  line-height: 1.15;
  letter-spacing: -0.035em;
}

.tools__copy p {
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.82rem;
  line-height: 1.55;
}

.tools__footer {
  margin-top: auto;
  color: rgba(255, 255, 255, 0.36);
  font-size: 0.68rem;
  font-weight: 680;
}

.tools__open {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: rgba(255, 255, 255, 0.84);
}

.tools__open i {
  font-style: normal;
  transition: transform 180ms ease;
}

.tools__card:hover .tools__open i,
.tools__card:focus-visible .tools__open i {
  transform: translate(2px, -2px);
}

@media (max-width: 980px) {
  .tools {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tools__card {
    min-height: 220px;
  }
}

@media (max-width: 580px) {
  .tools {
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }

  .tools__card {
    min-height: 0;
    gap: 1rem;
    padding: 1rem;
  }

  .tools__copy p {
    max-width: 38rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tools__card,
  .tools__card::after,
  .tools__open i {
    transition: none;
  }
}
</style>
