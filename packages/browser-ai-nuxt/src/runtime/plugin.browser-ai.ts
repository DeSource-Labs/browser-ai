// import { vPhoneMask } from '@desource/phone-mask-vue';
import { defineNuxtPlugin, type Plugin } from '#app';

const plugin: Plugin = defineNuxtPlugin({
  name: 'browser-ai',
  setup(nuxtApp) {
    // nuxtApp.vueApp.directive('phone-mask', vPhoneMask);
  }
});

export default plugin;
