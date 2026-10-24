/*
 * Spotlight's index, built from the résumé data and the desktop's apps, and a
 * small fuzzy ranker: matches in a title beat keyword matches, which beat
 * matches in the body text. Every word typed has to match somewhere.
 *
 * Items: { id, group, title, subtitle, image | emoji, keywords, body,
 * preview: { meta, lines }, live ('weather' | 'time'), action }. Actions:
 * { type: 'app', id } opens a desktop window, 'url' a link, 'terminal' runs a
 * command in the terminal, 'about', 'island' (back to camp) or 'none'.
 */
import { personalInfo } from '../data/personal';
import { experienceInfo } from '../data/experience';
import { projectsInfo } from '../data/projects';
import { skillsInfo } from '../data/skills';
import { educationInfo } from '../data/education';
import { languagesInfo } from '../data/languages';
import { DESKTOP_PROJECTS, DOCK_APPS, RESUME_ICON } from '../data/desktopApps';

export const GROUP_ORDER = ['Applications', 'Projects', 'Experience', 'Skills', 'Education', 'Other'];

const APP_INFO = {
  messages: { subtitle: 'Chat', keywords: ['chat', 'message', 'ask'] },
  mail: { subtitle: 'Email Sira', keywords: ['email', 'contact', 'hire', 'reach'] },
  notes: { subtitle: 'About me and CV notes', keywords: ['about', 'cv'] },
  instagram: { subtitle: 'instagram.com/siratu', keywords: ['photos', 'photography', 'social'] },
  linkedin: { subtitle: 'linkedin.com/in/sirasasitorn', keywords: ['profile', 'social', 'contact', 'hire'] },
  maps: { subtitle: 'Work and travel locations', keywords: ['map', 'location', 'places', 'travel'] },
  terminal: { subtitle: 'The résumé as a command line', keywords: ['shell', 'command', 'cli', 'resume', 'cv'] },
};

const bullet = (line) => line.replace(/^•\s*/, '');

