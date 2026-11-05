#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ApiGatewayStarterStack } from '../lib/api-gateway-starter-stack';

const app = new cdk.App();
new ApiGatewayStarterStack(app, 'ApiGatewayStarterStack');
