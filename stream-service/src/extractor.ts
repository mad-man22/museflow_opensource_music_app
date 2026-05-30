import { Innertube, Platform } from 'youtubei.js';

// Provide standard JavaScript interpreter for deciphering signatures if needed
Platform.shim.eval = async (data: any) => {
  return new Function(data.output)();
};

export class StreamExtractor {
  private static instance: Innertube | null = null;

  private static async getInnertube(): Promise<Innertube> {
    if (!this.instance) {
      console.log('[Extractor] Initializing youtubei.js Innertube client with ANDROID_VR client_type...');
      this.instance = await Innertube.create({
        client_type: 'ANDROID_VR' as any
      });
      console.log('[Extractor] Innertube client successfully initialized.');
    }
    return this.instance;
  }

  /**
   * Resolves and extracts high-quality audio streams for a YouTube video.
   * @param videoId The YouTube video or track ID.
   */
  public static async getAudioStream(videoId: string): Promise<{
    url: string;
    format: string;
    bitrate: number;
    mimeType: string;
    duration: number;
  }> {
    try {
      const yt = await this.getInnertube();
      console.log(`[Extractor] Fetching info for video: ${videoId}`);
      const info = await yt.getInfo(videoId);

      if (!info.streaming_data) {
        throw new Error('Streaming data not found in YouTube response');
      }

      // Choose the best audio format
      let format: any | undefined;
      try {
        format = info.chooseFormat({
          type: 'audio',
          quality: 'best'
        });
      } catch (err) {
        console.warn('[Extractor] chooseFormat failed, falling back to manual search...');
      }

      // Fallback search in case chooseFormat fails or doesn't find a format
      if (!format) {
        const audioFormats = info.streaming_data.adaptive_formats.filter(f => 
          f.mime_type.startsWith('audio/')
        );
        
        if (audioFormats.length === 0) {
          throw new Error('No audio format streams found for this video');
        }

        // Sort by bitrate descending to get best quality
        audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        format = audioFormats[0];
      }

      // Generate the deciphered stream URL
      // youtubei.js deciphers the signature automatically or serves it pre-signed under format.url
      const streamUrl = format.url || await format.decipher(yt.session.player);

      if (!streamUrl) {
        throw new Error('Deciphered stream URL could not be resolved');
      }

      console.log(`[Extractor] Successfully resolved audio stream for ${videoId}`);
      return {
        url: streamUrl,
        format: format.audio_track?.audio_is_default ? 'default' : 'adaptive',
        bitrate: format.bitrate || 128000,
        mimeType: format.mime_type,
        duration: info.basic_info.duration || 0
      };
    } catch (error: any) {
      console.error(`[Extractor] Error extracting stream for ${videoId}:`, error.message || error);
      throw error;
    }
  }
}
