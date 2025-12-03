"""
Document Processing Lambda Function for RAG Implementation
Handles document upload, processing, and embedding generation
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
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Environment variables (to be set in CDK)
DOCUMENTS_BUCKET = 'rag-documents-bucket'
METADATA_TABLE = 'rag-document-metadata'

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Main Lambda handler for document processing
    """
    try:
        # Parse the incoming event
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        
        if http_method == 'POST' and path == '/documents':
            return handle_document_upload(event)
        elif http_method == 'GET' and path == '/documents':
            return handle_list_documents(event)
        elif http_method == 'DELETE' and '/documents/' in path:
            return handle_delete_document(event)
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

def handle_document_upload(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle document upload and processing
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        # Extract document information
        document_name = body.get('name', '')
        document_content = body.get('content', '')
        document_type = body.get('type', 'text')
        
        if not document_name or not document_content:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Document name and content are required'})
            }
        
        # Generate unique document ID
        document_id = str(uuid.uuid4())
        
        # Upload document to S3
        s3_key = f"documents/{document_id}/{document_name}"
        s3_client.put_object(
            Bucket=DOCUMENTS_BUCKET,
            Key=s3_key,
            Body=document_content,
            ContentType='text/plain' if document_type == 'text' else 'application/octet-stream'
        )
        
        # Store metadata in DynamoDB
        table = dynamodb.Table(METADATA_TABLE)
        table.put_item(
            Item={
                'document_id': document_id,
                'name': document_name,
                'type': document_type,
                's3_key': s3_key,
                'upload_time': datetime.utcnow().isoformat(),
                'status': 'uploaded',
                'content_length': len(document_content)
            }
        )
        
        # TODO: Process document for embeddings
        # This would typically involve:
        # 1. Text extraction and chunking
        # 2. Embedding generation using a model
        # 3. Storing embeddings in a vector database
        
        return {
            'statusCode': 201,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'document_id': document_id,
                'message': 'Document uploaded successfully',
                's3_key': s3_key
            })
        }
        
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Failed to upload document'})
        }

def handle_list_documents(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    List all uploaded documents
    """
    try:
        table = dynamodb.Table(METADATA_TABLE)
        response = table.scan()
        
        documents = []
        for item in response.get('Items', []):
            documents.append({
                'document_id': item['document_id'],
                'name': item['name'],
                'type': item['type'],
                'upload_time': item['upload_time'],
                'status': item['status'],
                'content_length': item.get('content_length', 0)
            })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'documents': documents,
                'count': len(documents)
            })
        }
        
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Failed to list documents'})
        }

def handle_delete_document(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Delete a document
    """
    try:
        # Extract document ID from path
        path_parts = event['path'].split('/')
        document_id = path_parts[-1]
        
        # Get document metadata
        table = dynamodb.Table(METADATA_TABLE)
        response = table.get_item(Key={'document_id': document_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Document not found'})
            }
        
        document = response['Item']
        
        # Delete from S3
        s3_client.delete_object(
            Bucket=DOCUMENTS_BUCKET,
            Key=document['s3_key']
        )
        
        # Delete from DynamoDB
        table.delete_item(Key={'document_id': document_id})
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'message': 'Document deleted successfully'})
        }
        
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Failed to delete document'})
        }
