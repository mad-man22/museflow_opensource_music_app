import { Innertube, Platform } from 'youtubei.js';
import { ProxyAgent } from 'undici';

// Provide standard JavaScript interpreter for deciphering signatures if needed
Platform.shim.eval = async (data: any) => {
  return new Function(data.output)();
};

export class StreamExtractor {
  private static instances: Map<string, Innertube> = new Map();
  
  // Sequence of client types to try, ordered by reliability and suitability
  private static CLIENT_TYPES = ['ANDROID_VR', 'TVHTML5_SIMPLY', 'iOS', 'WEB_REMIX', 'MWEB'];

  private static async getInnertube(clientType: string): Promise<Innertube> {
    let instance = this.instances.get(clientType);
    if (!instance) {
      console.log(`[Extractor] Initializing youtubei.js Innertube client with ${clientType} client_type...`);
      
      const config: any = {
        client_type: clientType as any
      };

      // Support PO Token and Visitor Data from environment variables to bypass bot blocks
      let poToken = process.env.PO_TOKEN;
      let visitorData = process.env.VISITOR_DATA;
      
      if (poToken) {
        // Automatically URL-decode just in case it was copied URL-encoded (e.g. %3D%3D -> ==)
        try {
          poToken = decodeURIComponent(poToken);
        } catch (e) {
          console.warn('[Extractor] Failed to decodeURIComponent PO_TOKEN, using as-is.');
        }
        console.log(`[Extractor] Applying PO_TOKEN configuration for ${clientType}...`);
        config.po_token = poToken;
      }
      if (visitorData) {
        try {
          visitorData = decodeURIComponent(visitorData);
        } catch (e) {
          console.warn('[Extractor] Failed to decodeURIComponent VISITOR_DATA, using as-is.');
        }
        console.log(`[Extractor] Applying VISITOR_DATA configuration for ${clientType}...`);
        config.visitor_data = visitorData;
      }

      // Support Proxy from environment variables for VPS/datacenter IP bypass
      const proxyUrl = process.env.PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
      if (proxyUrl) {
        console.log(`[Extractor] Configuring undici ProxyAgent for ${clientType}: ${proxyUrl}`);
        const proxyAgent = new ProxyAgent(proxyUrl);
        config.fetch = (input: any, init: any) => {
          return Platform.shim.fetch(input, { ...init, dispatcher: proxyAgent });
        };
      }

      // Wrap Innertube client creation in a strict 6-second timeout to prevent hanging on datacenter blocks
      const createPromise = Innertube.create(config);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Innertube client creation timed out after 6 seconds`)), 6000)
      );

      instance = await Promise.race([createPromise, timeoutPromise]);
      this.instances.set(clientType, instance);
      console.log(`[Extractor] Innertube client for ${clientType} successfully initialized.`);
    }
    return instance;
  }

  /**
   * Resolves and extracts high-quality audio streams for a YouTube video using a robust fallback chain.
   * @param videoId The YouTube video or track ID.
   */
  public static async getAudioStream(videoId: string): Promise<{
    url: string;
    format: string;
    bitrate: number;
    mimeType: string;
    duration: number;
    userAgent: string;
  }> {
    let lastError: any = null;

    for (const clientType of this.CLIENT_TYPES) {
      try {
        const yt = await this.getInnertube(clientType);
        console.log(`[Extractor] Fetching basic info for video: ${videoId} using client ${clientType}`);
        
        // Wrap getBasicInfo in a strict 6-second timeout as well
        const fetchPromise = yt.getBasicInfo(videoId);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`getBasicInfo request timed out after 6 seconds`)), 6000)
        );

        const info = await Promise.race([fetchPromise, timeoutPromise]);

        if (!info.streaming_data) {
          console.warn(`[Extractor] Streaming data not found for ${videoId} using client ${clientType}. Playability status: ${JSON.stringify(info.playability_status || {})}`);
          continue;
        }

        // Choose the best audio format
        let format: any | undefined;
        try {
          format = info.chooseFormat({
            type: 'audio',
            quality: 'best'
          });
        } catch (err) {
          console.warn(`[Extractor] chooseFormat failed for client ${clientType}, falling back to manual search...`);
        }

        // Fallback search in case chooseFormat fails or doesn't find a format
        if (!format) {
          const audioFormats = info.streaming_data.adaptive_formats.filter(f => 
            f.mime_type.startsWith('audio/')
          );
          
          if (audioFormats.length === 0) {
            console.warn(`[Extractor] No audio format streams found for ${videoId} using client ${clientType}`);
            continue;
          }

          // Sort by bitrate descending to get best quality
          audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          format = audioFormats[0];
        }

        // Generate the deciphered stream URL
        // youtubei.js deciphers the signature automatically or serves it pre-signed under format.url
        const streamUrl = format.url || await format.decipher(yt.session.player);

        if (!streamUrl) {
          console.warn(`[Extractor] Deciphered stream URL could not be resolved for ${videoId} using client ${clientType}`);
          continue;
        }

        // Resolve the exact User-Agent used by this client session
        const userAgent = (yt.session.context as any).client?.userAgent || 'Mozilla/5.0';

        console.log(`[Extractor] Successfully resolved audio stream for ${videoId} using client ${clientType}`);
        return {
          url: streamUrl,
          format: format.audio_track?.audio_is_default ? 'default' : 'adaptive',
          bitrate: format.bitrate || 128000,
          mimeType: format.mime_type,
          duration: info.basic_info.duration || 0,
          userAgent: userAgent
        };
      } catch (error: any) {
        console.error(`[Extractor] Failed to extract stream for ${videoId} using client ${clientType}:`, error.message || error);
        lastError = error;
      }
    }

    throw new Error(`All stream extraction clients failed to resolve streaming data. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Directly downloads and returns a native Web ReadableStream of audio bytes for a YouTube video using a robust fallback chain.
   * @param videoId The YouTube video or track ID.
   */
  public static async getAudioStreamDownload(videoId: string): Promise<{
    stream: ReadableStream<Uint8Array>;
    mimeType: string;
    duration: number;
  }> {
    let lastError: any = null;

    for (const clientType of this.CLIENT_TYPES) {
      try {
        const yt = await this.getInnertube(clientType);
        console.log(`[Extractor] Fetching basic info for video: ${videoId} using client ${clientType}`);
        
        // Wrap getBasicInfo in a strict 6-second timeout
        const fetchPromise = yt.getBasicInfo(videoId);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`getBasicInfo request timed out after 6 seconds`)), 6000)
        );

        const info = await Promise.race([fetchPromise, timeoutPromise]);

        if (!info.streaming_data) {
          console.warn(`[Extractor] Streaming data not found for ${videoId} using client ${clientType}. Playability status: ${JSON.stringify(info.playability_status || {})}`);
          continue;
        }

        // Use the native download method
        console.log(`[Extractor] Initiating native download() stream for ${videoId} using client ${clientType}`);
        const stream = await info.download({
          type: 'audio',
          quality: 'best'
        });

        // Resolve format metadata for headers
        let format: any | undefined;
        try {
          format = info.chooseFormat({
            type: 'audio',
            quality: 'best'
          });
        } catch (err) {
          // ignore
        }

        if (!format && info.streaming_data.adaptive_formats) {
          const audioFormats = info.streaming_data.adaptive_formats.filter(f => 
            f.mime_type.startsWith('audio/')
          );
          if (audioFormats.length > 0) {
            audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            format = audioFormats[0];
          }
        }

        const mimeType = format?.mime_type || 'audio/webm; codecs="opus"';
        const duration = info.basic_info.duration || 0;

        console.log(`[Extractor] Successfully resolved native download stream for ${videoId} using client ${clientType}`);
        return {
          stream,
          mimeType,
          duration
        };
      } catch (error: any) {
        console.error(`[Extractor] Failed to extract native stream for ${videoId} using client ${clientType}:`, error.message || error);
        lastError = error;
      }
    }

    throw new Error(`All stream extraction clients failed to resolve native streaming data. Last error: ${lastError?.message || 'Unknown error'}`);
  }
}
