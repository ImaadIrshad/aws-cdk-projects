import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class ApiGatewayStarterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---- DynamoDB ----
    const table = new dynamodb.Table(this, 'ItemsTable', {
      tableName: 'starter-items',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ---- Shared Lambda Layer ----
    // Plain JS on purpose: NodejsFunction bundles handler code with esbuild,
    // but layer assets aren't run through that pipeline, so a compile step
    // would need custom bundling. Handlers import it as `common` and mark it
    // external in their esbuild config so the runtime resolves it from /opt.
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      layerVersionName: 'starter-common',
      code: lambda.Code.fromAsset('layers/common'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'Shared response formatting and validation helpers',
    });

    // ---- JWT signing secret ----
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      description: 'HS256 signing secret for the starter API demo JWTs',
      generateSecretString: { excludePunctuation: true, passwordLength: 48 },
    });

    const sharedFnProps: Partial<nodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      layers: [commonLayer],
      bundling: { externalModules: ['@aws-sdk/*', 'common'] },
      environment: { TABLE_NAME: table.tableName },
    };

    const jwtFnProps: Partial<nodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      layers: [commonLayer],
      bundling: { externalModules: ['@aws-sdk/*', 'common'] },
      environment: { JWT_SECRET: jwtSecret.secretValue.unsafeUnwrap() },
    };

    // ---- Lambda: list items ----
    const listItemsFn = new nodejs.NodejsFunction(this, 'ListItemsFunction', {
      ...sharedFnProps,
      entry: 'lambda/list-items/index.ts',
      handler: 'handler',
      functionName: 'starter-list-items',
    });
    table.grantReadData(listItemsFn);

    // ---- Lambda: get item ----
    const getItemFn = new nodejs.NodejsFunction(this, 'GetItemFunction', {
      ...sharedFnProps,
      entry: 'lambda/get-item/index.ts',
      handler: 'handler',
      functionName: 'starter-get-item',
    });
    table.grantReadData(getItemFn);

    // ---- Lambda: create item ----
    const createItemFn = new nodejs.NodejsFunction(this, 'CreateItemFunction', {
      ...sharedFnProps,
      entry: 'lambda/create-item/index.ts',
      handler: 'handler',
      functionName: 'starter-create-item',
    });
    table.grantWriteData(createItemFn);

    // ---- Lambda: delete item ----
    const deleteItemFn = new nodejs.NodejsFunction(this, 'DeleteItemFunction', {
      ...sharedFnProps,
      entry: 'lambda/delete-item/index.ts',
      handler: 'handler',
      functionName: 'starter-delete-item',
    });
    table.grantWriteData(deleteItemFn);

    // ---- Lambda: update item ----
    const updateItemFn = new nodejs.NodejsFunction(this, 'UpdateItemFunction', {
      ...sharedFnProps,
      entry: 'lambda/update-item/index.ts',
      handler: 'handler',
      functionName: 'starter-update-item',
    });
    table.grantWriteData(updateItemFn);

    // ---- Lambda: JWT authorizer ----
    const authorizerFn = new nodejs.NodejsFunction(this, 'AuthorizerFunction', {
      ...jwtFnProps,
      entry: 'lambda/authorizer/index.ts',
      handler: 'handler',
      functionName: 'starter-authorizer',
    });

    // ---- Lambda: issue demo token ----
    const issueTokenFn = new nodejs.NodejsFunction(this, 'IssueTokenFunction', {
      ...jwtFnProps,
      entry: 'lambda/issue-token/index.ts',
      handler: 'handler',
      functionName: 'starter-issue-token',
    });

    // ---- API Gateway ----
    const api = new apigateway.RestApi(this, 'StarterApi', {
      restApiName: 'starter-api',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const authorizer = new apigateway.TokenAuthorizer(this, 'JwtAuthorizer', {
      handler: authorizerFn,
      identitySource: 'method.request.header.Authorization',
    });

    // Public: exchange a username for a demo JWT (no real credential check).
    api.root.addResource('auth').addResource('token')
      .addMethod('POST', new apigateway.LambdaIntegration(issueTokenFn));

    // Protected: every /items route requires a valid JWT.
    const items = api.root.addResource('items');
    items.addMethod('GET', new apigateway.LambdaIntegration(listItemsFn), { authorizer });
    items.addMethod('POST', new apigateway.LambdaIntegration(createItemFn), { authorizer });
    const item = items.addResource('{id}');
    item.addMethod('GET', new apigateway.LambdaIntegration(getItemFn), { authorizer });
    item.addMethod('DELETE', new apigateway.LambdaIntegration(deleteItemFn), { authorizer });
    item.addMethod('PATCH', new apigateway.LambdaIntegration(updateItemFn), { authorizer });

    // ---- Outputs ----
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
