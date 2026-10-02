<template>
  <div class="browser-ai-markdown" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '../utils/markdown';

interface Props {
  content: string;
}

const props = defineProps<Props>();
const renderedContent = computed(() => renderMarkdown(props.content));
</script>
