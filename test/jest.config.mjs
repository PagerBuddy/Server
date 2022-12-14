
//This is used to configure jest
export default {
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(mjs?|jsx?|js?|tsx?|ts?)$",
  transform: {
    "^.+\\.jsx?$": "babel-jest",
    "^.+\\.mjs$": "babel-jest",
  },
  testPathIgnorePatterns: ["<rootDir>/build/", "<rootDir>/node_modules/"],
  moduleFileExtensions: ["js", "jsx", "mjs"],
  forceExit: true,
  reporters: [["jest-silent-reporter", { "useDots": true, "showWarnings": true, "showPaths": true }], "summary"],
  collectCoverage: true
}