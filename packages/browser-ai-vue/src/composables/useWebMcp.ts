import {
  createWebMcp,
  createWebMcpFieldAttributes,
  createWebMcpFormAttributes,
  getWebMcpSupport,
  type WebMcpExecuteOptions,
  type WebMcpFormDefinition,
  type WebMcpRegisterOptions,
  type WebMcpRegisteredTool,
  type WebMcpSupportState,
  type WebMcpTool,
  type WebMcpToolExecuteOptions,
  type WebMcpToolInput
} from '@desource/browser-ai';
import { computed, getCurrentScope, onScopeDispose, ref } from 'vue';

export type WebMcpProcessingState = 'registering' | 'discovering' | 'executing' | '';
export type WebMcpToolAnnotations = WebMCP.ToolAnnotations;
export type WebMcpRegisterToolOptions = WebMcpRegisterOptions;
export type WebMcpGetToolsOptions = WebMCP.ModelContextGetToolOptions;
export type WebMcpExecuteToolOptions = WebMcpExecuteOptions;
export type WebMcpDiscoveredTool = WebMcpRegisteredTool;
export type { WebMcpFormDefinition, WebMcpSupportState, WebMcpTool, WebMcpToolExecuteOptions, WebMcpToolInput };
export { createWebMcpFieldAttributes, createWebMcpFormAttributes, getWebMcpSupport };

export function useWebMcp() {
  const controller = createWebMcp();
  const revision = ref(0);
  const unsubscribe = controller.state.subscribe(() => {
    revision.value += 1;
  });
  const snapshot = computed(() => {
    void revision.value;
    return controller.state.getSnapshot();
  });

  const dispose = () => {
    unsubscribe();
    controller.dispose();
  };

  if (getCurrentScope()) onScopeDispose(dispose);

  return {
    modelContext: computed(() => {
      void revision.value;
      return typeof document === 'undefined' ? null : (document.modelContext ?? null);
    }),
    support: computed(() => snapshot.value.support),
    isSupported: computed(() => snapshot.value.support.supported),
    processing: computed(() => snapshot.value.processing),
    isProcessing: computed(() => snapshot.value.processing !== ''),
    discoveredTools: computed(() => snapshot.value.discoveredTools),
    registeredTools: computed(() => snapshot.value.registeredTools),
    error: computed(() => snapshot.value.error),
    lastResult: computed(() => snapshot.value.lastResult),
    refreshSupport: controller.refreshSupport,
    refreshTools: controller.refreshTools,
    registerTool: controller.registerTool,
    registerTools: controller.registerTools,
    unregisterTool: controller.unregisterTool,
    unregisterAll: controller.unregisterAll,
    executeTool: controller.executeTool,
    dispose
  };
}
