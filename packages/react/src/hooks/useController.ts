import { useEffect, useRef, useSyncExternalStore } from 'react';

export interface DisposableController {
  state: {
    getSnapshot(): object;
    subscribe(listener: () => void): () => void;
  };
  dispose(): void;
}

type StateOf<Controller extends DisposableController> = ReturnType<Controller['state']['getSnapshot']>;

export const useController = <Controller extends DisposableController>(
  factory: () => Controller,
  configure?: (controller: Controller) => void
): Controller & StateOf<Controller> & { isReady: boolean; isProcessing: boolean } => {
  const controllerRef = useRef<Controller | null>(null);
  if (!controllerRef.current) controllerRef.current = factory();
  const controller = controllerRef.current;
  const snapshot = useSyncExternalStore(
    controller.state.subscribe,
    controller.state.getSnapshot,
    controller.state.getSnapshot
  );
  const status = snapshot as {
    processing: string;
    instance?: unknown;
    availability?: Availability | null;
    isReady?: boolean;
  };
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => configure?.(controller), [controller, configure]);
  return {
    ...controller,
    ...snapshot,
    isReady: status.isReady ?? (status.instance != null && status.availability === 'available'),
    isProcessing: Boolean(status.processing)
  } as unknown as Controller & StateOf<Controller> & { isReady: boolean; isProcessing: boolean };
};
