import { computed } from 'vue';
import { createAiChats, type AiChatTool } from '@desource/browser-ai/chats';
import { useWorkflow } from './useWorkflow';

export type { AiChatTool, AiChatMessage, AiChatSummaryRecord, AiChatRecord } from '@desource/browser-ai/chats';

export function useAiChats(tool: AiChatTool) {
  const controller = createAiChats(tool);
  const workflow = useWorkflow(controller);
  return {
    ...workflow,
    activeChatId: computed({
      get: () => workflow.activeChatId.value,
      set: controller.setActiveChatId
    })
  };
}
