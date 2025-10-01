/**
 * Data Migration Script
 * Migrates existing hardcoded data to Supabase database
 * 
 * Run with: node backend/scripts/migrateData.js
 */

const path = require('path');

// Load environment from backend/.env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = require('../services/supabase');
const ragService = require('../services/ragService');

// Hardcoded locations data (from src/data/locations.js)
const locationsData = [
  { city: "New York", country: "United States" },
  { city: "Chicago", country: "United States" },
  { city: "Tokyo", country: "Japan" },
  { city: "London", country: "United Kingdom" },
  { city: "Sydney", country: "Australia" },
  { city: "Bangkok", country: "Thailand" },
  { city: "Beijing", country: "China" },
  { city: "Rio de Janeiro", country: "Brazil" },
  { city: "Toronto", country: "Canada" },
  { city: "Prague", country: "Czech Republic" },
  { city: "Budapest", country: "Hungary" },
  { city: "Munich", country: "Germany" },
  { city: "Vienna", country: "Austria" },
  { city: "Milan", country: "Italy" },
  { city: "Zurich", country: "Switzerland" },
  { city: "Kuala Lumpur", country: "Malaysia" },
  { city: "Hong Kong", country: "China" }
];

// Hardcoded notes data (from NotesApp.js)
const notesData = [
  {
    section_key: 'about',
    title: 'About me',
    description: 'Technologist with a background in data engineering, analytics, and applied AI, currently leading a creative agency that bridges technology and creativity to unlock potential. Experienced in applying AI and data engineering to improve operations, increase efficiency, and deliver client-facing solutions—designing and deploying custom tools and analytics platforms that turn client challenges into measurable results.',
    skills_header: 'I can do...',
    skills_items: [
      'Data Engineering & Analytics',
      'Applied AI & Machine Learning',
      'Full-Stack Development',
      'System Architecture & Design',
      'Project Management & Leadership',
      'Client Strategy & Consultation',
      'Technology Integration',
      'Business Process Optimization',
      'Team Building & Mentorship',
      'Creative Technology Solutions'
    ],
    order_index: 0
  },
  {
    section_key: 'cv',
    title: 'CV',
    description: 'Professional experience and technical expertise in data engineering, AI/ML, and technology leadership.',
    skills_header: 'Experience & Skills',
    skills_items: [
      'Managing Director / AI & Data Engineering Lead',
      'Full-Stack Software Engineer',
      'Data Analytics Engineer',
      'Machine Learning Engineer',
      'Python, JavaScript, React, Node.js',
      'AWS, Docker, Kubernetes',
      'PostgreSQL, MongoDB, Redis',
      'TensorFlow, PyTorch, Scikit-learn',
      'Data Pipelines & ETL Systems',
      'RESTful APIs & Microservices'
    ],
    order_index: 1
  }
];

// Geocoding function (simplified)
async function geocodeLocation(city, country) {
  // This would normally use a geocoding API
  // For migration, you can manually provide coordinates or use a geocoding service
  const hardcodedCoordinates = {
    'New York, United States': { lat: 40.7128, lng: -74.0060 },
    'Chicago, United States': { lat: 41.8781, lng: -87.6298 },
    'Tokyo, Japan': { lat: 35.6762, lng: 139.6503 },
    'London, United Kingdom': { lat: 51.5074, lng: -0.1278 },
    'Sydney, Australia': { lat: -33.8688, lng: 151.2093 },
    'Bangkok, Thailand': { lat: 13.7563, lng: 100.5018 },
    'Beijing, China': { lat: 39.9042, lng: 116.4074 },
    'Rio de Janeiro, Brazil': { lat: -22.9068, lng: -43.1729 },
    'Toronto, Canada': { lat: 43.6532, lng: -79.3832 },
    'Prague, Czech Republic': { lat: 50.0755, lng: 14.4378 },
    'Budapest, Hungary': { lat: 47.4979, lng: 19.0402 },
    'Munich, Germany': { lat: 48.1351, lng: 11.5820 },
    'Vienna, Austria': { lat: 48.2082, lng: 16.3738 },
    'Milan, Italy': { lat: 45.4642, lng: 9.1900 },
    'Zurich, Switzerland': { lat: 47.3769, lng: 8.5417 },
    'Kuala Lumpur, Malaysia': { lat: 3.1390, lng: 101.6869 },
    'Hong Kong, China': { lat: 22.3193, lng: 114.1694 }
  };

  const key = `${city}, ${country}`;
  return hardcodedCoordinates[key] || { lat: 0, lng: 0 };
}

