const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { BUCKET_NAME } = require('../../utils/constants');

AWS.config.update({ region: 'us-east-1' });

const s3 = new AWS.S3();
const testImagePath = path.join(__dirname, '../../assets/test.jpg');

const uploadImageToS3 = async (filePath, key) => {
  const fileContent = fs.readFileSync(filePath);

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: 'image/jpeg',
  };

  return s3.upload(params).promise();
};

const downloadImageFromS3 = async (key, downloadPath) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  const data = await s3.getObject(params).promise();
  fs.writeFileSync(downloadPath, data.Body);
};

const listImagesInS3 = async () => {
  const params = {
    Bucket: BUCKET_NAME,
  };

  const data = await s3.listObjectsV2(params).promise();
  return data.Contents.map(file => file.Key);
};

const deleteImageFromS3 = async (key) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  return s3.deleteObject(params).promise();
};

describe('Application API Functionality Tests', () => {

  test('CXQA-S3-03: Upload images to the S3 bucket', async () => {
    const key = 'uploaded-image.jpg';
    const result = await uploadImageToS3(testImagePath, key);

    expect(result).toBeDefined();
    expect(result.Location).toMatch(/^https:\/\/.*\.amazonaws\.com/);
  });

  test('CXQA-S3-04: Download images from the S3 bucket', async () => {
    const key = 'uploaded-image.jpg';
    const downloadPath = path.join(__dirname, 'downloaded-image.jpg');

    await downloadImageFromS3(key, downloadPath);

    const downloadedFile = fs.readFileSync(downloadPath);
    expect(downloadedFile.length).toBeGreaterThan(0);
  });

  test('CXQA-S3-05: View a list of uploaded images', async () => {
    const files = await listImagesInS3();

    expect(files.length).toBeGreaterThan(0);
    console.log('Uploaded images in the S3 bucket:', files);
  });

  test('CXQA-S3-06: Delete an image from the S3 bucket', async () => {
    const key = 'uploaded-image.jpg';
    await deleteImageFromS3(key);

    const files = await listImagesInS3();
    expect(files).not.toContain(key);
  });

});
