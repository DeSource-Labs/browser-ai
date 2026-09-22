import {
  createAbortManager,
  createDownloadMonitor,
  safeCheckAvailability,
  type BrowserAiConstructor
} from './platform.js';
import { createBrowserAiStore, type BrowserAiStore } from './store.js';

export type BrowserAiProcessingState = 'availability' | 'create' | '';

export interface BrowserAiModelState<Instance> {
  instance: Instance | null;
  availability: Availability | null;
  processing: string;
  downloadProgress: number;
  error: unknown;
}

export interface BrowserAiModelController<CoreOptions, CreateOptions, Instance> {
  readonly state: BrowserAiStore<BrowserAiModelState<Instance>>;
  checkAvailability(options?: CoreOptions): Promise<Availability>;
  requestAvailability(options?: CoreOptions): Promise<Availability>;
  init(options?: CoreOptions): Promise<Availability>;
  create(options?: CreateOptions): Promise<Instance>;
  ensure(options?: CreateOptions): Promise<Instance>;
  configure(options: CreateOptions): void;
  destroy(): void;
  dispose(): void;
  interrupt(reason?: unknown): void;
}

export interface CreateModelControllerOptions<CoreOptions, CreateOptions, NativeCreateOptions, Instance> {
  getConstructor(): BrowserAiConstructor<CoreOptions, NativeCreateOptions, Instance> | undefined;
  getCoreOptions(options: CreateOptions): CoreOptions;
  getNativeCreateOptions(
    options: CreateOptions,
    signal: AbortSignal,
    monitor: CreateMonitorCallback
  ): NativeCreateOptions;
  defaultCreateOptions: CreateOptions;
  /** Options that require a fresh native session when changed. */
  getSessionOptions?(options: CreateOptions): unknown;
  unsupportedMessage: string;
  unavailableMessage: string;
}

export const createModelController = <
  CoreOptions,
  CreateOptions,
  NativeCreateOptions,
  Instance extends DestroyableModel
>(
  config: CreateModelControllerOptions<CoreOptions, CreateOptions, NativeCreateOptions, Instance>
): BrowserAiModelController<CoreOptions, CreateOptions, Instance> => {
  const state = createBrowserAiStore<BrowserAiModelState<Instance>>({
    instance: null,
    availability: null,
    processing: '',
    downloadProgress: 0,
    error: null
  });
  const operation = createAbortManager();
  let availabilityRequest = 0;
  let activeOptions = snapshotOptions(config.defaultCreateOptions);
  let desiredOptions = snapshotOptions(config.defaultCreateOptions);
  const sessionOptions = config.getSessionOptions ?? ((options: CreateOptions) => options);

  const checkAvailability = (options = config.getCoreOptions(desiredOptions)) =>
    safeCheckAvailability(config.getConstructor(), options);

  const requestAvailability = async (options?: CoreOptions) => {
    const request = ++availabilityRequest;
    const ownsProcessing = !operation.signal;
    if (ownsProcessing) state.update({ processing: 'availability', error: null });
    try {
      const availability = await checkAvailability(options);
      if (request === availabilityRequest) state.update({ availability });
      return availability;
    } catch (error) {
      // Availability failures are normalized by safeCheckAvailability. Only a
      // synchronous constructor lookup can reach this catch, before another
      // request can supersede it.
      state.update({ error });
      throw error;
    } finally {
      if (request === availabilityRequest && ownsProcessing) state.update({ processing: '' });
    }
  };

  const interrupt = (reason?: unknown) => {
    availabilityRequest += 1;
    operation.interrupt(reason);
    state.update({ processing: '' });
  };

  const destroy = () => {
    interrupt();
    state.getSnapshot().instance?.destroy();
    state.update({ instance: null });
  };

  const create = async (options = desiredOptions) => {
    options = snapshotOptions(options);
    availabilityRequest += 1;
    const constructor = config.getConstructor();
    if (typeof constructor?.create !== 'function') {
      const error = new Error(config.unsupportedMessage);
      state.update({
        availability: state.getSnapshot().instance ? state.getSnapshot().availability : 'unavailable',
        error
      });
      throw error;
    }

    const signal = operation.begin();
    state.update({ processing: 'create', downloadProgress: 0, error: null });
    const monitor = createDownloadMonitor((downloadProgress) => {
      if (operation.isCurrent(signal)) state.update({ downloadProgress });
    });

    try {
      const coreOptions = config.getCoreOptions(options);
      const availability = await checkAvailability(coreOptions);
      if (!operation.isCurrent(signal) || signal.aborted) {
        throw signal.reason;
      }
      // A replacement's availability does not change the retained session.
      if (!state.getSnapshot().instance) state.update({ availability });
      if (availability === 'unavailable') throw new Error(config.unavailableMessage);

      signal.throwIfAborted();
      const instance = await constructor.create(config.getNativeCreateOptions(options, signal, monitor));
      if (!operation.isCurrent(signal) || signal.aborted) {
        instance.destroy();
        throw signal.reason;
      }
      state.getSnapshot().instance?.destroy();
      activeOptions = options;
      desiredOptions = options;
      state.update({ instance, availability: 'available', downloadProgress: 100 });
      signal.throwIfAborted();
      return instance;
    } catch (error) {
      if (operation.isCurrent(signal)) state.update({ error });
      throw error;
    } finally {
      if (operation.end(signal)) state.update({ processing: '' });
    }
  };

  const ensure = async (options = desiredOptions) => {
    const instance = state.getSnapshot().instance;
    if (instance && equalOptions(sessionOptions(activeOptions), sessionOptions(options))) {
      return instance;
    }
    return create(options);
  };
  const dispose = () => {
    destroy();
    activeOptions = snapshotOptions(config.defaultCreateOptions);
    desiredOptions = snapshotOptions(config.defaultCreateOptions);
    state.update({ availability: null, processing: '', downloadProgress: 0, error: null });
  };

  return {
    state,
    checkAvailability,
    requestAvailability,
    init: requestAvailability,
    create,
    ensure,
    configure: (options) => {
      desiredOptions = snapshotOptions(options);
    },
    destroy,
    dispose,
    interrupt
  };
};

/** Compare small option records without serializing browser-owned input values. */
export const equalOptions = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => equalOptions(value, right[index]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Object.getPrototypeOf(left) !== Object.prototype || Object.getPrototypeOf(right) !== Object.prototype)
    return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a).filter((key) => a[key] !== undefined);
  return (
    keys.length === Object.keys(b).filter((key) => b[key] !== undefined).length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && equalOptions(a[key], b[key]))
  );
};

/** Snapshot option records while retaining opaque browser objects and callbacks by identity. */
export const snapshotOptions = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(snapshotOptions) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, snapshotOptions(entry)])) as T;
  }
  return value;
};
