/*
 * Commands the terminal's `help` doesn't list. `runSecret` returns lines to
 * print, `{ lines, then, delay }` to do something once they're printed (open
 * an app, fly back to the island), a Promise of lines, or null if the command
 * isn't one of these.
 */
import { personalInfo } from '../data/personal';
import { languagesInfo } from '../data/languages';
import { describeWeather, fetchWeather } from '../services/weather';
import { bangkokClock, bangkokDateTime, siraStatus } from '../services/bangkokTime';
import { weatherEmoji } from './SystemIcons';

/** Files `ls` shows, and the visible command each one prints. */
const FILES = {
  'about.txt': 'about',
  'contact.txt': 'contact',
  'education.txt': 'education',
  'experience.txt': 'experience',
  'languages.txt': 'languages',
  'projects.txt': 'projects',
  'skills.txt': 'skills',
};

/** Apps `open` knows, by the desktop window they open. */
const APPS = { resume: 'pdf', 'resume.pdf': 'pdf', notes: 'notes', maps: 'maps', messages: 'messages', terminal: 'terminal' };

/** Words to tab-complete (with `help`'s commands). */
export const SECRET_COMMANDS = ['ssh island', 'sudo hire-sira', 'whoami', 'date', 'weather', 'ping sira', 'neofetch', 'ls', 'cat', 'pwd', 'echo', 'history', 'coffee', 'open', 'hello'];

/** Completions for a command's argument (`cat ab` -> about.txt). */
export const completeArgument = (command) => {
  if (command === 'cat') return [...Object.keys(FILES), '.secret'];
  if (command === 'open') return Object.keys(APPS);
  if (command === 'ssh') return ['island'];
  if (command === 'ping') return ['sira'];
  return [];
};

const titleCase = (text) => text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const PALM = [
  '        __  __        ',
  '     .-\'  \\/  \'-.     ',
  '    /  .-\'||\'-.  \\    ',
  '       /  ||  \\       ',
  '          ||          ',
  '          ||          ',
  '          ||          ',
  '    ~~~~~~||~~~~~~~   ',
  '  ~~~~~~~~~~~~~~~~~~~ ',
];

const weatherLine = (weather) =>
  `${weatherEmoji(weather)} ${Math.round(weather.temperature ?? 27)}°C, ${weather.label.toLowerCase()}`;

const neofetch = async () => {
  const weather = describeWeather(await fetchWeather());
  const info = [
    'visitor@island',
    '--------------',
    'OS: Island OS 26 (Krabi)',
    `Host: ${titleCase(personalInfo.name)}`,
    `Role: ${personalInfo.title}`,
    'Location: Bangkok, Thailand (UTC+7)',
    `Time: ${bangkokClock()} ICT`,
    weather ? `Weather: ${weatherLine(weather)}` : null,
    `Languages: ${Object.keys(languagesInfo).join(', ')}`,
    'Shell: zsh',
  ].filter(Boolean);
  const rows = Math.max(PALM.length, info.length);
  return Array.from({ length: rows }, (_, i) => `${PALM[i] || ' '.repeat(PALM[0].length)}  ${info[i] || ''}`);
};

/**
 * Runs `input` if it's a secret command. `ctx`: { history, run (a visible
 * command's lines), onOpenApp, onLeave }.
 */
