import React, { useState, useEffect } from 'react';
import './NotesApp.css';

const NotesApp = () => {
  const [activeSection, setActiveSection] = useState(null);
  const [notesData, setNotesData] = useState(null);
  const [sectionKeys, setSectionKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fallback data if API is unavailable
  const fallbackData = {
    about: {
      title: "About me",
      description: "Technologist with a background in data engineering, analytics, and applied AI, currently leading a creative agency that bridges technology and creativity to unlock potential. Experienced in applying AI and data engineering to improve operations, increase efficiency, and deliver client-facing solutions—designing and deploying custom tools and analytics platforms that turn client challenges into measurable results.",
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
    },
    cv: {
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
    }
  };

  // Fetch notes from API
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8007';
        const response = await fetch(`${apiUrl}/api/notes`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch notes');
        }

        const data = await response.json();
        
        // Transform API data to component format
        if (data && data.length > 0) {
          const transformed = {};
          const keys = [];
          data.forEach(section => {
            transformed[section.section_key] = {
              title: section.title,
              description: section.description,
              skills: section.skills_header,
              items: section.skills_items
            };
            keys.push(section.section_key);
          });
          setNotesData(transformed);
          setSectionKeys(keys);
          // Set first section as active
          if (!activeSection && keys.length > 0) {
            setActiveSection(keys[0]);
          }
        } else {
          // Use fallback if no data
          setNotesData(fallbackData);
          setSectionKeys(['about', 'cv']);
          setActiveSection('about');
        }
      } catch (error) {
        console.warn('Failed to fetch notes from API, using fallback data:', error.message);
        setNotesData(fallbackData);
        setSectionKeys(['about', 'cv']);
        setActiveSection('about');
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [activeSection]);

  // Get current section data
  const getCurrentContent = () => {
    if (loading) {
      return {
        title: 'Loading...',
        description: '',
        skills: '',
        items: []
      };
    }

    const data = notesData || fallbackData;
    return data[activeSection] || data[sectionKeys[0]] || data.about;
  };

  const currentContent = getCurrentContent();

  return (
    <div className="notes-app">
      <div className="notes-sidebar">
        {sectionKeys.map((sectionKey) => {
          const sectionData = (notesData || fallbackData)[sectionKey];
          const itemCount = sectionData?.items?.length || 0;
          
          return (
            <div
              key={sectionKey}
              className={`notes-section ${activeSection === sectionKey ? 'active' : ''}`}
              onClick={() => setActiveSection(sectionKey)}
            >
              <span className="notes-section-name">{sectionData?.title || sectionKey}</span>
              <span className="notes-section-count">{itemCount}</span>
            </div>
          );
        })}
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