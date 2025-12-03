import React, { useState, useEffect } from 'react';
import './App.css';

interface SampleQuestion {
  id: string;
  text: string;
  category: string;
}

interface QueryResponse {
  answer: string;
  sources: string[];
  confidence: string;
}

const API_BASE_URL = 'https://iap0wlg852.execute-api.us-east-1.amazonaws.com/prod/api';

function App() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sampleQuestions, setSampleQuestions] = useState<SampleQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSampleQuestions();
  }, []);

  const fetchSampleQuestions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sample-questions`);
      const data = await res.json();
      setSampleQuestions(data.questions);
    } catch (err) {
      console.error('Failed to fetch sample questions:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`${API_BASE_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleQuestionClick = (questionText: string) => {
    setQuestion(questionText);
  };

  const triggerIngestion = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (res.ok) {
        alert('Document ingestion triggered successfully! Please wait a few minutes for indexing to complete.');
      } else {
        alert('Failed to trigger ingestion');
      }
    } catch (err) {
      alert('Error triggering ingestion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>RAG Document Q&A System</h1>
        <p>Ask questions about the SaaS Architecture Fundamentals document</p>
      </header>

      <main className="main-content">
        <div className="ingestion-section">
          <button onClick={triggerIngestion} disabled={loading} className="ingest-button">
            Trigger Document Ingestion
          </button>
        </div>

        <div className="question-section">
          <h2>Ask a Question</h2>
          <form onSubmit={handleSubmit} className="question-form">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter your question about SaaS architecture..."
              rows={4}
              className="question-input"
            />
            <button type="submit" disabled={loading || !question.trim()} className="submit-button">
              {loading ? 'Processing...' : 'Ask Question'}
            </button>
          </form>
        </div>

        <div className="sample-questions-section">
          <h2>Sample Questions</h2>
          <div className="questions-grid">
            {sampleQuestions.map((q) => (
              <div key={q.id} className="question-card">
                <div className="question-category">{q.category}</div>
                <button
                  onClick={() => handleSampleQuestionClick(q.text)}
                  className="sample-question-button"
                >
                  {q.text}
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="error-section">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        )}

        {response && (
          <div className="response-section">
            <h2>Answer</h2>
            <div className="answer-content">
              <p>{response.answer}</p>
            </div>
            
            {response.sources.length > 0 && (
              <div className="sources-section">
                <h3>Sources</h3>
                <ul>
                  {response.sources.map((source, index) => (
                    <li key={index}>{source}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="confidence-section">
              <p><strong>Confidence:</strong> {response.confidence}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
