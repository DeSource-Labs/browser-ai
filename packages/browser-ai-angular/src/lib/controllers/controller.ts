import { computed, type DestroyRef, type Signal, signal } from '@angular/core';
import type { BrowserAiStore } from '@desource/browser-ai';

export interface DisposableController {
  state: Pick<BrowserAiStore<any>, 'getSnapshot' | 'subscribe'>;
  dispose(): void;
}

type StateOf<Controller extends DisposableController> = ReturnType<Controller['state']['getSnapshot']>;

export type AngularBrowserAiController<Controller extends DisposableController> = Controller & {
  readonly current: Signal<StateOf<Controller>>;
  readonly isProcessing: Signal<boolean>;
  readonly isReady: Signal<boolean>;
};

export const toAngularController = <Controller extends DisposableController>(
  controller: Controller,
  destroyRef?: DestroyRef
): AngularBrowserAiController<Controller> => {
  const current = signal<StateOf<Controller>>(controller.state.getSnapshot());
  const unsubscribe = controller.state.subscribe(() => current.set(controller.state.getSnapshot()));
  const disposeController = controller.dispose.bind(controller);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeController();
    unsubscribe();
  };
  destroyRef?.onDestroy(dispose);
  return Object.assign(controller, {
    current: current.asReadonly(),
    isProcessing: computed(() => Boolean((current() as { processing?: string }).processing)),
    isReady: computed(() => {
      const value = current() as { availability?: Availability | null; instance?: unknown; isReady?: boolean };
      return value.isReady ?? (value.availability === 'available' && value.instance != null);
    }),
    dispose
  }) as AngularBrowserAiController<Controller>;
};
