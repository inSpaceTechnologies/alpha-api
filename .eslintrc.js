module.exports = {
  "extends": [
    "airbnb-base",
  ],
  "rules": {
    "no-param-reassign": [2, { "props": false }],
    "no-unused-vars": ["error", { "argsIgnorePattern": "next" }],
    'max-len': ['off'],
    'no-console': ['off'],
    'no-shadow': ["error", { "allow": ["err"] }],
    'no-underscore-dangle': ['off'],
    'no-restricted-syntax': ['off']
  },
  "env": {
    "node": true,
  },
};
