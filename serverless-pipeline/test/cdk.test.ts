import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CdkStack } from '../lib/cdk-stack';

function synth() {
  const app = new cdk.App();
  const stack = new CdkStack(app, 'TestStack');
  return Template.fromStack(stack);
}

test('SQS queue created with expected visibility timeout', () => {
  const template = synth();

  template.hasResourceProperties('AWS::SQS::Queue', {
    QueueName: 'jobs-queue',
    VisibilityTimeout: 30,
  });
});

test('DynamoDB jobs table created', () => {
  const template = synth();

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'jobs',
    KeySchema: [{ AttributeName: 'jobId', KeyType: 'HASH' }],
  });
});

test('API Gateway exposes /hello and /jobs/{jobId} resources', () => {
  const template = synth();

  template.hasResourceProperties('AWS::ApiGateway::Resource', {
    PathPart: 'hello',
  });

  template.hasResourceProperties('AWS::ApiGateway::Resource', {
    PathPart: 'jobs',
  });

  template.hasResourceProperties('AWS::ApiGateway::Resource', {
    PathPart: '{jobId}',
  });
});

test('uploads bucket notifies the jobs queue on object creation', () => {
  const template = synth();

  template.hasResourceProperties('Custom::S3BucketNotifications', {
    NotificationConfiguration: {
      QueueConfigurations: Match.arrayWith([
        Match.objectLike({
          Events: ['s3:ObjectCreated:*'],
        }),
      ]),
    },
  });
});

test('status Lambda has read access to the jobs table', () => {
  const template = synth();

  template.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: 'job-status',
  });

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([Match.stringLikeRegexp('dynamodb:GetItem')]),
        }),
      ]),
    },
  });
});
