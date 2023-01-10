
//This is used to configure jest
export default {
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(mjs?|jsx?|js?|tsx?|ts?)$",
  transform: {
    "^.+\\.jsx?$": "babel-jest",
    "^.+\\.mjs$": "babel-jest",
    "^.+\\.tsx?$": "@swc/jest",
  },
  testPathIgnorePatterns: ["<rootDir>/build/", "<rootDir>/node_modules/"],
  moduleFileExtensions: ["js", "jsx", "mjs", "ts"],
  forceExit: true,
  reporters: [["jest-silent-reporter", { "useDots": true, "showWarnings": true, "showPaths": true }], "summary", 'default'],
  collectCoverage: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
}