import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda_event_sources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---- DynamoDB ----
    const table = new dynamodb.Table(this, 'JobsTable', {
      tableName: 'jobs',
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ---- S3 ----
    const bucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `uploads-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // ---- SNS ----
    const topic = new sns.Topic(this, 'JobCompleteTopic', {
      topicName: 'job-complete',
    });

    // ---- SQS ----
    const queue = new sqs.Queue(this, 'JobsQueue', {
      queueName: 'jobs-queue',
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    // S3 triggers SQS when a file is uploaded
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(queue)
    );

    // ---- Lambda: process queue ----
    const processorFn = new nodejs.NodejsFunction(this, 'ProcessorFunction', {
      entry: 'lambda/processor/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      functionName: 'job-processor',
      environment: {
        TABLE_NAME: table.tableName,
        TOPIC_ARN: topic.topicArn,
      },
    });

    // Grant permissions
    table.grantWriteData(processorFn);
    topic.grantPublish(processorFn);
    processorFn.addEventSource(new lambda_event_sources.SqsEventSource(queue));

    // ---- Lambda: hello ----
    const helloFn = new nodejs.NodejsFunction(this, 'HelloFunction', {
      entry: 'lambda/hello/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      functionName: 'hello-function',
    });

    // ---- Lambda: job status ----
    const statusFn = new nodejs.NodejsFunction(this, 'StatusFunction', {
      entry: 'lambda/status/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      functionName: 'job-status',
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantReadData(statusFn);

    // ---- API Gateway ----
    const api = new apigateway.RestApi(this, 'BackendApi', {
      restApiName: 'backend-api',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    api.root.addResource('hello').addMethod('GET', new apigateway.LambdaIntegration(helloFn));

    const jobs = api.root.addResource('jobs');
    jobs.addResource('{jobId}').addMethod('GET', new apigateway.LambdaIntegration(statusFn));

    // ---- Outputs ----
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'QueueUrl', { value: queue.queueUrl });
    new cdk.CfnOutput(this, 'TopicArn', { value: topic.topicArn });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}