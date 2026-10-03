import { computed, getCurrentScope, onScopeDispose, shallowRef, type ComputedRef } from 'vue';

interface WorkflowController<State extends object> {
  state: { getSnapshot(): State; subscribe(listener: () => void): () => void };
  dispose(): void;
}

export function useWorkflow<State extends object, Controller extends WorkflowController<State>>(
  controller: Controller
) {
  type Snapshot = ReturnType<Controller['state']['getSnapshot']>;
  const snapshot = shallowRef(controller.state.getSnapshot());
  const unsubscribe = controller.state.subscribe(() => {
    snapshot.value = controller.state.getSnapshot();
  });
  const { state: _state, ...methods } = controller;
  const fields = Object.fromEntries(
    Object.keys(snapshot.value).map((key) => [key, computed(() => snapshot.value[key as keyof State])])
  ) as { [Key in keyof Snapshot]: ComputedRef<Snapshot[Key]> };
  const dispose = () => {
    controller.dispose();
    unsubscribe();
  };
  if (getCurrentScope()) onScopeDispose(dispose);
  return { ...methods, ...fields, dispose };
}
