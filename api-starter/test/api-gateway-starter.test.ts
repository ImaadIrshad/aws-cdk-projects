import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ApiGatewayStarterStack } from '../lib/api-gateway-starter-stack';

function synth() {
  const app = new cdk.App();
  const stack = new ApiGatewayStarterStack(app, 'TestStack');
  return Template.fromStack(stack);
}

test('DynamoDB items table created', () => {
  const template = synth();

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'starter-items',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  });
});

test('shared Lambda layer created and attached to every function', () => {
  const template = synth();

  template.hasResourceProperties('AWS::Lambda::LayerVersion', {
    LayerName: 'starter-common',
    CompatibleRuntimes: ['nodejs22.x'],
  });

  const functionCount = Object.keys(template.findResources('AWS::Lambda::Function')).length;
  expect(functionCount).toBe(7);

  template.allResourcesProperties('AWS::Lambda::Function', {
    Layers: Match.anyValue(),
  });
});

test('list/get functions can read the table, create function can write to it', () => {
  const template = synth();

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([Match.stringLikeRegexp('dynamodb:Scan')]),
        }),
      ]),
    },
  });

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([Match.stringLikeRegexp('dynamodb:PutItem')]),
        }),
      ]),
    },
  });

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([Match.stringLikeRegexp('dynamodb:DeleteItem')]),
        }),
      ]),
    },
  });

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([Match.stringLikeRegexp('dynamodb:UpdateItem')]),
        }),
      ]),
    },
  });
});

test('API Gateway exposes /items (GET, POST) and /items/{id} (GET, DELETE, PATCH)', () => {
  const template = synth();

  template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'items' });
  template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: '{id}' });

  template.hasResourceProperties('AWS::ApiGateway::Method', { HttpMethod: 'GET' });
  template.hasResourceProperties('AWS::ApiGateway::Method', { HttpMethod: 'POST' });
  template.hasResourceProperties('AWS::ApiGateway::Method', { HttpMethod: 'DELETE' });
  template.hasResourceProperties('AWS::ApiGateway::Method', { HttpMethod: 'PATCH' });
});

test('JWT authorizer secures every /items method but not /auth/token', () => {
  const template = synth();

  template.hasResourceProperties('AWS::SecretsManager::Secret', {
    Description: 'HS256 signing secret for the starter API demo JWTs',
  });

  template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
    Type: 'TOKEN',
    IdentitySource: 'method.request.header.Authorization',
  });

  const itemsMethods = template.findResources('AWS::ApiGateway::Method', {
    Properties: { HttpMethod: Match.not('OPTIONS') },
  });
  const protectedMethods = Object.values(itemsMethods).filter(
    (m: any) => m.Properties.AuthorizationType === 'CUSTOM'
  );
  expect(protectedMethods.length).toBe(5); // GET/POST items + GET/DELETE/PATCH items/{id}

  template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'token' });
  const tokenMethod = Object.values(template.findResources('AWS::ApiGateway::Method', {
    Properties: { HttpMethod: 'POST' },
  })).find((m: any) => m.Properties.AuthorizationType !== 'CUSTOM');
  expect(tokenMethod).toBeDefined();
});
