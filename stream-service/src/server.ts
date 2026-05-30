import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import { StreamExtractor } from './extractor.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Resolves details of the audio stream (URL, mimeType, bitrate, duration)
 */
app.get('/resolve', async (req: Request, res: Response) => {
  const videoId = req.query.videoId as string;

  if (!videoId) {
    res.status(400).json({ error: 'Missing videoId query parameter' });
    return;
  }

  try {
    const streamDetails = await StreamExtractor.getAudioStream(videoId);
    res.json(streamDetails);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to extract audio stream',
      details: error.message || 'Unknown error'
    });
  }
});

/**
 * Directly redirects or proxies the audio playback request
 */
app.get('/play', async (req: Request, res: Response) => {
  const videoId = req.query.videoId as string;

  if (!videoId) {
    res.status(400).send('Missing videoId query parameter');
    return;
  }

  try {
    const streamDetails = await StreamExtractor.getAudioStream(videoId);
    
    // Set caching headers so the client/CDN caches for a few hours
    res.setHeader('Cache-Control', 'public, max-age=14400'); // 4 hours
    res.setHeader('Content-Type', streamDetails.mimeType || 'audio/mpeg');
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Android 10; Mobile; rv:102.0) Gecko/102.0 Firefox/102.0'
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range as string;
    }

    https.get(streamDetails.url, { headers }, (streamRes) => {
      if (streamRes.headers['content-length']) {
        res.setHeader('Content-Length', streamRes.headers['content-length']);
      }
      if (streamRes.headers['content-range']) {
        res.setHeader('Content-Range', streamRes.headers['content-range']);
      }
      if (streamRes.headers['accept-ranges']) {
        res.setHeader('Accept-Ranges', streamRes.headers['accept-ranges']);
      }
      
      res.status(streamRes.statusCode || 200);
      streamRes.pipe(res);
    }).on('error', (err) => {
      console.error('[Proxy Error]:', err);
      if (!res.headersSent) {
        res.status(500).send('Streaming error');
      }
    });
  } catch (error: any) {
    res.status(500).send(`Failed to play track: ${error.message || 'Extractor error'}`);
  }
});

app.listen(PORT as number, '0.0.0.0', () => {
  console.log(`[Stream Service] Server running on http://0.0.0.0:${PORT}`);
});
