# Technical Design Document

## Architecture Overview

This RAG implementation uses Amazon Kendra for document indexing and semantic search, combined with Amazon Bedrock (Claude 4) for response generation. The system consists of a React frontend hosted locally and a Node.js backend deployed on AWS using CDK.

## System Components

### Frontend (React Application)
- **Technology**: React.js (no Tailwind CSS)
- **Hosting**: Local development server
- **Features**:
  - Question input interface
  - Sample questions display
  - Response display area
  - Loading indicators

### Backend (Node.js API)
- **Technology**: Node.js with Express
- **Runtime**: AWS Lambda with Node.js
- **API Gateway**: REST API for frontend communication
- **Features**:
  - Document ingestion endpoint
  - Question processing endpoint
  - Kendra search integration
  - Bedrock response generation

### Document Storage and Search
- **Amazon Kendra**: Document indexing and semantic search
  - Handles document ingestion from S3
  - Converts documents to vector embeddings automatically
  - Provides semantic search capabilities
- **Amazon S3**: Document storage bucket
  - Stores documents from ~/ea_sample_docs/rag_docs
  - Configured as Kendra data source

### AI Response Generation
- **Amazon Bedrock**: LLM service with Claude 4
  - Generates comprehensive responses
  - Uses full document context from Kendra results
  - Provides detailed, accurate answers

## Data Flow

```
1. Document Ingestion:
   Local Docs → S3 Bucket → Kendra Index → Vector Embeddings

2. Question Processing:
   User Question → API Gateway → Lambda → Kendra Search → Document Retrieval → Bedrock (Claude 4) → Response → Frontend
```

## API Design

### Endpoints

#### POST /api/ingest
- **Purpose**: Trigger document ingestion
- **Request**: Empty body
- **Response**: Ingestion status and document count

#### POST /api/query
- **Purpose**: Process user questions
- **Request**: 
  ```json
  {
    "question": "string"
  }
  ```
- **Response**:
  ```json
  {
    "answer": "string",
    "sources": ["string"],
    "confidence": "number"
  }
  ```

#### GET /api/sample-questions
- **Purpose**: Retrieve sample questions
- **Response**:
  ```json
  {
    "questions": [
      {
        "id": "string",
        "text": "string",
        "category": "string"
      }
    ]
  }
  ```

## AWS Infrastructure

### Core Services
- **Amazon Kendra**: Document indexing and search
- **Amazon Bedrock**: Claude 4 LLM for response generation
- **Amazon S3**: Document storage
- **AWS Lambda**: Backend API functions
- **Amazon API Gateway**: REST API endpoint
- **AWS CDK**: Infrastructure as Code

### Security and Permissions
- **IAM Roles**: Lambda execution role with permissions for:
  - Kendra index access
  - Bedrock model invocation
  - S3 bucket read access
- **API Gateway**: CORS configuration for local frontend

## Implementation Considerations

### Document Processing
- Support for common document formats (PDF, TXT, DOCX)
- Automatic document detection and ingestion
- Error handling for unsupported formats

### Search and Retrieval
- Kendra handles vector embeddings automatically
- Semantic search for better relevance
- Confidence scoring for result quality

### Response Generation
- Use full document context, not snippets
- Claude 4 for comprehensive, detailed responses
- Proper error handling for API limits

### Frontend Features
- Responsive design for various screen sizes
- Real-time loading indicators
- Sample questions organized by category
- Clear response formatting

## Sample Questions Categories

### Broad Concepts
- "What are the main topics covered in the documents?"
- "Explain the key principles discussed"

### Specific Details
- "What are the specific requirements for X?"
- "How is Y implemented according to the documentation?"

### Technical Patterns
- "What technical approaches are recommended?"
- "What are the best practices mentioned?"

## Performance Considerations

- **Kendra Index**: Optimized for document corpus size
- **Lambda Functions**: Appropriate memory allocation for processing
- **Frontend**: Efficient state management and API calls
- **Caching**: Consider response caching for common queries

## Testing Strategy

- **Unit Tests**: Backend API functions
- **Integration Tests**: Kendra and Bedrock integration
- **End-to-End Tests**: Complete user workflow
- **Response Validation**: Accuracy against source documents
