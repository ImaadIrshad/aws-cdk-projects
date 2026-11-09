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

test('jobs queue dead-letters to jobs-dlq after 3 receives', () => {
  const template = synth();

  template.hasResourceProperties('AWS::SQS::Queue', {
    QueueName: 'jobs-dlq',
    MessageRetentionPeriod: 14 * 24 * 60 * 60,
  });

  template.hasResourceProperties('AWS::SQS::Queue', {
    QueueName: 'jobs-queue',
    RedrivePolicy: Match.objectLike({ maxReceiveCount: 3 }),
  });
});

test('processor reports partial batch failures to SQS', () => {
  const template = synth();

  template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
    FunctionResponseTypes: ['ReportBatchItemFailures'],
  });
});

test('alarms cover logged errors, the DLQ, processor crashes and API 5xx', () => {
  const template = synth();

  template.resourceCountIs('AWS::CloudWatch::Alarm', 4);

  template.hasResourceProperties('AWS::Logs::MetricFilter', {
    FilterPattern: '{ $.level = "ERROR" }',
    MetricTransformations: [
      Match.objectLike({ MetricNamespace: 'JobsPipeline', MetricName: 'ProcessingErrors' }),
    ],
  });

  template.hasResourceProperties('AWS::CloudWatch::Alarm', {
    Namespace: 'AWS/SQS',
    MetricName: 'ApproximateNumberOfMessagesVisible',
  });

  template.hasResourceProperties('AWS::CloudWatch::Alarm', {
    Namespace: 'AWS/ApiGateway',
    MetricName: '5XXError',
  });
});

test('every alarm notifies the alerts topic, with no email subscription by default', () => {
  const template = synth();

  template.hasResourceProperties('AWS::SNS::Topic', { TopicName: 'pipeline-alerts' });

  const alarms = Object.values(template.findResources('AWS::CloudWatch::Alarm'));
  alarms.forEach((alarm: any) => {
    expect(alarm.Properties.AlarmActions).toHaveLength(1);
  });

  template.resourceCountIs('AWS::SNS::Subscription', 0);
});

test('alertEmail context adds an email subscription to the alerts topic', () => {
  const app = new cdk.App({ context: { alertEmail: 'alerts@example.com' } });
  const template = Template.fromStack(new CdkStack(app, 'EmailStack'));

  template.hasResourceProperties('AWS::SNS::Subscription', {
    Protocol: 'email',
    Endpoint: 'alerts@example.com',
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
