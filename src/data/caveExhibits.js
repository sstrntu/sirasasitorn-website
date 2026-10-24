import { projectsInfo } from './projects';

/*
 * What's on the screens in the hidden cave behind the waterfall (jungle/Cave.js):
 * the site itself, then the notable projects from the résumé. Add side
 * projects here ({ title, tech, description, url? }); up to 7 fit the wall.
 */
export const CAVE_EXHIBITS = [
  {
    title: 'This island',
    tech: 'React Three Fiber, Rapier physics, live Krabi weather',
    description:
      'The little world you’re standing in, built in code: Sira’s day follows Bangkok time and Krabi’s real weather, almost everything can be picked up and thrown, and there’s a whole desktop inside the laptop.',
  },
  ...projectsInfo.map((project) => ({ title: project.name, tech: project.tech, description: project.description })),
];
