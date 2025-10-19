const { notarize } = require('@electron/notarize');

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

  try {
    await notarize({
      appPath,
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      teamId: 'L56TPJWPSM',
    });
    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
