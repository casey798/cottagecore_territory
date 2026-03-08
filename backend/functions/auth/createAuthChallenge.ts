import { CreateAuthChallengeTriggerEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { randomInt } from 'crypto';

const ses = new SESClient({ region: process.env.AWS_REGION || 'ap-south-1' });

export const handler = async (
  event: CreateAuthChallengeTriggerEvent
): Promise<CreateAuthChallengeTriggerEvent> => {
  try {
    const email = event.request.userAttributes.email;
    const { session } = event.request;

    if (session.length > 0) {
      // Retry attempt — reuse the OTP from the previous challenge, do NOT send a new email
      const previousChallenge = session[session.length - 1];
      const previousCode = previousChallenge.challengeMetadata?.replace('CODE-', '') || '';
      event.response.privateChallengeParameters = { answer: previousCode };
      event.response.challengeMetadata = `CODE-${previousCode}`;
      event.response.publicChallengeParameters = { email };
      return event;
    }

    // First attempt — generate a new OTP and send email
    const otp = randomInt(100000, 999999).toString();

    await ses.send(
      new SendEmailCommand({
        Source: process.env.SES_FROM_EMAIL || 'noreply@grovewars.com',
        Destination: {
          ToAddresses: [email],
        },
        Message: {
          Subject: {
            Data: 'Your GroveWars verification code',
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: `Your verification code is: ${otp}\n\nThis code expires in 5 minutes.`,
              Charset: 'UTF-8',
            },
            Html: {
              Data: `
                <div style="font-family: sans-serif; padding: 20px;">
                  <h2>GroveWars Verification</h2>
                  <p>Your verification code is:</p>
                  <h1 style="letter-spacing: 8px; font-size: 36px; color: #4a7c59;">${otp}</h1>
                  <p>This code expires in 5 minutes.</p>
                </div>
              `,
              Charset: 'UTF-8',
            },
          },
        },
      })
    );

    event.response.privateChallengeParameters = { answer: otp };
    event.response.challengeMetadata = `CODE-${otp}`;
    event.response.publicChallengeParameters = { email };

    return event;
  } catch (err) {
    console.error('createAuthChallenge error:', err);
    throw err;
  }
};
