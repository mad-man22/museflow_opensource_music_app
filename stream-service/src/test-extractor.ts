import { Innertube, Platform } from 'youtubei.js';
import https from 'https';

// Provide our own JavaScript interpreter
Platform.shim.eval = async (data) => {
  return new Function(data.output)();
};

const CLIENTS = [
  'WEB',
  'WEB_REMIX',
  'ANDROID',
  'ANDROID_MUSIC',
  'YTKIDS',
  'TV',
  'MWEB',
  'IOS',
  'TV_EMBEDDED',
  'ANDROID_VR'
];

async function testClient(clientName: string) {
  console.log(`\n=================== TESTING CLIENT: ${clientName} ===================`);
  try {
    const yt = await Innertube.create({ client_type: clientName as any });
    console.log('Fetching basic info...');
    const info = await yt.getBasicInfo('tOaizzQG8Cw');
    
    if (!info.streaming_data) {
      console.log('No streaming data found.');
      return;
    }

    const audioFormats = info.streaming_data.adaptive_formats.filter(f => 
      f.mime_type.startsWith('audio/')
    );

    console.log('Found audio formats:', audioFormats.length);
    if (audioFormats.length === 0) return;

    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const format = audioFormats[0];

    let streamUrl = '';
    if (format.url) {
      streamUrl = format.url;
      console.log('Using format.url directly.');
    } else {
      console.log('Deciphering signature...');
      streamUrl = await (format as any).decipher(yt.session.player);
    }

    console.log('Stream URL:', streamUrl.substring(0, 80) + '...');

    // Try multiple header combinations
    const testRequest = (headers: any, label: string) => {
      return new Promise<void>((resolve) => {
        const req = https.get(streamUrl, { headers }, (res) => {
          console.log(`  [${label}] Status Code:`, res.statusCode);
          res.destroy();
          resolve();
        });
        req.on('error', (err) => {
          console.error(`  [${label}] Failed:`, err.message);
          resolve();
        });
      });
    };

    // Header set A: User Agent from session context
    const ua = (yt.session.context as any).client?.userAgent || 'Mozilla/5.0';
    await testRequest({ 'User-Agent': ua }, 'Session User-Agent');

    // Header set B: Merge session headers
    const mergedHeaders: any = {
      'User-Agent': ua,
      ...(yt.session as any).headers
    };
    await testRequest(mergedHeaders, 'Merged Session Headers');

    // Header set C: Empty headers
    await testRequest({}, 'Empty Headers');

  } catch (err: any) {
    console.error(`Failed with client ${clientName}:`, err.message || err);
  }
}

async function main() {
  for (const client of CLIENTS) {
    await testClient(client);
  }
}

main().catch(console.error);
