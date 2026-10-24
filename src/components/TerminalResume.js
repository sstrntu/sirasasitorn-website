import React, { useState, useEffect, useRef } from 'react';
import './TerminalResume.css';
import { personalInfo } from '../data/personal';
import { aboutInfo } from '../data/about';
import { experienceInfo } from '../data/experience';
import { educationInfo } from '../data/education';
import { skillsInfo } from '../data/skills';
import { projectsInfo } from '../data/projects';
import { languagesInfo } from '../data/languages';
import { SECRET_COMMANDS, completeArgument, runSecret } from './terminalSecrets';

const PROMPT = 'terminal:~ sirasasitorn$';

/** The longest start shared by all the strings. */
const commonPrefix = (words) => words.reduce((prefix, word) => {
    let i = 0;
    while (i < prefix.length && prefix[i] === word[i]) i++;
    return prefix.slice(0, i);
});

/**
 * The résumé as a terminal. `command` ({ text, nonce }) runs a command from
 * outside (Spotlight, the menu bar); `onOpenApp`, `onLeave` (back to the
 * island) and `onClose` let commands act on the desktop.
 */
const TerminalResume = ({ command, onOpenApp, onLeave, onClose }) => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState([]);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const terminalRef = useRef(null);
    const inputRef = useRef(null);
    const runRef = useRef(null);

    const resumeData = {
        ...personalInfo,
        about: aboutInfo,
        experience: experienceInfo,
        education: educationInfo,
        skills: skillsInfo,
        projects: projectsInfo,
        languages: languagesInfo
    };

    const commands = {
        help: () => [
            "AVAILABLE COMMANDS:",
            "─────────────────────",
            "help          - Show this help menu",
            "about         - Display personal information",
            "experience    - Show work experience",
            "education     - Display education background",
            "skills        - List technical skills",
            "projects      - Show notable projects",
            "languages     - Show language proficiencies",
            "contact       - Display contact information",
            "resume        - Download resume (simulation)",
            "clear         - Clear the terminal",
            "exit          - Close the terminal",
            "",
            "Type any command to get started! Tab completes.",
            "(Psst: a few commands aren't on this list.)"
        ],

        about: () => [
            `NAME: ${resumeData.name}`,
            `TITLE: ${resumeData.title}`,
            `LOCATION: ${resumeData.location}`,
            "",
            "PROFESSIONAL SUMMARY:",
            "────────────────────",
            ...resumeData.about.map(line => `  ${line}`)
        ],

        experience: () => {
            const result = ["WORK EXPERIENCE:", "───────────────"];
            let jobIndex = 1;

            resumeData.experience.forEach((item) => {
                if (item.isEarlierRoles) {
                    result.push("");
                    result.push("Earlier Roles:");
                    item.roles.forEach(role => {
                        result.push(`• ${role.position}, ${role.company} (${role.period})`);
                    });
                } else {
                    result.push("");
                    result.push(`${jobIndex}. ${item.position}`);
                    result.push(`   ${item.company}${item.location ? `, ${item.location}` : ''}`);
                    result.push(`   Period: ${item.period}`);
                    item.duties.forEach(duty => result.push(`   ${duty}`));
                    jobIndex++;
                }
            });
            return result;
        },

        education: () => {
            const result = ["EDUCATION:", "─────────"];
            resumeData.education.forEach(edu => {
                result.push("");
                result.push(`${edu.degree}`);
                result.push(`${edu.institution}, ${edu.location}`);
                result.push(`Period: ${edu.period}`);
                if (edu.emphasis) result.push(`Major & Minor Emphasis: ${edu.emphasis}`);
                if (edu.gpa) result.push(`GPA: ${edu.gpa}`);
            });
            return result;
        },

        skills: () => {
            const result = ["TECHNICAL SKILLS:", "───────────────"];
            Object.entries(resumeData.skills).forEach(([category, skillList]) => {
                result.push("");
                result.push(`${category}:`);
                result.push(`  ${skillList.join(", ")}`);
            });
            return result;
        },

        projects: () => {
            const result = ["NOTABLE PROJECTS:", "───────────────"];
            resumeData.projects.forEach((project, index) => {
                result.push("");
                result.push(`${index + 1}. ${project.name}`);
                result.push(`   Tech Stack: ${project.tech}`);
                result.push(`   Description: ${project.description}`);
            });
            return result;
        },

        languages: () => {
            const result = ["LANGUAGES:", "─────────"];
            Object.entries(resumeData.languages).forEach(([language, proficiency]) => {
                result.push("");
                result.push(`${language}: ${proficiency}`);
            });
            return result;
        },

        contact: () => [
            "CONTACT INFORMATION:",
            "───────────────────",
            "",
            `Email: ${resumeData.email}`,
            `Location: ${resumeData.location}`,
            `GitHub: ${resumeData.github}`,
            `LinkedIn: ${resumeData.linkedin}`,
            "",
            "Feel free to reach out for opportunities or collaboration!"
        ],

        resume: () => onOpenApp ? {
            lines: ["Opening Resume.pdf..."],
            then: () => onOpenApp('pdf'),
            delay: 300
        } : [
            "RESUME DOWNLOAD:",
            "───────────────",
            "",
            "Simulating download...",
            "████████████████████ 100%",
            "",
            "Resume downloaded successfully!",
            "(In a real implementation, this would trigger a PDF download)"
        ],

        clear: () => null,

        exit: () => onClose ? {
            lines: ["Thank you for visiting my terminal resume!", "Connection closed..."],
            then: onClose,
            delay: 700
        } : [
            "Thank you for visiting my terminal resume!",
            "Connection closed...",
            "",
            "To restart, refresh the page."
        ]
    };

    const executeCommand = (cmd, history) => {
        const command = cmd.trim().toLowerCase();

        if (command in commands) {
            if (command === 'clear') {
                setOutput([]);
                return;
            }
            return commands[command]();
        } else if (command === '') {
            return null;
        }
        const secret = runSecret(cmd, {
            history,
            run: (name) => commands[name](),
            onOpenApp,
            onLeave
        });
        if (secret) return secret;
        return [
            `'${cmd}' is not recognized as an internal or external command,`,
            "operable program or batch file.",
            "",
            "Type 'help' for a list of available commands."
        ];
    };

    const appendLines = (lines) => {
        setOutput(prev => [...prev, ...lines.map(text => ({ type: 'response', text }))]);
    };

    // Runs a command as if it had been typed: prints the prompt and its output.
    // Commands may answer with lines, { lines, then, delay } or a Promise of lines.
    const run = (raw) => {
        const command = raw.trim();
        const newHistory = [...commandHistory, command];
        setCommandHistory(newHistory);
        setHistoryIndex(-1);
        setInput('');

        // Check if it's a clear command first
        if (command.toLowerCase() === 'clear') {
            setOutput([]);
            return;
        }

        setOutput(prev => [...prev, { type: 'prompt', text: `${PROMPT} ${command}` }]);
        const result = executeCommand(command, newHistory);
        if (!result) return;
        if (typeof result.then === 'function') {
            result.then(appendLines);
        } else if (Array.isArray(result)) {
            appendLines(result);
        } else {
            appendLines(result.lines);
            if (result.then) setTimeout(result.then, result.delay || 0);
        }
    };
    runRef.current = run;

    // Tab: complete the command (or its argument); several matches are listed
    const complete = () => {
        const typed = input.replace(/^\s+/, '').toLowerCase();
        if (!typed) return;
        const space = typed.indexOf(' ');
        const [head, rest] = space === -1 ? [typed, null] : [typed.slice(0, space), typed.slice(space + 1)];
        const options = rest === null
            ? [...new Set([...Object.keys(commands), ...SECRET_COMMANDS])].filter(word => word.startsWith(head))
            : completeArgument(head).filter(word => word.startsWith(rest)).map(word => `${head} ${word}`);
        if (options.length === 0) return;
        if (options.length === 1) {
            setInput(options[0]);
            return;
        }
        const prefix = commonPrefix(options);
        if (prefix.length > typed.length) {
            setInput(prefix);
        } else {
            setOutput(prev => [
                ...prev,
                { type: 'prompt', text: `${PROMPT} ${input}` },
                { type: 'response', text: options.map(option => option.split(' ').pop()).join('    ') }
            ]);
        }
    };

    const handleInputChange = (e) => {
        setInput(e.target.value);
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            run(input);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            complete();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIndex);
                setInput(commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== -1) {
                const newIndex = historyIndex + 1;
                if (newIndex >= commandHistory.length) {
                    setHistoryIndex(-1);
                    setInput('');
                } else {
                    setHistoryIndex(newIndex);
                    setInput(commandHistory[newIndex]);
                }
            }
        }
    };

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [output]);

    useEffect(() => {
        const bootMessages = [
            "Last login: " + new Date().toDateString() + " on ttys000",
            "",
            `Welcome to ${resumeData.name}'s Interactive Resume Terminal!`,
            "",
            "Type 'help' to see available commands.",
            "Type 'about' to start exploring my background.",
            "",
        ];

        setOutput(bootMessages.map(msg => ({ type: 'boot', text: msg })));

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 1000);
    }, []);

    // A command sent from outside (after the boot messages when it opens the terminal)
    useEffect(() => {
        if (command?.text) runRef.current(command.text);
    }, [command]);

    const handleTerminalClick = () => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    return (
        <div className="terminal-body" ref={terminalRef} onClick={handleTerminalClick}>
            <div className="terminal-output">
                {output.map((line, index) => (
                    <div key={index} className={`output-line ${line.type}`}>
                        {line.text}
                    </div>
                ))}
            </div>

            <div className="prompt-line">
                <span className="prompt">{PROMPT}</span>
                <span className="input-container">
                    <span className="input-text">{input}</span>
                    <span className="cursor">█</span>
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    className="terminal-input"
                    autoComplete="off"
                    spellCheck="false"
                />
            </div>
        </div>
    );
};

export default TerminalResume;