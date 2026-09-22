import { effectScope, nextTick, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSyncedString } from '../src/composables/useSyncedString';
import { useAbortableOperation } from '../src/utils/browserAi';
import { copyText, formatAvailability, formatRelativeTime, formatTokenCount, toDateTime } from '../src/utils/display';

afterEach(() => vi.unstubAllGlobals());

describe('Vue utility adapters', () => {
  it('coordinates abortable operations without clearing a newer request', () => {
    const operation = useAbortableOperation();
    operation.interrupt();
    const first = operation.begin();
    const second = operation.begin();
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
    operation.end(first);
    expect(operation.abortController.value?.signal).toBe(second);
    operation.end(second);
    expect(operation.abortController.value).toBeNull();
    operation.interrupt();
  });

  it('syncs internal and external strings without feedback loops', async () => {
    const external = ref('initial');
    const update = vi.fn((value: string) => {
      external.value = value;
    });
    const scope = effectScope();
    const value = scope.run(() => useSyncedString(() => external.value, update))!;
    value.value = 'internal';
    await nextTick();
    expect(update.mock.calls[0]?.[0]).toBe('internal');
    external.value = 'external';
    await nextTick();
    expect(value.value).toBe('external');
    await nextTick();
    expect(update).toHaveBeenCalledTimes(2);
    external.value = 'external';
    await nextTick();
    expect(value.value).toBe('external');
    scope.stop();
  });

  it('formats relative dates, timestamps, availability, and token counts', () => {
    const now = Date.UTC(2026, 0, 10, 12);
    expect(formatRelativeTime(undefined, now)).toBe('just now');
    expect(formatRelativeTime(now + 1_000, now)).toBe('just now');
    expect(formatRelativeTime(now - 90_000, now)).toBe('1m ago');
    expect(formatRelativeTime(now - 2 * 60 * 60_000, now)).toBe('2h ago');
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe('2d ago');
    expect(formatRelativeTime(now - 8 * 24 * 60 * 60_000, now)).toMatch(/Jan/);
    expect(toDateTime(0)).toBe(new Date(0).toISOString());
    expect(Date.parse(toDateTime())).not.toBeNaN();

    expect(formatAvailability(null, 25)).toBe('25%');
    expect(formatAvailability('available')).toBe('Ready');
    expect(formatAvailability('downloadable')).toBe('Download');
    expect(formatAvailability('downloading')).toBe('Downloading');
    expect(formatAvailability('unavailable')).toBe('Unavailable');
    expect(formatAvailability(null)).toBe('Checking');
    expect(formatTokenCount(null)).toBe('—');
    expect(formatTokenCount(Number.POSITIVE_INFINITY)).toBe('unlimited');
    expect(formatTokenCount(1_200)).toBe('1,200');
  });

  it('copies only non-empty text when Clipboard API is available', async () => {
    vi.stubGlobal('navigator', undefined);
    await expect(copyText('text')).resolves.toBe(false);
    vi.stubGlobal('navigator', {});
    await expect(copyText('text')).resolves.toBe(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('')).resolves.toBe(false);
    await expect(copyText('copied')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('copied');
  });
});
