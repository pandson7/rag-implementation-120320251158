"""
Query Processing Lambda Function for RAG Implementation
Handles user queries, retrieval, and response generation
"""

import json
import boto3
import logging
from typing import Dict, Any, List
import uuid
from datetime import datetime

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

# Environment variables (to be set in CDK)
METADATA_TABLE = 'rag-document-metadata'
QUERY_HISTORY_TABLE = 'rag-query-history'
DOCUMENTS_BUCKET = 'rag-documents-bucket'

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Main Lambda handler for query processing
    """
    try:
        # Parse the incoming event
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        
        if http_method == 'POST' and path == '/query':
            return handle_query(event)
        elif http_method == 'GET' and path == '/query/history':
            return handle_query_history(event)
        else:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Endpoint not found'})
            }
            
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Internal server error'})
        }

def handle_query(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle user query and generate response
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        # Extract query information
        query_text = body.get('query', '')
        max_results = body.get('max_results', 5)
        
        if not query_text:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Query text is required'})
            }
        
        # Generate unique query ID
        query_id = str(uuid.uuid4())
        
        # TODO: Implement actual RAG pipeline
        # This would typically involve:
        # 1. Query embedding generation
        # 2. Similarity search in vector database
        # 3. Document retrieval
        # 4. Context preparation
        # 5. LLM response generation
        
        # For now, simulate the process
        relevant_documents = simulate_document_retrieval(query_text, max_results)
        response_text = simulate_response_generation(query_text, relevant_documents)
        
        # Store query in history
        store_query_history(query_id, query_text, response_text, relevant_documents)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'query_id': query_id,
                'query': query_text,
                'response': response_text,
                'relevant_documents': relevant_documents,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Failed to process query'})
        }

def simulate_document_retrieval(query: str, max_results: int) -> List[Dict[str, Any]]:
    """
    Simulate document retrieval based on query
    In a real implementation, this would use vector similarity search
    """
    try:
        # Get all documents from metadata table
        table = dynamodb.Table(METADATA_TABLE)
        response = table.scan()
        
        documents = []
        for item in response.get('Items', []):
            # Simple keyword matching simulation
            relevance_score = calculate_simple_relevance(query, item.get('name', ''))
            
            if relevance_score > 0:
                documents.append({
                    'document_id': item['document_id'],
                    'name': item['name'],
                    'relevance_score': relevance_score,
                    'excerpt': f"Relevant content from {item['name']} related to: {query}"
                })
        
        # Sort by relevance and return top results
        documents.sort(key=lambda x: x['relevance_score'], reverse=True)
        return documents[:max_results]
        
    except Exception as e:
        logger.error(f"Error retrieving documents: {str(e)}")
        return []

def calculate_simple_relevance(query: str, document_name: str) -> float:
    """
    Simple relevance calculation based on keyword matching
    """
    query_words = set(query.lower().split())
    doc_words = set(document_name.lower().split())
    
    # Calculate Jaccard similarity
    intersection = len(query_words.intersection(doc_words))
    union = len(query_words.union(doc_words))
    
    return intersection / union if union > 0 else 0.0

def simulate_response_generation(query: str, documents: List[Dict[str, Any]]) -> str:
    """
    Simulate response generation based on query and retrieved documents
    In a real implementation, this would use an LLM
    """
    if not documents:
        return f"I couldn't find any relevant documents to answer your query: '{query}'. Please try rephrasing your question or upload relevant documents first."
    
    doc_names = [doc['name'] for doc in documents[:3]]
    
    response = f"Based on your query '{query}', I found relevant information in the following documents: {', '.join(doc_names)}. "
    response += f"The most relevant document appears to be '{documents[0]['name']}' with a relevance score of {documents[0]['relevance_score']:.2f}. "
    response += "Here's a summary of the relevant information: "
    response += " ".join([doc['excerpt'] for doc in documents[:2]])
    
    return response

def store_query_history(query_id: str, query: str, response: str, documents: List[Dict[str, Any]]) -> None:
    """
    Store query and response in history table
    """
    try:
        table = dynamodb.Table(QUERY_HISTORY_TABLE)
        table.put_item(
            Item={
                'query_id': query_id,
                'query_text': query,
                'response_text': response,
                'relevant_documents': documents,
                'timestamp': datetime.utcnow().isoformat(),
                'document_count': len(documents)
            }
        )
    except Exception as e:
        logger.error(f"Error storing query history: {str(e)}")

def handle_query_history(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Retrieve query history
    """
    try:
        # Get query parameters
        query_params = event.get('queryStringParameters') or {}
        limit = int(query_params.get('limit', 10))
        
        table = dynamodb.Table(QUERY_HISTORY_TABLE)
        response = table.scan(Limit=limit)
        
        queries = []
        for item in response.get('Items', []):
            queries.append({
                'query_id': item['query_id'],
                'query_text': item['query_text'],
                'response_text': item['response_text'],
                'timestamp': item['timestamp'],
                'document_count': item.get('document_count', 0)
            })
        
        # Sort by timestamp (most recent first)
        queries.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'queries': queries,
                'count': len(queries)
            })
        }
        
    except Exception as e:
        logger.error(f"Error retrieving query history: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Failed to retrieve query history'})
        }