async function migrateNotes() {
  console.log('\n📝 Migrating notes sections...');
  
  if (!supabase) {
    console.error('❌ Supabase not configured');
    return false;
  }

  try {
    for (const note of notesData) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('notes_sections')
        .select('id')
        .eq('section_key', note.section_key)
        .single();

      if (existing) {
        console.log(`⏭️  Skipping "${note.title}" (already exists)`);
        continue;
      }

      // Insert
      const { error } = await supabase
        .from('notes_sections')
        .insert(note);

      if (error) {
        console.error(`❌ Failed to insert "${note.title}":`, error.message);
      } else {
        console.log(`✅ Migrated "${note.title}"`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

async function migrateLocations() {
  console.log('\n📍 Migrating map locations...');
  
  if (!supabase) {
    console.error('❌ Supabase not configured');
    return false;
  }

  try {
    for (const location of locationsData) {
      // Geocode
      const coords = await geocodeLocation(location.city, location.country);
      
      if (!coords || (coords.lat === 0 && coords.lng === 0)) {
        console.warn(`⚠️  No coordinates for ${location.city}, ${location.country}`);
        continue;
      }

      // Check if already exists
      const { data: existing } = await supabase
        .from('map_locations')
        .select('id')
        .eq('city', location.city)
        .eq('country', location.country)
        .single();

      if (existing) {
        console.log(`⏭️  Skipping ${location.city}, ${location.country} (already exists)`);
        continue;
      }

      // Insert
      const { error } = await supabase
        .from('map_locations')
        .insert({
          city: location.city,
          country: location.country,
          latitude: coords.lat,
          longitude: coords.lng,
          description: null,
          category: 'travel',
          is_active: true
        });

      if (error) {
        console.error(`❌ Failed to insert ${location.city}:`, error.message);
      } else {
        console.log(`✅ Migrated ${location.city}, ${location.country}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

async function migrateKnowledgeBase() {
  console.log('\n🧠 Migrating knowledge base (RAG documents)...');
  
  if (!ragService.isEnabled()) {
    console.error('❌ RAG service not enabled');
    return false;
  }

  try {
    // Sample knowledge base documents
    const documents = [
      {
        title: 'About Sira',
        content: `Sira is a technologist with a background in data engineering, analytics, and applied AI. Currently leading a creative agency that bridges technology and creativity to unlock potential. Experienced in applying AI and data engineering to improve operations, increase efficiency, and deliver client-facing solutions—designing and deploying custom tools and analytics platforms that turn client challenges into measurable results.`,
        category: 'about'
      },
      {
        title: 'Technical Skills',
        content: `Sira has expertise in: Data Engineering & Analytics, Applied AI & Machine Learning, Full-Stack Development, System Architecture & Design, Project Management & Leadership, Client Strategy & Consultation, Technology Integration, Business Process Optimization, Team Building & Mentorship, and Creative Technology Solutions.`,
        category: 'skills'
      },
      {
        title: 'Technology Stack',
        content: `Sira works with: Python, JavaScript, React, Node.js, AWS, Docker, Kubernetes, PostgreSQL, MongoDB, Redis, TensorFlow, PyTorch, Scikit-learn. Experience building data pipelines, ETL systems, RESTful APIs, and microservices.`,
        category: 'skills'
      },
      {
        title: 'Current Role',
        content: `Managing Director and AI & Data Engineering Lead at a creative agency. Focuses on bridging technology and creativity, applying AI and data engineering to solve business challenges, and building custom tools and analytics platforms.`,
        category: 'experience'
      }
    ];

    for (const doc of documents) {
      // Check if similar document exists
      const { data: existing } = await supabase
        .from('knowledge_base')
        .select('id')
        .eq('title', doc.title)
        .single();

      if (existing) {
        console.log(`⏭️  Skipping "${doc.title}" (already exists)`);
        continue;
      }

      // Add document (auto-generates embedding)
      try {
        await ragService.addDocument(doc.title, doc.content, doc.category, {});
        console.log(`✅ Migrated "${doc.title}"`);
      } catch (error) {
        console.error(`❌ Failed to add "${doc.title}":`, error.message);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

async function migrate() {
  console.log('🚀 Starting data migration...\n');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Supabase URL:', process.env.SUPABASE_URL ? '✅ Configured' : '❌ Not configured');
  console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured');

  const results = {
    notes: await migrateNotes(),
    locations: await migrateLocations(),
    knowledge: await migrateKnowledgeBase()
  };

  console.log('\n📊 Migration Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Notes:        ${results.notes ? '✅ Success' : '❌ Failed'}`);
  console.log(`Locations:    ${results.locations ? '✅ Success' : '❌ Failed'}`);
  console.log(`Knowledge:    ${results.knowledge ? '✅ Success' : '❌ Failed'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (results.notes && results.locations && results.knowledge) {
    console.log('✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Visit your website and check the Notes app');
    console.log('2. Check the Maps app for locations');
    console.log('3. Try the Messages app - it should use RAG context');
    console.log('4. Access /admin to manage content (coming soon)\n');
  } else {
    console.log('⚠️  Migration completed with errors. Check logs above.\n');
  }
}

// Run migration
migrate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
