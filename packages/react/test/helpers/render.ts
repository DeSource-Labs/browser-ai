import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach } from 'vitest';

const roots = new Set<Root>();

export const render = async (element: ReactElement) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.add(root);
  await act(() => root.render(element));
  return {
    container,
    async update(next: ReactElement) {
      await act(() => root.render(next));
    },
    async cleanup() {
      if (roots.delete(root)) await act(() => root.unmount());
      container.remove();
    }
  };
};

afterEach(async () => {
  for (const root of roots) await act(() => root.unmount());
  roots.clear();
  document.body.replaceChildren();
});
