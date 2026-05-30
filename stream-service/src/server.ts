import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Readable } from 'stream';
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
    const streamDetails = await StreamExtractor.getAudioStreamDownload(videoId);
    
    // Set caching headers so the client/CDN caches for a few hours
    res.setHeader('Cache-Control', 'public, max-age=14400'); // 4 hours
    res.setHeader('Content-Type', streamDetails.mimeType || 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'none'); // Native stream download pipelines as a continuous stream
    
    // Convert Web ReadableStream to Node Readable and pipe to Express response
    const nodeStream = Readable.fromWeb(streamDetails.stream as any);
    
    nodeStream.pipe(res);
    
    nodeStream.on('error', (err) => {
      console.error('[Proxy Stream Error]:', err);
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
