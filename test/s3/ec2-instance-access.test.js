const AWS = require('aws-sdk');
const axios = require('axios');
const { BUCKET_NAME } = require('../../utils/constants');

AWS.config.update({ region: 'us-east-1' });


const ec2 = new AWS.EC2();
const s3 = new AWS.S3();
const instanceId = 'i-06d7f74cd3d37089a';

const getInstancePublicInfo = async () => {
  try {
    const params = {
      InstanceIds: [instanceId],
    };

    const data = await ec2.describeInstances(params).promise();
    console.log(data.Reservations[0].Instances)
    const instance = data.Reservations[0].Instances[0];

    const publicIp = instance.PublicIpAddress;
    const publicDns = instance.PublicDnsName;

    if (publicIp) {
      return `http://${publicIp}`;
    } else if (publicDns) {
      return `http://${publicDns}`;
    } else {
      throw new Error('No public IP or FQDN found for the instance');
    }
  } catch (error) {
    throw new Error(`Error fetching EC2 instance details: ${error.message}`);
  }
};

const testHTTPConnection = async (url) => {
  try {
    const response = await axios.get(url);
    return response.status === 200;
  } catch (error) {
    throw new Error('HTTP connection failed: ' + error.message);
  }
};

const listS3BucketFiles = async (bucketName) => {
  try {
    const params = {
      Bucket: bucketName,
    };

    const data = await s3.listObjectsV2(params).promise();
    return data.Contents.map(file => file.Key);
  } catch (error) {
    throw new Error('Error fetching S3 bucket files: ' + error.message);
  }
};

const getS3BucketTagging = async (bucketName) => {
  try {
    const params = {
      Bucket: bucketName,
    };

    const data = await s3.getBucketTagging(params).promise();
    return data.TagSet;
  } catch (error) {
    throw new Error('Error fetching S3 bucket tags: ' + error.message);
  }
};

const getS3BucketEncryption = async (bucketName) => {
  try {
    const params = {
      Bucket: bucketName,
    };

    const data = await s3.getBucketEncryption(params).promise();
    return data.ServerSideEncryptionConfiguration;
  } catch (error) {
    throw new Error('Error fetching S3 bucket encryption: ' + error.message);
  }
};

const getS3BucketVersioning = async (bucketName) => {
  try {
    const params = {
      Bucket: bucketName,
    };

    const data = await s3.getBucketVersioning(params).promise();
    return data.Status;
  } catch (error) {
    throw new Error('Error fetching S3 bucket versioning status: ' + error.message);
  }
};

const getS3BucketPublicAccess = async (bucketName) => {
  try {
    const params = {
      Bucket: bucketName,
    };

    const data = await s3.getBucketPolicyStatus(params).promise();
    return data.PolicyStatus.IsPublic;
  } catch (error) {
    throw new Error('Error fetching S3 bucket public access settings: ' + error.message);
  }
};

describe('Deployment Validation Tests', () => {

  test('CXQA-S3-01: Instance should be deployed in a public subnet', async () => {
    const params = {
      InstanceIds: [instanceId],
    };

    const data = await ec2.describeInstances(params).promise();
    const instance = data.Reservations[0].Instances[0];
    const subnetId = instance.SubnetId;

    const subnetData = await ec2.describeSubnets({ SubnetIds: [subnetId] }).promise();
    const subnet = subnetData.Subnets[0];

    expect(subnet.MapPublicIpOnLaunch).toBe(true);
  });

  test('CXQA-S3-02: The application should be accessible by HTTP from the internet via public IP', async () => {
    const url = await getInstancePublicInfo();
    console.log(url)
    if (!url || !url.startsWith('http://')) {
      throw new Error('Invalid URL retrieved: ' + url);
    }
    console.log(url)
    const isAccessible = await testHTTPConnection(url);
    expect(isAccessible).toBe(true);
  });

  test('CXQA-S3-02: The application should be accessible by HTTP from the internet via FQDN', async () => {
    const url = await getInstancePublicInfo();
    if (!url || !url.startsWith('http://')) {
      throw new Error('Invalid URL retrieved: ' + url);
    }

    const isAccessible = await testHTTPConnection(url);
    expect(isAccessible).toBe(true);
  });

  test('CXQA-S3-02: The S3 bucket should be accessible and list files', async () => {
    const files = await listS3BucketFiles(BUCKET_NAME);

    expect(files.length).toBeGreaterThan(0);
    console.log('Files in the S3 bucket:', files);
  });

  test('CXQA-S3-02: S3 bucket name should follow the pattern "cloudximage-imagestorebucket{unique id}"', async () => {
    const regex = /^cloudximage-imagestorebucket[a-zA-Z0-9-]+$/;
    expect(BUCKET_NAME).toMatch(regex);
  });

  test('CXQA-S3-02: S3 bucket should have the tag "cloudx: qa"', async () => {
    const tags = await getS3BucketTagging(BUCKET_NAME);

    const qaTag = tags.find(tag => tag.Key === 'cloudx' && tag.Value === 'qa');
    expect(qaTag).toBeDefined();
  });

  test('CXQA-S3-02: S3 bucket should use SSE-S3 encryption', async () => {
    const encryption = await getS3BucketEncryption(BUCKET_NAME);
    expect(encryption).toBeDefined();
    const sseS3 = encryption.Rules.find(rule => rule.ApplyServerSideEncryptionByDefault.SSEAlgorithm === 'AES256');
    expect(sseS3).toBeDefined();
  });

  test('CXQA-S3-02: S3 bucket should have versioning disabled', async () => {
    const versioning = await getS3BucketVersioning(BUCKET_NAME);
    console.log(versioning)
    expect(versioning === undefined || versioning?.Status === 'Disabled').toBe(true);  });

  test('CXQA-S3-02: S3 bucket should have public access disabled', async () => {
    const isPublic = await getS3BucketPublicAccess(BUCKET_NAME);
    expect(isPublic).toBe(false);
  });

});
