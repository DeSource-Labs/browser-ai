import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useTestContext } from '@nuxt/test-utils/e2e';

export const getFixtureRoot = (fixturePath: string, fromUrl: string) => fileURLToPath(new URL(fixturePath, fromUrl));

export const getBuildDir = () => {
  const { options, nuxt } = useTestContext();
  if (nuxt?.options.buildDir) return nuxt.options.buildDir;
  const configured = (options.nuxtConfig.buildDir as string | undefined) ?? '.nuxt';
  return isAbsolute(configured) ? configured : resolve(options.rootDir, configured);
};
