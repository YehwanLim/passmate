import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, "**/.worktrees/**"],
      env: {
        VITE_SUPABASE_URL: "https://unit-test.supabase.co",
        VITE_SUPABASE_ANON_KEY: "unit-test-anon-key",
      },
    },
  }),
);
