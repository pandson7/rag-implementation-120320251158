import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kendra from 'aws-cdk-lib/aws-kendra';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class RagImplementationStack120320251158 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const suffix = '120320251158';

    // S3 bucket for document storage
    const documentBucket = new s3.Bucket(this, `DocumentBucket${suffix}`, {
      bucketName: `rag-documents-${suffix}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }]
    });

    // Kendra index
    const kendraIndex = new kendra.CfnIndex(this, `KendraIndex${suffix}`, {
      name: `rag-index-${suffix}`,
      roleArn: new iam.Role(this, `KendraRole${suffix}`, {
        assumedBy: new iam.ServicePrincipal('kendra.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess')
        ]
      }).roleArn,
      edition: 'DEVELOPER_EDITION'
    });

    // Kendra data source
    const kendraDataSource = new kendra.CfnDataSource(this, `KendraDataSource${suffix}`, {
      indexId: kendraIndex.attrId,
      name: `rag-datasource-${suffix}`,
      type: 'S3',
      roleArn: new iam.Role(this, `KendraDataSourceRole${suffix}`, {
        assumedBy: new iam.ServicePrincipal('kendra.amazonaws.com'),
        inlinePolicies: {
          S3Access: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['s3:GetObject', 's3:ListBucket'],
                resources: [documentBucket.bucketArn, `${documentBucket.bucketArn}/*`]
              })
            ]
          })
        }
      }).roleArn,
      dataSourceConfiguration: {
        s3Configuration: {
          bucketName: documentBucket.bucketName
        }
      }
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, `LambdaRole${suffix}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
      inlinePolicies: {
        KendraAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['kendra:Retrieve', 'kendra:Query'],
              resources: [kendraIndex.attrArn]
            })
          ]
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel'],
              resources: [
                `arn:aws:bedrock:us-east-1:${this.account}:inference-profile/global.anthropic.claude-sonnet-4-20250514-v1:0`,
                `arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0`
              ]
            })
          ]
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
              resources: [documentBucket.bucketArn, `${documentBucket.bucketArn}/*`]
            })
          ]
        })
      }
    });

    // Query Lambda function
    const queryFunction = new lambda.Function(this, `QueryFunction${suffix}`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      role: lambdaRole,
      code: lambda.Code.fromInline(`
const { KendraClient, RetrieveCommand } = require('@aws-sdk/client-kendra');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const kendra = new KendraClient({ region: 'us-east-1' });
const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { question } = JSON.parse(event.body);
    
    // Use Kendra Retrieve API for comprehensive content
    const retrieveParams = {
      IndexId: '${kendraIndex.attrId}',
      QueryText: question,
      PageSize: 10
    };
    
    const retrieveResult = await kendra.send(new RetrieveCommand(retrieveParams));
    
    if (!retrieveResult.ResultItems || retrieveResult.ResultItems.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          answer: "I couldn't find relevant information in the documents to answer your question.",
          sources: [],
          confidence: 0
        })
      };
    }
    
    // Combine all retrieved content for comprehensive context
    const context = retrieveResult.ResultItems
      .map(item => item.Content)
      .join('\\n\\n');
    
    const sources = retrieveResult.ResultItems
      .map(item => item.DocumentTitle || item.DocumentId)
      .filter(Boolean);
    
    // Generate response using Claude 4
    const prompt = \`Based on the following document content, provide a comprehensive and detailed answer to the question. Use the full context provided, not just snippets.

Document Content:
\${context}

Question: \${question}

Please provide a detailed, accurate answer based on the document content above. If the documents don't contain enough information to fully answer the question, please indicate what information is available and what might be missing.\`;

    const bedrockParams = {
      modelId: 'arn:aws:bedrock:us-east-1:${this.account}:inference-profile/global.anthropic.claude-sonnet-4-20250514-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    };
    
    const bedrockResult = await bedrock.send(new InvokeModelCommand(bedrockParams));
    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResult.body));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        answer: responseBody.content[0].text,
        sources: sources,
        confidence: retrieveResult.ResultItems[0]?.ScoreAttributes?.ScoreConfidence || 'MEDIUM'
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
      `),
      environment: {
        KENDRA_INDEX_ID: kendraIndex.attrId
      },
      timeout: cdk.Duration.minutes(5)
    });

    // Sample questions Lambda function
    const sampleQuestionsFunction = new lambda.Function(this, `SampleQuestionsFunction${suffix}`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const sampleQuestions = [
    {
      id: '1',
      text: 'What are the main architectural patterns for SaaS applications?',
      category: 'Broad Concepts'
    },
    {
      id: '2', 
      text: 'What are the key principles of multi-tenant architecture?',
      category: 'Broad Concepts'
    },
    {
      id: '3',
      text: 'How should data isolation be implemented in SaaS applications?',
      category: 'Technical Patterns'
    },
    {
      id: '4',
      text: 'What are the specific security requirements for SaaS platforms?',
      category: 'Specific Details'
    },
    {
      id: '5',
      text: 'What are the recommended scaling strategies for SaaS applications?',
      category: 'Technical Patterns'
    },
    {
      id: '6',
      text: 'How should tenant onboarding be designed?',
      category: 'Specific Details'
    }
  ];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ questions: sampleQuestions })
  };
};
      `)
    });

    // Ingest Lambda function
    const ingestFunction = new lambda.Function(this, `IngestFunction${suffix}`, {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      role: lambdaRole,
      code: lambda.Code.fromInline(`
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { KendraClient, StartDataSourceSyncJobCommand } = require('@aws-sdk/client-kendra');

const s3 = new S3Client({ region: 'us-east-1' });
const kendra = new KendraClient({ region: 'us-east-1' });

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // List existing objects in bucket
    const listParams = {
      Bucket: '${documentBucket.bucketName}'
    };
    
    const listResult = await s3.send(new ListObjectsV2Command(listParams));
    const existingCount = listResult.Contents ? listResult.Contents.length : 0;
    
    // Trigger Kendra data source sync
    const syncParams = {
      Id: '${kendraDataSource.attrId}',
      IndexId: '${kendraIndex.attrId}'
    };
    
    await kendra.send(new StartDataSourceSyncJobCommand(syncParams));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Document ingestion triggered successfully',
        documentCount: existingCount,
        status: 'sync_started'
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to trigger ingestion' })
    };
  }
};
      `),
      timeout: cdk.Duration.minutes(2)
    });

    // API Gateway
    const api = new apigateway.RestApi(this, `RagApi${suffix}`, {
      restApiName: `rag-api-${suffix}`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      }
    });

    const apiResource = api.root.addResource('api');
    
    // Query endpoint
    const queryResource = apiResource.addResource('query');
    queryResource.addMethod('POST', new apigateway.LambdaIntegration(queryFunction));

    // Sample questions endpoint
    const sampleQuestionsResource = apiResource.addResource('sample-questions');
    sampleQuestionsResource.addMethod('GET', new apigateway.LambdaIntegration(sampleQuestionsFunction));

    // Ingest endpoint
    const ingestResource = apiResource.addResource('ingest');
    ingestResource.addMethod('POST', new apigateway.LambdaIntegration(ingestFunction));

    // Add dependency to ensure data source is created after index
    kendraDataSource.addDependency(kendraIndex);

    // Output API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });

    new cdk.CfnOutput(this, 'DocumentBucketName', {
      value: documentBucket.bucketName,
      description: 'S3 Document Bucket Name'
    });
  }
}
