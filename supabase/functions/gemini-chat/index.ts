import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

//
// THIS IS THE FINAL, CORRECTED LINE:
// It uses the "gemini-pro-latest" model from the list you provided.
//
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=';

serve(async (req) => {
  // This handles the browser's "preflight" permission check (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*', // Allows all origins
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // 1. Get the user's prompt from the request
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage.content;

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // 2. Securely get the secret API key from Supabase secrets
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in Supabase secrets.');
    }

    // 3. Format the request body for the Gemini API
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    // 4. Call the Google Gemini API with the correct URL and key
    const res = await fetch(GEMINI_API_URL + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // 5. If Google sends an error, pass it to the frontend
    if (!res.ok) {
      const errorText = await res.text();
      // This will show the error in your red toast notification
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const data = await res.json();
    
    // 6. Extract the text response
    // Add a check in case candidates array is empty
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Gemini API returned no response.');
    }
    const aiResponse = data.candidates[0].content.parts[0].text;

    // 7. Send the AI's response back to your React app
    return new Response(
      JSON.stringify({ response: aiResponse }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // CORS header for the main response
        },
      },
    );

  } catch (error) {
    // Send any other server errors to the frontend
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // CORS header for the error response
        },
      },
    );
  }
});