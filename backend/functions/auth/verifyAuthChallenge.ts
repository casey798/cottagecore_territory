import { VerifyAuthChallengeResponseTriggerEvent } from 'aws-lambda';

export const handler = async (
  event: VerifyAuthChallengeResponseTriggerEvent
): Promise<VerifyAuthChallengeResponseTriggerEvent> => {
  const expectedAnswer = (event.request.privateChallengeParameters.answer || '').trim().toLowerCase();
  const userAnswer = (event.request.challengeAnswer || '').trim().toLowerCase();

  event.response.answerCorrect = expectedAnswer === userAnswer && expectedAnswer.length > 0;

  return event;
};
