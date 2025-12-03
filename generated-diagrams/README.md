# RAG Implementation - AWS Architecture Diagrams

This directory contains comprehensive AWS architecture diagrams for the RAG (Retrieval-Augmented Generation) implementation project.

## Generated Diagrams

### 1. RAG Architecture Overview (`rag_architecture.png`)
**Purpose**: High-level system architecture showing all major components and their relationships.

**Components**:
- User and React Frontend (local development)
- AWS API Gateway (REST API)
- Lambda Functions (Node.js backend)
- Amazon S3 (document storage)
- Amazon Kendra (document indexing and semantic search)
- Amazon Bedrock (Claude 4 for response generation)
- IAM Role (security and permissions)

**Key Features**:
- Left-to-right data flow from user to AWS services
- Clear separation between frontend and AWS cloud services
- Shows all major AWS services used in the implementation

### 2. Data Flow Diagram (`rag_data_flow.png`)
**Purpose**: Detailed view of document ingestion and query processing workflows.

**Document Ingestion Flow**:
1. Local documents → S3 Bucket upload
2. S3 Bucket → Kendra Index (automatic vectorization)

**Query Processing Flow**:
1. User Question → React Interface
2. React → API Gateway → Lambda
3. Lambda → Kendra Search (semantic search)
4. Kendra results → Bedrock Claude 4 (response generation)
5. Generated response back through the chain to user

### 3. API Architecture (`rag_api_architecture.png`)
**Purpose**: Detailed view of API endpoints and their corresponding Lambda functions.

**API Endpoints**:
- `POST /api/ingest` - Document ingestion Lambda
- `POST /api/query` - Question processing Lambda  
- `GET /api/sample-questions` - Sample questions Lambda

**Data Stores**:
- S3 Bucket for document storage
- Kendra Index for search capabilities
- DynamoDB for sample questions storage
- Bedrock for AI response generation

### 4. Security & Permissions (`rag_security.png`)
**Purpose**: IAM roles, policies, and security configuration.

**Security Components**:
- Lambda Execution Role with specific permissions
- Kendra Access Policy (query and index operations)
- Bedrock Access Policy (model invocation)
- S3 Access Policy (read documents)
- DynamoDB Access Policy (read sample questions)
- API Gateway CORS configuration for local frontend

### 5. Deployment Architecture (`rag_deployment.png`)
**Purpose**: CDK-based infrastructure deployment workflow.

**Deployment Flow**:
- Developer uses AWS CDK CLI
- CDK Stack defines infrastructure as code
- CDK Constructs for each AWS service
- Automated deployment to AWS resources

**CDK Resources**:
- Lambda Constructs
- API Gateway Construct
- S3 Bucket Construct
- Kendra Index Construct
- IAM Role Construct
- DynamoDB Construct

## Architecture Principles

### Design Decisions
1. **Amazon Kendra**: Chosen for automatic document vectorization and semantic search capabilities
2. **Amazon Bedrock (Claude 4)**: Selected for high-quality response generation using full document context
3. **DynamoDB**: Used as the backend data store for sample questions (as per requirements)
4. **No Authentication**: Prototype implementation without authentication services
5. **Local React Frontend**: Development setup without CloudFront distribution

### Key Benefits
- **Serverless Architecture**: Cost-effective with automatic scaling
- **Semantic Search**: Kendra provides superior search relevance
- **Full Context Responses**: Bedrock uses complete document content, not just snippets
- **Infrastructure as Code**: CDK enables reproducible deployments
- **Security Best Practices**: Least privilege IAM permissions

### Performance Considerations
- Lambda functions optimized for document processing workloads
- Kendra index optimized for document corpus size
- Efficient API design with proper error handling
- Response caching considerations for common queries

## File Locations
All diagrams are stored in PNG format in this directory:
- `/home/pandson/echo-architect-artifacts/rag-implementation-120320251158/generated-diagrams/`

## Usage
These diagrams can be used for:
- Technical documentation
- Architecture reviews
- Implementation planning
- Stakeholder presentations
- Development team onboarding
