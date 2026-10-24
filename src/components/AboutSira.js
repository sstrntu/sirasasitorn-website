import React, { useEffect } from 'react';
import { personalInfo } from '../data/personal';
import { experienceInfo } from '../data/experience';
import { languagesInfo } from '../data/languages';
import { DESKTOP_WALLPAPER } from '../data/desktopWallpaper';
import { siraStatus } from '../services/bangkokTime';
import './AboutSira.css';

const titleCase = (text) => text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * "About This Mac", for the person instead of the laptop: the island laptop,
 * Sira's name and role, and his specs. Opened from the menu bar's palm menu.
 */
const AboutSira = ({ onClose, onMoreInfo }) => {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const companies = [...new Set(experienceInfo.filter((role) => !role.isEarlierRoles).map((role) => role.company))];
  const status = siraStatus();
  const specs = [
    ['Chip', 'Data engineering + applied AI'],
    ['Memory', `${companies.join(', ')} and earlier roles`],
    ['Languages', Object.keys(languagesInfo).join(', ')],
    ['Startup Disk', 'Bangkok, Thailand'],
    ['Serial Number', 'SIRA-KRABI-26'],
    ['macOS', 'Island 26 (Krabi)'],
    ['Status', `${status.emoji} ${status.text}`],
  ];

  return (
    <div className="about-sira" role="dialog" aria-labelledby="about-sira-name">
      <button type="button" className="about-sira-close" aria-label="Close" onClick={onClose} />
      <div className="about-sira-laptop" aria-hidden="true">
        <div className="about-sira-screen" style={{ backgroundImage: `url(${DESKTOP_WALLPAPER})` }} />
        <div className="about-sira-base" />
      </div>
      <h2 id="about-sira-name">{titleCase(personalInfo.name)}</h2>
      <p className="about-sira-role">{personalInfo.title}</p>
      <dl className="about-sira-specs">
        {specs.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="about-sira-more" onClick={onMoreInfo}>More Info…</button>
      <p className="about-sira-legal">™ and © {new Date().getFullYear()} {titleCase(personalInfo.name)}. All Rights Reserved.</p>
    </div>
  );
};

export default AboutSira;
