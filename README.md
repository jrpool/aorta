# aorta

Automated Opensource Routines for Testing Accessibility (AORTA).

## Introduction

This application tests web pages for accessibility. It asks you for the pages you want to test and the tests you want to perform. Then it uses the [Testaro package](https://www.npmjs.com/package/testaro) to perform the tests and make reports of the results available to you.

## Installation

The direct and indirect dependencies include some hosted by `npmjs` and others hosted by Github Packages. So, installing the dependencies (`npm install`) requires you to have personal access tokens from both registries. Put them into an `.npmrc` file, which can be in your home directory. The statements in `.npmrc` have this format:

```bash
//registry.npmjs.org/:_authToken=...
//npm.pkg.github.com/:_authToken=ghp_...
```