export const runSecret = (input, ctx) => {
  const text = input.trim();
  const [command, ...args] = text.split(/\s+/);
  const name = command.toLowerCase();
  const arg = args.join(' ');

  switch (name) {
    case 'ssh':
      if (!/^(sira@)?(island|camp)$/i.test(arg)) return ['usage: ssh island'];
      return {
        lines: [
          'Connecting to island.krabi (8.01°N, 98.84°E)...',
          'Authenticated with key "coconut".',
          'Welcome back to camp. Closing the laptop...',
        ],
        then: ctx.onLeave,
        delay: 1400,
      };

    case 'sudo':
      if (/^hire[- ]?sira$/i.test(arg)) {
        return {
          lines: [
            '[sudo] password for visitor: ••••••••',
            '✓ Access granted.',
            `Opening an email to Sira (${personalInfo.email})...`,
          ],
          then: () => window.open(`mailto:${personalInfo.email}?subject=${encodeURIComponent("Let's work together")}`, '_blank'),
          delay: 1200,
        };
      }
      if (/^rm\s+-rf/i.test(arg)) return ['Nice try. 🙃'];
      return ['visitor is not in the sudoers file. This incident will be reported (to Sira, who will laugh).'];

    case 'rm':
      return /-rf/.test(arg) ? ['Nice try. 🙃'] : [`rm: ${arg || 'missing operand'}: Permission denied`];

    case 'hire':
      return ['Permission denied. Try: sudo hire-sira'];

    case 'whoami':
      return ['visitor', "(Welcome! Try 'neofetch', or 'ssh island' to go back to camp.)"];

    case 'date':
      return [`${bangkokDateTime()} ICT (Bangkok, UTC+7)`];

    case 'weather':
      return fetchWeather().then((reading) => {
        const weather = describeWeather(reading);
        if (!weather) return ['weather: could not reach the sky over Krabi. Try again in a bit.'];
        return [
          `${weather.location}: ${weatherLine(weather)}`,
          `Wind ${Math.round(weather.wind)} m/s${weather.windFrom ? ` from the ${weather.windFrom}` : ''}, cloud cover ${Math.round(weather.cloud * 100)}%`,
          'The island has the same weather right now.',
        ];
      });

    case 'ping': {
      if (!/^sira$/i.test(arg)) return [`ping: cannot resolve ${arg || 'host'}: Unknown host`];
      const status = siraStatus();
      const ms = () => (32 + Math.random() * 26).toFixed(1);
      return [
        'PING sira (Bangkok, UTC+7): 56 data bytes',
        `64 bytes from sira: icmp_seq=0 ttl=64 time=${ms()} ms`,
        `64 bytes from sira: icmp_seq=1 ttl=64 time=${ms()} ms`,
        `64 bytes from sira: icmp_seq=2 ttl=64 time=${ms()} ms`,
        '--- sira ping statistics ---',
        `3 packets transmitted, 3 received. Status: ${status.text.toLowerCase()} ${status.emoji}`,
      ];
    }

    case 'neofetch':
      return neofetch();

    case 'ls':
      if (/^island\/?$/i.test(args.filter((a) => !a.startsWith('-')).join(''))) {
        return ['campfire/  chair/  kayak/  tent/  waterfalls/'];
      }
      if (/^island\/waterfalls\/?$/i.test(arg)) return ["ls: island/waterfalls: Permission denied. You'll have to go and look."];
      return [
        `${args.includes('-a') || args.includes('-la') ? '.  ..  .secret  ' : ''}${Object.keys(FILES).join('  ')}  island/`,
      ];

    case 'cat':
      if (!arg) return ['usage: cat <file>   (try ls)'];
      if (arg === '.secret') {
        return [
          "There's more to the island than the camp.",
          'Look closely at the waterfalls. 🌊',
          '(ssh island)',
        ];
      }
      if (FILES[arg]) return ctx.run(FILES[arg]);
      return [`cat: ${arg}: No such file or directory`];

    case 'cd':
      if (/^island\/?$/i.test(arg)) return ["cd: island: it's a remote host. Try: ssh island"];
      return arg && arg !== '~' ? [`cd: no such file or directory: ${arg}`] : [];

    case 'pwd':
      return ['/Users/visitor/camp'];

    case 'echo':
      return [arg];

    case 'history':
      return ctx.history.filter(Boolean).map((line, i) => `${String(i + 1).padStart(4)}  ${line}`);

    case 'coffee':
    case 'brew':
      return ['☕ Brewing...', 'Done. Best enjoyed with a view of the karsts.'];

    case 'open': {
      const app = APPS[arg.toLowerCase()];
      if (!app) return [arg ? `The file /Users/visitor/${arg} does not exist.` : 'usage: open resume | notes | maps | messages'];
      return { lines: [`Opening ${arg}...`], then: () => ctx.onOpenApp?.(app), delay: 300 };
    }

    case 'vim':
    case 'vi':
    case 'nano':
    case 'emacs':
      return [`Opening ${name}... just kidding. You'd never get out. 🙂`];

    case 'hello':
    case 'hi':
    case 'hey':
      return ["Hi there 👋 Type 'help' to look around, or 'ssh island' to go back to camp."];

    default:
      return null;
  }
};
