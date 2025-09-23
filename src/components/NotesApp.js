import React, { useState } from 'react';
import './NotesApp.css';

const NotesApp = () => {
  const [activeSection, setActiveSection] = useState('about');

  const aboutMeContent = {
    title: "About me",
    description: "Technologist with a background in data engineering, analytics, and applied AI, currently leading a creative agency that bridges technology and creativity to unlock potential. Experienced in applying AI and data engineering to improve operations, increase efficiency, and deliver client-facing solutions. Help clients clarify problems and opportunities, then design AI and analytics solutions that turn ideas into practical results.",
    skills: "I can do...",
    items: [
      "Data Engineering & Analytics",
      "Applied AI & Machine Learning",
      "Full-Stack Development",
      "System Architecture & Design",
      "Project Management & Leadership",
      "Client Strategy & Consultation",
      "Technology Integration",
      "Business Process Optimization",
      "Team Building & Mentorship",
      "Creative Technology Solutions"
    ]
  };

  const cvContent = {
    title: "CV",
    description: "Professional experience and technical expertise in data engineering, AI/ML, and technology leadership.",
    skills: "Experience & Skills",
    items: [
      "Managing Director / AI & Data Engineering Lead",
      "Full-Stack Software Engineer",
      "Data Analytics Engineer",
      "Machine Learning Engineer",
      "Python, JavaScript, React, Node.js",
      "AWS, Docker, Kubernetes",
      "PostgreSQL, MongoDB, Redis",
      "TensorFlow, PyTorch, Scikit-learn",
      "Data Pipelines & ETL Systems",
      "RESTful APIs & Microservices"
    ]
  };

  const currentContent = activeSection === 'about' ? aboutMeContent : cvContent;

  return (
    <div className="notes-app">
      <div className="notes-sidebar">
        <div
          className={`notes-section ${activeSection === 'about' ? 'active' : ''}`}
          onClick={() => setActiveSection('about')}
        >
          <span className="notes-section-name">About me</span>
          <span className="notes-section-count">18</span>
        </div>
        <div
          className={`notes-section ${activeSection === 'cv' ? 'active' : ''}`}
          onClick={() => setActiveSection('cv')}
        >
          <span className="notes-section-name">CV</span>
          <span className="notes-section-count">48</span>
        </div>
      </div>

      <div className="notes-content">
        <h1 className="notes-title">{currentContent.title}</h1>
        <p className="notes-description">{currentContent.description}</p>

        <h2 className="notes-subtitle">{currentContent.skills}</h2>
        <div className="notes-list">
          {currentContent.items.map((item, index) => (
            <div key={index} className="notes-item">
              <div className="notes-checkmark">✓</div>
              <span className="notes-item-text">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotesApp;