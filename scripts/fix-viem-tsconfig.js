import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const nodeModulesDir = path.join(root, "node_modules");
const viemDir = path.join(nodeModulesDir, "viem");
const viemTsconfigPath = path.join(viemDir, "tsconfig.json");
const nodeModulesBaseTsconfigPath = path.join(nodeModulesDir, "tsconfig.base.json");
const dummyTsPath = path.join(viemDir, "__tsconfig_dummy__.ts");

try {
  if (!fs.existsSync(viemTsconfigPath)) {
    process.exit(0);
  }

  if (!fs.existsSync(nodeModulesBaseTsconfigPath)) {
    fs.writeFileSync(
      nodeModulesBaseTsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            skipLibCheck: true,
            noEmit: true,
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }

  if (!fs.existsSync(dummyTsPath)) {
    fs.writeFileSync(dummyTsPath, "export {};\n", "utf8");
  }

  const patchedTsconfig = {
    files: ["./__tsconfig_dummy__.ts"],
    compilerOptions: {
      composite: false,
      noEmit: true,
    },
  };

  fs.writeFileSync(viemTsconfigPath, JSON.stringify(patchedTsconfig, null, 2) + "\n", "utf8");
} catch (error) {
  console.warn("[postinstall] viem tsconfig patch skipped:", error instanceof Error ? error.message : error);
}
