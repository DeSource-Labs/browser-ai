import type { BrowserAiStore } from '@desource/browser-ai';
import { readable, type Readable } from 'svelte/store';

export interface StoreController {
  state: Pick<BrowserAiStore<any>, 'getSnapshot' | 'subscribe'>;
}

export const toSvelteController = <Controller extends StoreController>(
  controller: Controller
): Omit<Controller, 'state'> & {
  state: Readable<ReturnType<Controller['state']['getSnapshot']>>;
  coreState: Controller['state'];
} => {
  type State = ReturnType<Controller['state']['getSnapshot']>;
  return {
    ...controller,
    state: readable<State>(controller.state.getSnapshot(), (set) => {
      set(controller.state.getSnapshot());
      return controller.state.subscribe(() => set(controller.state.getSnapshot()));
    }),
    coreState: controller.state
  };
};
