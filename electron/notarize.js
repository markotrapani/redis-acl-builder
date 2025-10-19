const { notarize } = require('@electron/notarize');
const fs = require('fs');
const path = require('path');
const os = require('os');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Only notarize if we have API key credentials
  if (!process.env.APPLE_API_KEY || !process.env.APPLE_API_ISSUER || !process.env.APPLE_API_KEY_ID) {
    console.log('Skipping notarization - API key credentials not found');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}...`);

  // Decode base64-encoded API key and write to temp file
  const apiKeyContent = Buffer.from(process.env.APPLE_API_KEY, 'base64').toString('utf8');
  console.log(`Decoded API key length: ${apiKeyContent.length} bytes`);
  console.log(`First 50 chars: ${apiKeyContent.substring(0, 50)}`);

  const tempKeyPath = path.join(os.tmpdir(), 'AuthKey.p8');
  fs.writeFileSync(tempKeyPath, apiKeyContent);
  console.log(`Wrote API key to: ${tempKeyPath}`);

  try {
    await notarize({
      appPath,
      appleApiKey: tempKeyPath,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      teamId: 'L56TPJWPSM',
    });
    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempKeyPath)) {
      fs.unlinkSync(tempKeyPath);
    }
  }
};
