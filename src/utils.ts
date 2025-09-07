import { createClient } from "@deepgram/sdk";
import axios from "axios";
import * as fs from "fs";
import OpenAI from 'openai/index.mjs';

const deepgram = createClient(process.env["DEEPGRAM_API_KEY"] || "");
const openai = new OpenAI({
	apiKey: process.env['OPENAI_API_KEY'],
  });  

export async function getWordTimestamps(audioFilePath: string){
    const {result} = await deepgram.listen.prerecorded.transcribeFile(fs.readFileSync(audioFilePath), {
		model: "nova-2",
		smart_format: true,
	});

    if (result) {
        return result.results.channels[0].alternatives[0].words;
    } else {
		throw Error("transcription result is null");
    }

}

export async function generateAudio(text: string, voiceName: string, savePath: string) {
	const data = {
		model_id: "eleven_multilingual_v2",
		text: text,
	};

	const voiceId = await getVoiceByName(voiceName);

	const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, data, {
		headers: {
			"Content-Type": "application/json",
			"xi-api-key": process.env.ELEVEN_API_KEY || "",
		},
		responseType: "arraybuffer",
	});

	fs.writeFileSync(savePath, response.data);
}

async function getVoiceByName(name: string) {
	const response = await fetch("https://api.elevenlabs.io/v1/voices", {
		method: "GET",
		headers: {
			"xi-api-key": process.env.ELEVEN_API_KEY || "",
		},
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const data: any = await response.json();
	const voice = data.voices.find((voice: {name: string; voice_id: string}) => voice.name === name);
	return voice ? voice.voice_id : null;
}

export async function getVideoScript(videoTopic: string) {
  const prompt = `Create a script for a youtube short. The script should be around 60 to 80 words long and be an interesting text about the provided topic, and it should start with a catchy headline, something like "Did you know that?" or "This will blow your mind". Remember that this is for a voiceover that should be read, so things like hashtags should not be included. Now write the script for the following topic: "${videoTopic}". Now return the script and nothing else, also no meta-information - ONLY THE VOICEOVER.`;

  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-4-turbo-preview',
  });

  const result = chatCompletion.choices[0].message.content;

  if (result) {
    return result;
  } else {
    throw Error("returned text is null");
  }

}



