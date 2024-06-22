import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import tsdoc from "eslint-plugin-tsdoc";
import eslintConfigPrettier from "eslint-config-prettier";

const config = [
    {
        ignores: ["**/*.config.js", "!**/eslint.config.js", "dist/**", "docs/**"],
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: { tsdoc },
        files: ["src/**/*.ts"],
        rules: {
            "tsdoc/syntax": "warn",
        },
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
];

export default config;