const buildIndex = () => {
  const apps = DOCK_APPS.map((app) => ({
    id: `app:${app.id}`,
    group: 'Applications',
    title: app.name,
    subtitle: APP_INFO[app.id]?.subtitle,
    image: app.icon,
    keywords: APP_INFO[app.id]?.keywords || [],
    action: app.opens ? { type: 'app', id: app.opens } : { type: 'url', url: app.url, name: app.name },
  }));
  apps.unshift({
    id: 'app:pdf',
    group: 'Applications',
    title: 'Resume.pdf',
    subtitle: 'Sira’s résumé',
    image: RESUME_ICON,
    keywords: ['resume', 'résumé', 'cv', 'pdf', 'download'],
    action: { type: 'app', id: 'pdf' },
  });

  const sites = DESKTOP_PROJECTS.map((project) => ({
    id: `site:${project.name}`,
    group: 'Projects',
    title: project.name,
    subtitle: project.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
    image: project.icon,
    keywords: ['website', 'site', 'project'],
    action: { type: 'url', url: project.url, name: project.name, project: true },
  }));

  const projects = projectsInfo.map((project, i) => ({
    id: `project:${i}`,
    group: 'Projects',
    title: project.name,
    subtitle: project.tech,
    emoji: '📁',
    keywords: project.tech.split(/,\s*|\s*\(|\)/).filter(Boolean),
    body: project.description,
    preview: { meta: project.tech, lines: [project.description] },
    action: { type: 'terminal', command: 'projects' },
  }));

  const experience = experienceInfo.flatMap((item, i) => {
    if (item.isEarlierRoles) {
      return item.roles.map((role, j) => ({
        id: `role:${i}:${j}`,
        group: 'Experience',
        title: role.position,
        subtitle: `${role.company} · ${role.period}`,
        emoji: '💼',
        keywords: [role.company],
        preview: { meta: `${role.company} · ${role.period}`, lines: [] },
        action: { type: 'terminal', command: 'experience' },
      }));
    }
    return [{
      id: `job:${i}`,
      group: 'Experience',
      title: item.position,
      subtitle: `${item.company} · ${item.period}`,
      emoji: '💼',
      keywords: [item.company, item.location].filter(Boolean),
      body: item.duties.join(' '),
      preview: { meta: [item.company, item.location, item.period].filter(Boolean).join(' · '), lines: item.duties.map(bullet) },
      action: { type: 'terminal', command: 'experience' },
    }];
  });

  const skills = Object.entries(skillsInfo).map(([category, list]) => ({
    id: `skills:${category}`,
    group: 'Skills',
    title: category,
    subtitle: list.slice(0, 4).join(', '),
    emoji: '✨',
    keywords: list,
    preview: { lines: list },
    action: { type: 'terminal', command: 'skills' },
  }));

  const education = educationInfo.map((edu, i) => ({
    id: `edu:${i}`,
    group: 'Education',
    title: edu.degree,
    subtitle: `${edu.institution} · ${edu.period}`,
    emoji: '🎓',
    keywords: [edu.institution, edu.location, edu.emphasis].filter(Boolean),
    preview: {
      meta: `${edu.institution}, ${edu.location} · ${edu.period}`,
      lines: [edu.emphasis && `Emphasis: ${edu.emphasis}`, edu.gpa && `GPA: ${edu.gpa}`].filter(Boolean),
    },
    action: { type: 'terminal', command: 'education' },
  }));

  const other = [
    {
      id: 'about',
      group: 'Other',
      title: 'About Sira',
      subtitle: 'Who’s behind this desktop',
      emoji: '🌴',
      keywords: ['about', 'sira', 'who', 'info'],
      preview: { meta: personalInfo.title, lines: [] },
      action: { type: 'about' },
    },
    {
      id: 'island',
      group: 'Other',
      title: 'Back to the campsite',
      subtitle: 'The 3D island',
      emoji: '🏝️',
      keywords: ['island', 'camp', 'home', '3d', 'scene', 'shut down', 'exit', 'krabi'],
      preview: { lines: ['Close the laptop and fly back out to Sira’s island camp.'] },
      action: { type: 'island' },
    },
    {
      id: 'weather',
      group: 'Other',
      title: 'Weather in Krabi',
      subtitle: 'Live, same as on the island',
      emoji: '🌦️',
      keywords: ['weather', 'rain', 'temperature', 'forecast', 'krabi', 'railay'],
      live: 'weather',
      action: { type: 'none' },
    },
    {
      id: 'time',
      group: 'Other',
      title: 'Time in Bangkok',
      subtitle: 'Sira’s time zone (UTC+7)',
      emoji: '🕐',
      keywords: ['time', 'clock', 'bangkok', 'timezone', 'thailand', 'when'],
      live: 'time',
      action: { type: 'none' },
    },
    {
      id: 'languages',
      group: 'Other',
      title: 'Languages',
      subtitle: Object.keys(languagesInfo).join(', '),
      emoji: '🌐',
      keywords: Object.keys(languagesInfo),
      preview: { lines: Object.entries(languagesInfo).map(([language, level]) => `${language}: ${level}`) },
      action: { type: 'terminal', command: 'languages' },
    },
    {
      id: 'contact',
      group: 'Other',
      title: 'Contact Sira',
      subtitle: personalInfo.email,
      emoji: '✉️',
      keywords: ['email', 'contact', 'hire', 'reach out', 'mail'],
      action: { type: 'url', url: `mailto:${personalInfo.email}`, name: 'Mail' },
    },
  ];

  return [...apps, ...sites, ...projects, ...experience, ...skills, ...education, ...other];
};

const fold = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const INDEX = buildIndex().map((item) => ({
  ...item,
  folded: {
    title: fold(item.title),
    subtitle: fold(item.subtitle),
    keywords: (item.keywords || []).map(fold),
    body: fold(item.body),
  },
}));

/** Shown before anything is typed. */
export const SUGGESTED = ['app:pdf', 'app:terminal', 'about', 'site:Turfmapp', 'island'].map((id) => INDEX.find((item) => item.id === id));

/** How well one word matches one field (0 = not at all). */
const scoreField = (field, word) => {
  if (!field) return 0;
  if (field === word) return 100;
  if (field.startsWith(word)) return 90;
  if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}`).test(field)) return 75;
  if (word.length >= 3 && field.includes(word)) return 50;
  return 0;
};

/** Letters of `word` appearing in order in `title` ("trml" -> terminal). */
const subsequence = (title, word) => {
  if (word.length < 3) return 0;
  let i = 0;
  for (const char of title) {
    if (char === word[i]) i++;
    if (i === word.length) return 25;
  }
  return 0;
};

const GROUP_BONUS = { Applications: 4, Projects: 2, Other: 1 };

/** The best matches for `query`, best first. */
export const searchSpotlight = (query, limit = 24) => {
  const folded = fold(query).trim();
  const words = folded.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored = [];
  INDEX.forEach((item) => {
    const { title, subtitle, keywords, body } = item.folded;
    let total = 0;
    for (const word of words) {
      const best = Math.max(
        scoreField(title, word),
        0.8 * Math.max(0, ...keywords.map((keyword) => scoreField(keyword, word))),
        0.6 * scoreField(subtitle, word),
        0.45 * scoreField(body, word),
        subsequence(title, word)
      );
      if (best <= 0) return;
      total += best;
    }
    const score = total / words.length + (title === folded ? 20 : 0) + (GROUP_BONUS[item.group] || 0);
    scored.push({ item, score });
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
};
