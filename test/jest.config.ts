import type {Config} from "jest";
import { pathsToModuleNameMapper } from "ts-jest";

const config: Config = {
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(mjs?|jsx?|js?|tsx?|ts?)$",
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
  forceExit: true,
  reporters: [["jest-silent-reporter", { "useDots": true, "showWarnings": true, "showPaths": true }], "summary", 'default'],
  collectCoverage: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  }
}

//This is used to configure jest
export default config;