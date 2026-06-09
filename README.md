# asteroids-ml

*(WIP) A machine learning algorithm that plays Asteroids.*

[Play Asteroids](https://jonpepler.github.io/asteroids-ml/play)

[Watch Asteroids play Asteroids](https://jonpepler.github.io/asteroids-ml/)

A neuroevolution (NEAT) trainer learns to play a small [p5](https://p5js.org/)
Asteroids clone. Each genome "sees" the field through whisker sensors and outputs
the four control keys. The population is evaluated headlessly across web workers
while the current champion plays on screen, with its brain lighting up as it
fires. Progress is saved to IndexedDB so training continues across reloads.

The NEAT engine is an in-house, fully typed package in [`src/lib/neat`](src/lib/neat/README.md)
(genomes, innovation tracking, crossover, speciation, seedable RNG). It replaced
the old, unmaintained `@liquid-carrot/carrot` dependency.

## tech

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) (SPA, deployed to GitHub Pages)
- TypeScript (strict)
- [Biome](https://biomejs.dev/) for lint + format
- [Vitest](https://vitest.dev/) for tests
- p5 for rendering, an in-house NEAT package for the neural net, elkjs for the brain graph layout

## development

```sh
npm install      # install deps
npm run dev      # start the dev server
npm run build    # production build into dist/
npm run preview  # serve the production build locally
npm test         # run the test suite
npm run lint     # Biome lint + format check
npm run typecheck
```

The app is served from the `/asteroids-ml/` base path (matching GitHub Pages).
Pushing to `main` runs CI (lint, typecheck, test, build) and deploys `dist/`
to GitHub Pages via Actions.

## notes

- The game is endless: there is no win state, and fresh asteroids keep arriving
  with the score and on a timer, so difficulty always climbs.
- See [`docs/recommendations.md`](docs/recommendations.md) and
  [`docs/roadmap.md`](docs/roadmap.md) for ideas on improving the neural net
  shape, fitness function, and remaining roadmap items.

## todo

- [x] Host a PWA using GitHub Pages
- [x] Make Asteroids clone in p5
- [x] Write a machine learning process to learn how to play and save progress in local storage
- [ ] Tune the network inputs, fitness function and topology (see recommendations)
- [ ] Use something like [this](https://github.com/liquidx/webviewscreensaver) to turn the PWA into a local screensaver
