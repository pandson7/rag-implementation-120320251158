#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RagImplementationStack120320251158 } from '../lib/cdk-app-stack';

const app = new cdk.App();
new RagImplementationStack120320251158(app, 'RagImplementationStack120320251158', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
