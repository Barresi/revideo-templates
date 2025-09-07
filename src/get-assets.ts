require('dotenv').config();

import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getWordTimestamps } from './utils';

async function createAssets(topic: string, voiceName: string){
    const jobId = uuidv4();


    // const script = await getVideoScript(topic);
    // await generateAudio(script, voiceName, `./public/${jobId}-audio.wav`);
    const words = await getWordTimestamps(`../assets/Quick Avatar Video (1).mp4`);

    const metadata = {
      // audioUrl: `${jobId}-audio.wav`,
      words: words
    };
  
    await fs.promises.writeFile(`./public/${jobId}-metadata.json`, JSON.stringify(metadata, null, 2));
}

createAssets("The moon landing", "Sarah")