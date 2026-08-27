import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ["tests/integration/**/*.test.js"],
      setupFiles: ["tests/integration/harness/setup.js"],
      // 통합 테스트는 하나의 로컬 데이터베이스를 공유하므로 파일 간 병렬 실행을 끈다.
      // 동시성 검증은 파일 안에서 Promise.all 로 만든다.
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 120_000,
    },
  }),
);
