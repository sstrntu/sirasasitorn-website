/**
 * RAG (Retrieval Augmented Generation) Service
 * Handles vector embeddings, similarity search, and context building for AI chat
 */

const { OpenAI } = require('openai');
const supabase = require('./supabase');

class RAGService {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API;
    
    if (!apiKey) {
      console.warn('⚠️ OpenAI API key not configured. RAG features will be disabled.');
      this.openai = null;
      this.enabled = false;
      return;
    }

    if (!supabase) {
      console.warn('⚠️ Supabase not configured. RAG features will be disabled.');
      this.openai = null;
      this.enabled = false;
      return;
    }

    this.openai = new OpenAI({ apiKey });
    this.enabled = true;
    console.log('✅ RAG service initialized');
  }

  /**
   * Generate embedding for given text using OpenAI
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} - Embedding vector
   */
  async generateEmbedding(text) {
    if (!this.enabled) {
      throw new Error('RAG service not enabled');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000) // Limit input length
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Search knowledge base using vector similarity
   * @param {string} query - User query
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>} - Relevant documents
   */
  async searchKnowledgeBase(query, limit = 3) {
    if (!this.enabled) {
      return [];
    }

    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      // Perform vector similarity search using Supabase RPC
      const { data, error } = await supabase.rpc('match_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7, // Similarity threshold
        match_count: limit
      });

      if (error) {
        console.error('Vector search error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Knowledge base search error:', error);
      return [];
    }
  }

  /**
   * Build RAG context from search results
   * @param {string} userQuery - User's question
   * @returns {Promise<Object>} - Context and sources
   */
  async buildRAGContext(userQuery) {
    if (!this.enabled) {
      return {
        context: '',
        sources: []
      };
    }

    try {
      const results = await this.searchKnowledgeBase(userQuery, 3);

      if (!results || results.length === 0) {
        return {
          context: '',
          sources: []
        };
      }

      // Build context from results
      const contextParts = results.map((doc, idx) => {
        return `[Source ${idx + 1}: ${doc.title}]
${doc.content}`;
      });

      const context = contextParts.join('\n\n');

      const sources = results.map(doc => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        similarity: doc.similarity
      }));

      return { context, sources };
    } catch (error) {
      console.error('Failed to build RAG context:', error);
      return {
        context: '',
        sources: []
      };
    }
  }

  /**
   * Add a new document to knowledge base with embedding
   * @param {string} title - Document title
   * @param {string} content - Document content
   * @param {string} category - Document category
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Created document
   */
  async addDocument(title, content, category, metadata = {}) {
    if (!this.enabled) {
      throw new Error('RAG service not enabled');
    }

    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(content);

      // Insert document
      const { data, error } = await supabase
        .from('knowledge_base')
        .insert({
          title,
          content,
          category,
          embedding,
          metadata,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log(`✅ Added document: ${title}`);
      return data;
    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  }

  /**
   * Update a document and regenerate embedding
   * @param {string} id - Document ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} - Updated document
   */
  async updateDocument(id, updates) {
    if (!this.enabled) {
      throw new Error('RAG service not enabled');
    }

    try {
      // If content changed, regenerate embedding
      if (updates.content) {
        updates.embedding = await this.generateEmbedding(updates.content);
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('knowledge_base')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log(`✅ Updated document: ${id}`);
      return data;
    } catch (error) {
      console.error('Failed to update document:', error);
      throw error;
    }
  }

  /**
   * Delete a document from knowledge base
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} - Success
   */
  async deleteDocument(id) {
    if (!this.enabled) {
      throw new Error('RAG service not enabled');
    }

    try {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      console.log(`✅ Deleted document: ${id}`);
      return true;
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  }

  /**
   * Check if RAG service is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}

module.exports = new RAGService();
